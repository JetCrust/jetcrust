import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import OtaLogger, { type OtaReservation } from "../../components/OtaLogger";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope, slugFilter } from "@/lib/access";

const ymd = (d: Date) => d.toISOString().slice(0, 10);
function channelEnum(s: string): OtaReservation["channel"] {
  const t = (s || "").toLowerCase();
  if (t.includes("airbnb")) return "AIRBNB";
  if (t.includes("booking")) return "BOOKING";
  if (t.includes("vrbo") || t.includes("homeaway")) return "VRBO";
  return "OTHER";
}

export default async function AdminOta() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");
  const sf = slugFilter(scope);

  // Imported OTA dates (from iCal), recent + future, plus anything already logged.
  const cutoff = new Date(Date.now() - 120 * 86400000);
  const [blocks, logged, props, pendingCount] = await Promise.all([
    prisma.availabilityBlock.findMany({ where: { source: "ICAL", start: { gte: cutoff }, ...sf }, orderBy: { start: "asc" } }),
    prisma.otaBooking.findMany({ where: { ...sf }, orderBy: { checkIn: "asc" } }),
    getProperties(true),
    prisma.booking.count({ where: { status: "REQUESTED", ...sf } }),
  ]);
  const nameOf = (s: string) => props.find((p) => p.slug === s)?.name || s;

  // Index logged rows by code and by dates so blocks can be matched to them.
  const byCode = new Map(logged.filter((o) => o.confirmationCode).map((o) => [`${o.propertySlug}|${o.confirmationCode}`, o]));
  const byDates = new Map(logged.map((o) => [`${o.propertySlug}|${ymd(o.checkIn)}|${ymd(o.checkOut)}`, o]));
  const usedIds = new Set<string>();

  const reservations: OtaReservation[] = blocks.map((b) => {
    let meta: { channel?: string; code?: string; phoneLast4?: string; link?: string } = {};
    try { meta = b.meta ? JSON.parse(b.meta) : {}; } catch { /* ignore */ }
    const checkIn = ymd(b.start), checkOut = ymd(b.end);
    const match = (meta.code && byCode.get(`${b.propertySlug}|${meta.code}`)) || byDates.get(`${b.propertySlug}|${checkIn}|${checkOut}`);
    if (match) usedIds.add(match.id);
    return {
      propertySlug: b.propertySlug, propertyName: nameOf(b.propertySlug),
      channel: channelEnum(meta.channel || b.note || ""),
      confirmationCode: meta.code, phoneLast4: meta.phoneLast4, reservationLink: meta.link,
      checkIn, checkOut,
      id: match?.id, guestName: match?.guestName || undefined,
      grossCents: match?.grossCents, feeCents: match?.feeCents, netCents: match?.netCents, note: match?.note || undefined,
    };
  });

  // Logged rows with no current imported block (e.g. a past stay whose feed dropped it).
  const orphans: OtaReservation[] = logged.filter((o) => !usedIds.has(o.id)).map((o) => ({
    propertySlug: o.propertySlug, propertyName: nameOf(o.propertySlug),
    channel: channelEnum(o.channel), confirmationCode: o.confirmationCode || undefined,
    checkIn: ymd(o.checkIn), checkOut: ymd(o.checkOut), id: o.id, guestName: o.guestName || undefined,
    grossCents: o.grossCents, feeCents: o.feeCents, netCents: o.netCents, note: o.note || undefined,
  }));

  const all = [...reservations, ...orphans];
  const toLog = all.filter((r) => !r.id || !(r.netCents && r.netCents > 0)).length;

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Admin · Accounting</p>
                <h2>OTA bookings</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  Airbnb, Booking.com and VRBO reservations block your calendar automatically, but their feeds never carry the money.
                  Enter each payout here (from the channel&rsquo;s dashboard) and it counts in your P&amp;L. {toLog > 0 ? <strong>{toLog} still to log.</strong> : "All caught up."}
                </p>
              </div>

              {all.length === 0 ? (
                <div className="panel"><p style={{ margin: 0, color: "var(--stone)" }}>No OTA reservations imported yet. Once a channel calendar is connected and a booking comes in, it will appear here to log.</p></div>
              ) : (
                <div className="stack">
                  {all.map((r, i) => <OtaLogger key={r.id || `${r.propertySlug}-${r.checkIn}-${i}`} r={r} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
