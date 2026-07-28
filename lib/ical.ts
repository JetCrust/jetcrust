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

// Parse VEVENT DTSTART/DTEND pairs. Handles DATE and DATETIME, and property params.
export function parseIcs(text: string): { start: Date; end: Date }[] {
  const events: { start: Date; end: Date }[] = [];
  const blocks = text.split(/BEGIN:VEVENT/i).slice(1);
  for (const b of blocks) {
    const chunk = b.split(/END:VEVENT/i)[0];
    const startM = chunk.match(/DTSTART[^:]*:([0-9TZ]+)/i);
    const endM = chunk.match(/DTEND[^:]*:([0-9TZ]+)/i);
    if (!startM) continue;
    const start = parseIcsDate(startM[1]);
    const end = endM ? parseIcsDate(endM[1]) : null;
    if (start && end) events.push({ start, end });
  }
  return events;
}
