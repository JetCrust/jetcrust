import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { prisma } from "@/lib/prisma";
import { buildPerformance } from "@/lib/reports";
import { staffScope, slugFilter } from "@/lib/access";

const money = (c: number) => `€${Math.round(c / 100).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmt = (d: Date) => new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
const DAY = 86400000;

export default async function AdminOverview() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin/overview");
  const sf = slugFilter(scope);

  const now = new Date();
  const today0 = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const horizon = new Date(today0.getTime() + 14 * DAY);
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0, 23, 59, 59));

  const props = await prisma.property.findMany({ select: { slug: true, name: true } });
  const nameOf = (s: string) => props.find((p) => p.slug === s)?.name || s;

  const perf = await buildPerformance(monthStart, monthEnd, scope.slugs);
  const t = perf.totals;

  const [arrivals, departures, pendingCount, balancesDue, depositsToPlace] = await Promise.all([
    prisma.booking.findMany({ where: { status: "APPROVED", checkIn: { gte: today0, lte: horizon }, ...sf }, include: { user: true }, orderBy: { checkIn: "asc" } }),
    prisma.booking.findMany({ where: { status: "APPROVED", checkOut: { gte: today0, lte: horizon }, ...sf }, include: { user: true }, orderBy: { checkOut: "asc" } }),
    prisma.booking.count({ where: { status: "REQUESTED", ...sf } }),
    prisma.booking.findMany({ where: { status: "APPROVED", balanceCents: { gt: 0 }, balancePaidAt: null, ...sf } }),
    prisma.booking.count({ where: { status: "APPROVED", securityCents: { gt: 0 }, securityStatus: "none", checkIn: { gte: today0, lte: new Date(today0.getTime() + 3 * DAY) }, ...sf } }),
  ]);
  const balanceTotal = balancesDue.reduce((s, b) => s + b.balanceCents, 0);
  const isToday = (d: Date) => new Date(d).toISOString().slice(0, 10) === today0.toISOString().slice(0, 10);

  const kpis = [
    { label: "Revenue (MTD)", value: money(t.totalRevenueCents) },
    { label: "Occupancy (MTD)", value: pct(t.occupancy) },
    { label: "ADR (MTD)", value: money(t.adrCents) },
    { label: "Arrivals (14 days)", value: String(arrivals.length) },
  ];

  const alerts = [
    { label: "Pending requests", n: pendingCount, href: "/admin", tone: pendingCount > 0 ? "warn" : "ok" },
    { label: "Balances due", n: balancesDue.length, extra: balancesDue.length ? money(balanceTotal) : "", href: "/admin", tone: balancesDue.length > 0 ? "warn" : "ok" },
    { label: "Deposits to place (3 days)", n: depositsToPlace, href: "/admin/calendar", tone: depositsToPlace > 0 ? "warn" : "ok" },
  ];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Overview</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Your portfolio at a glance: this month's numbers, what needs attention, and who is arriving and leaving.</p>
              </div>

              <div className="rep-kpis" style={{ marginBottom: "1.4rem" }}>
                {kpis.map((k) => (
                  <div key={k.label} className="rep-kpi">
                    <p className="rep-kpi__label">{k.label}</p>
                    <p className="rep-kpi__value">{k.value}</p>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Needs attention</h3></div>
                <div className="ov-alerts">
                  {alerts.map((a) => (
                    <Link key={a.label} href={a.href} className={`ov-alert ov-alert--${a.tone}`}>
                      <span className="ov-alert__n">{a.n}</span>
                      <span className="ov-alert__label">{a.label}{a.extra ? ` · ${a.extra}` : ""}</span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="ov-cols">
                <div className="panel" style={{ margin: 0 }}>
                  <div className="panel__head"><h3>Upcoming arrivals</h3></div>
                  {arrivals.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>None in the next 14 days.</p> : (
                    <ul className="ov-list">
                      {arrivals.map((b) => (
                        <li key={b.id} className="ov-row">
                          <div>
                            <span className="ov-row__name">{b.user.name || b.user.email.split("@")[0]}{isToday(b.checkIn) && <span className="ov-today">today</span>}</span>
                            <span className="ov-row__meta">{nameOf(b.propertySlug)} · {fmt(b.checkIn)} → {fmt(b.checkOut)} · {b.guests} guests</span>
                          </div>
                          <Link href={`/admin/bookings/${b.id}`} className="chip">Open booking</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="panel" style={{ margin: 0 }}>
                  <div className="panel__head"><h3>Upcoming departures</h3></div>
                  {departures.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>None in the next 14 days.</p> : (
                    <ul className="ov-list">
                      {departures.map((b) => (
                        <li key={b.id} className="ov-row">
                          <div>
                            <span className="ov-row__name">{b.user.name || b.user.email.split("@")[0]}{isToday(b.checkOut) && <span className="ov-today">today</span>}</span>
                            <span className="ov-row__meta">{nameOf(b.propertySlug)} · leaves {fmt(b.checkOut)}</span>
                          </div>
                          <Link href={`/admin/bookings/${b.id}`} className="chip">Open booking</Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
