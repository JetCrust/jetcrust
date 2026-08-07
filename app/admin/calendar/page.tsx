import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import CalendarGrid, { type CalItem } from "../../components/CalendarGrid";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { nightlyBase } from "@/lib/pricing";
import { staffScope, slugFilter } from "@/lib/access";

const day = (d: Date) => new Date(d).toISOString().slice(0, 10);

// Parse ?m=YYYY-MM into the UTC first/last day of that month.
function monthWindow(m?: string) {
  const now = new Date();
  let y = now.getUTCFullYear(), mo = now.getUTCMonth();
  if (m && /^\d{4}-\d{2}$/.test(m)) { const [ys, ms] = m.split("-"); y = Number(ys); mo = Number(ms) - 1; }
  const start = new Date(Date.UTC(y, mo, 1));
  const end = new Date(Date.UTC(y, mo + 1, 1)); // exclusive
  const key = `${y}-${String(mo + 1).padStart(2, "0")}`;
  return { start, end, key, y, mo };
}

export default async function AdminCalendar({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin/calendar");
  const sf = slugFilter(scope);

  const sp = await searchParams;
  const { start, end, key, y, mo } = monthWindow(sp.m);
  const N = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED", ...sf } });
  const allProperties = await getProperties(true);
  const properties = scope.slugs ? allProperties.filter((p) => scope.slugs!.includes(p.slug)) : allProperties;

  // Per-night rack rate for every day of the month (seasonal / weekend / base).
  // Lets the team quote straight off the calendar; this is the rate that will
  // feed the OTAs (Booking.com, VRBO, ...) once the channel manager is connected.
  const pricesBySlug: Record<string, number[]> = {};
  for (const p of properties) {
    pricesBySlug[p.slug] = Array.from({ length: N }, (_, i) => nightlyBase(p, new Date(Date.UTC(y, mo, i + 1))).rate);
  }
  const currencySymbol = (properties[0]?.pricing?.currency || "eur").toUpperCase() === "EUR" ? "€" : "";

  // Bookings overlapping the month (confirmed + pending).
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["APPROVED", "REQUESTED"] }, checkIn: { lt: end }, checkOut: { gt: start }, ...sf },
    include: { user: true },
  });
  // Non-booking blocks (manual holds + imported OTA stays).
  const blocks = await prisma.availabilityBlock.findMany({
    where: { source: { in: ["MANUAL", "ICAL"] }, start: { lt: end }, end: { gt: start }, ...sf },
  });

  const items: CalItem[] = [
    ...bookings.map((b): CalItem => ({
      kind: "booking",
      id: b.id,
      propertySlug: b.propertySlug,
      start: day(b.checkIn),
      end: day(b.checkOut),
      status: b.status === "APPROVED" ? "confirmed" : "pending",
      label: b.user.name || b.user.email.split("@")[0],
      guests: b.guests,
      amountCents: b.amountCents,
    })),
    ...blocks.map((bl): CalItem => ({
      kind: "block",
      id: bl.id,
      propertySlug: bl.propertySlug,
      start: day(bl.start),
      end: day(bl.end),
      status: "blocked",
      label: bl.source === "ICAL" ? (bl.note || "Imported") : (bl.note || "Blocked"),
      source: bl.source,
      meta: bl.meta ? (JSON.parse(bl.meta) as CalItem["meta"]) : null,
    })),
  ];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />
            <div>
              <CalendarGrid
                monthKey={key}
                properties={properties.map((p) => ({ slug: p.slug, name: p.name }))}
                items={items}
                prices={pricesBySlug}
                currencySymbol={currencySymbol}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
