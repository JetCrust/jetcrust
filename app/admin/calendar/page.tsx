import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import CalendarGrid, { type CalItem } from "../../components/CalendarGrid";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";

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
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/calendar");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main>
      </>
    );
  }

  const sp = await searchParams;
  const { start, end, key } = monthWindow(sp.m);

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const properties = await getProperties(true);

  // Bookings overlapping the month (confirmed + pending).
  const bookings = await prisma.booking.findMany({
    where: { status: { in: ["APPROVED", "REQUESTED"] }, checkIn: { lt: end }, checkOut: { gt: start } },
    include: { user: true },
  });
  // Non-booking blocks (manual holds + imported OTA stays).
  const blocks = await prisma.availabilityBlock.findMany({
    where: { source: { in: ["MANUAL", "ICAL"] }, start: { lt: end }, end: { gt: start } },
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
    })),
  ];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <CalendarGrid
                monthKey={key}
                properties={properties.map((p) => ({ slug: p.slug, name: p.name }))}
                items={items}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
