import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../../components/AppHeader";
import ConsoleNav from "../../../components/ConsoleNav";
import SyncIcalButton from "../../../components/SyncIcalButton";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";

const SITE = process.env.SITE_ORIGIN || "https://jetcrust.com";
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function CalendarSync() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/calendar/sync");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main>
      </>
    );
  }

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const blocks = await prisma.availabilityBlock.findMany({ orderBy: { start: "asc" }, take: 100 });
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
              <p style={{ margin: "0 0 1rem" }}><Link className="textlink" href="/admin/calendar">&larr; Back to calendar</Link></p>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>Channel feeds &amp; sync</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  This syncs both ways over iCal. <strong>Outgoing</strong>: give the OTAs your feed so they block dates you&rsquo;ve booked.
                  <strong> Incoming</strong>: add each OTA&rsquo;s iCal link so <em>their</em> bookings block your calendar here. We pull incoming
                  calendars every ~3 hours and whenever you press Sync. iCal isn&rsquo;t instant (the OTAs refresh their feeds on their own
                  schedule), so an OTA booking can take a little while to appear.
                </p>
              </div>

              <div className="panel" style={{ marginBottom: "1.6rem" }}>
                <div className="panel__head"><h3>Outgoing — your feed links (give these to the OTAs)</h3></div>
                <ul className="kv">
                  {properties.map((p) => (
                    <li key={p.slug}>
                      <span>{p.name}</span>
                      <span style={{ fontSize: "0.78rem", wordBreak: "break-all" }}>{SITE}/api/ical/{p.slug}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="panel" style={{ marginBottom: "1.6rem" }}>
                <div className="panel__head"><h3>Incoming — OTA calendars we pull in</h3></div>
                <p className="panel__hint">Add each listing&rsquo;s iCal link (Airbnb, Booking.com, VRBO) under the home in <a className="textlink" href="/admin/properties">Properties &amp; pricing</a> so their bookings block your dates. This is what makes it block back.</p>
                <ul className="kv">
                  {properties.map((p) => {
                    const urls = Array.isArray(p.ical_urls) ? (p.ical_urls as string[]) : [];
                    return (
                      <li key={p.slug}>
                        <span>{p.name}</span>
                        <span style={{ color: urls.length ? "var(--forest)" : "#a3412e" }}>{urls.length ? `${urls.length} calendar${urls.length === 1 ? "" : "s"} connected` : "None connected — OTA bookings won't block yet"}</span>
                      </li>
                    );
                  })}
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
                        <span>{fmt(bl.start)} to {fmt(bl.end)} · {bl.source === "BOOKING" ? "Booking" : bl.source === "ICAL" ? "Imported" : "Manual"}</span>
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
