import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import SyncIcalButton from "../../components/SyncIcalButton";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";

const SITE = process.env.SITE_ORIGIN || "https://jetcrust.com";
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function AdminCalendar() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/calendar");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}>
          <div className="wrap"><h2>Not authorized</h2></div>
        </main>
      </>
    );
  }

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const blocks = await prisma.availabilityBlock.findMany({ orderBy: { start: "asc" }, take: 60 });
  const properties = await getProperties(true);
  const nameBySlug = new Map(properties.map((p) => [p.slug, p.name]));

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />

            <div>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>Calendar &amp; sync</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  Share these feeds with Airbnb, Booking.com, VRBO or a concierge so they see our booked dates. To pull
                  their calendars in, add their iCal links to each property&apos;s <code>ical_urls</code>, then sync.
                </p>
              </div>

              <div className="panel" style={{ marginBottom: "1.6rem" }}>
                <div className="panel__head"><h3>Your feed links</h3></div>
                <ul className="kv">
                  {properties.map((p) => (
                    <li key={p.slug}>
                      <span>{p.name}</span>
                      <span style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>{SITE}/api/ical/{p.slug}</span>
                    </li>
                  ))}
                </ul>
                <div style={{ marginTop: "1.2rem" }}><SyncIcalButton /></div>
              </div>

              <div className="panel">
                <div className="panel__head">
                  <h3>Blocked dates</h3>
                  <span className="console__count">{blocks.length}</span>
                </div>
                <p className="panel__hint">From approved bookings and imported calendars.</p>
                {blocks.length === 0 ? (
                  <p style={{ margin: 0, color: "var(--stone)" }}>No blocked dates yet.</p>
                ) : (
                  <ul className="kv">
                    {blocks.map((bl) => (
                      <li key={bl.id}>
                        <span>{nameBySlug.get(bl.propertySlug) || bl.propertySlug}</span>
                        <span>{fmt(bl.start)} to {fmt(bl.end)} · {bl.source === "BOOKING" ? "Booking" : "Imported"}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
