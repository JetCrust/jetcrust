// Minimal iCalendar build + parse for two-way availability sync.
// Export: our confirmed bookings/blocks become an .ics feed external platforms subscribe to.
// Import: external .ics feeds (Airbnb, Booking.com, VRBO, concierge) become AvailabilityBlocks.

type Block = { start: Date; end: Date; note?: string | null; id?: string };

function toIcsDate(d: Date): string {
  // All-day DATE value (YYYYMMDD)
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function buildIcs(propertyName: string, blocks: Block[]): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Jet Crust//Availability//EN",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${propertyName} — Jet Crust`,
  ];
  for (const b of blocks) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${b.id || `${toIcsDate(b.start)}-${toIcsDate(b.end)}`}@jetcrust.com`,
      `DTSTART;VALUE=DATE:${toIcsDate(b.start)}`,
      `DTEND;VALUE=DATE:${toIcsDate(b.end)}`,
      "SUMMARY:Not available",
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

function parseIcsDate(v: string): Date | null {
  const s = v.trim();
  const dateOnly = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (dateOnly) return new Date(Date.UTC(+dateOnly[1], +dateOnly[2] - 1, +dateOnly[3]));
  const dateTime = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z?$/);
  if (dateTime) return new Date(Date.UTC(+dateTime[1], +dateTime[2] - 1, +dateTime[3], +dateTime[4], +dateTime[5], +dateTime[6]));
  return null;
}

export type IcsEvent = { start: Date; end: Date; summary?: string; description?: string; uid?: string };

// Unfold RFC 5545 line folding (a CRLF followed by a space/tab continues the line).
function unfold(text: string): string {
  return text.replace(/\r?\n[ \t]/g, "");
}

// Parse VEVENT DTSTART/DTEND pairs plus SUMMARY/DESCRIPTION/UID. Handles DATE and
// DATETIME, property params, and folded lines (Airbnb folds long DESCRIPTIONs).
export function parseIcs(text: string): IcsEvent[] {
  const events: IcsEvent[] = [];
  const src = unfold(text);
  const blocks = src.split(/BEGIN:VEVENT/i).slice(1);
  for (const b of blocks) {
    const chunk = b.split(/END:VEVENT/i)[0];
    const startM = chunk.match(/DTSTART[^:]*:([0-9TZ]+)/i);
    const endM = chunk.match(/DTEND[^:]*:([0-9TZ]+)/i);
    if (!startM) continue;
    const start = parseIcsDate(startM[1]);
    const end = endM ? parseIcsDate(endM[1]) : null;
    if (!start || !end) continue;
    const grab = (k: string) => chunk.match(new RegExp(`\\n${k}[^:]*:(.*)`, "i"))?.[1]?.trim();
    events.push({ start, end, summary: grab("SUMMARY"), description: grab("DESCRIPTION"), uid: grab("UID") });
  }
  return events;
}

// Friendly channel label from a feed URL: "Airbnb" / "Booking.com" / "VRBO".
export function channelName(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("airbnb")) return "Airbnb";
  if (u.includes("booking.com") || u.includes("admin.booking")) return "Booking.com";
  if (u.includes("vrbo") || u.includes("homeaway") || u.includes("expedia")) return "VRBO";
  if (u.includes("google")) return "Google";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Calendar"; }
}

// Pull the useful bits an OTA feed sometimes carries in DESCRIPTION/SUMMARY: a
// reservation deep-link, a confirmation code, and the last 4 digits of a phone.
// iCal never carries full name, email, or full phone (OTAs strip guest PII).
export function reservationMeta(ev: IcsEvent): { link?: string; code?: string; phoneLast4?: string; summary?: string } {
  const text = `${ev.description || ""}`;
  const link = text.match(/https?:\/\/\S+/)?.[0]?.replace(/\\n.*$/, "");
  const code = link?.match(/details\/([A-Z0-9]+)/i)?.[1] || text.match(/\b([A-Z0-9]{8,12})\b/)?.[1];
  const phoneLast4 = text.match(/Last 4 Digits\)?:?\s*(\d{4})/i)?.[1];
  // Only treat SUMMARY as a guest name when it isn't one of the platforms' generic
  // "Reserved / Not available / Blocked" labels (Booking.com sometimes puts a real name).
  const generic = /(reserved|not available|unavailable|blocked|closed|busy|airbnb|booking\.?com|vrbo|homeaway)/i;
  const summary = ev.summary && !generic.test(ev.summary) ? ev.summary : undefined;
  return { link, code, phoneLast4, summary };
}
