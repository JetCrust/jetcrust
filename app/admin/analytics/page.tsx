import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope } from "@/lib/access";

const DAY = 86400000;
const fmtWeek = (d: Date) => {
  const mon = new Date(d);
  const dow = (mon.getUTCDay() + 6) % 7; // 0 = Monday
  mon.setUTCDate(mon.getUTCDate() - dow);
  return `Week of ${mon.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" })}`;
};

export default async function AdminAnalytics() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");
  const slugs = scope.slugs; // null = all

  const since30 = new Date(Date.now() - 30 * DAY);
  const since7 = new Date(Date.now() - 7 * DAY);
  const [events, props, pendingCount] = await Promise.all([
    prisma.analyticsEvent.findMany({ where: { createdAt: { gte: since30 }, ...(slugs ? { slug: { in: slugs } } : {}) } }),
    getProperties(true),
    prisma.booking.count({ where: { status: "REQUESTED", ...(slugs ? { propertySlug: { in: slugs } } : {}) } }),
  ]);
  const inScope = props.filter((p) => (slugs ? slugs.includes(p.slug) : true) && p.status === "live");

  const rows = inScope.map((p) => {
    const ev = events.filter((e) => e.slug === p.slug);
    const views = ev.filter((e) => e.type === "view");
    const views7 = views.filter((e) => e.createdAt >= since7).length;
    const sessions = new Map<string, number>();
    for (const v of views) if (v.session) sessions.set(v.session, (sessions.get(v.session) || 0) + 1);
    const uniques = sessions.size;
    const repeat = [...sessions.values()].filter((n) => n > 1).length;
    const quotes = ev.filter((e) => e.type === "quote").length;
    return { slug: p.slug, name: p.name, views30: views.length, views7, uniques, repeat, quotes };
  });

  // Most-wanted arrival weeks (from quote interest) across scope.
  const weekCounts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "quote" || !e.checkIn) continue;
    const k = fmtWeek(e.checkIn);
    weekCounts.set(k, (weekCounts.get(k) || 0) + 1);
  }
  const hotWeeks = [...weekCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const totalViews = rows.reduce((s, r) => s + r.views30, 0);
  const totalQuotes = rows.reduce((s, r) => s + r.quotes, 0);

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.role} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>Demand &amp; interest</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Our own tracking of who is looking, how often, and which dates they want. The signal you use to price with confidence. Last 30 days.</p>
              </div>

              <div className="rep-kpis" style={{ marginBottom: "1.4rem" }}>
                <div className="rep-kpi"><p className="rep-kpi__label">Property views (30d)</p><p className="rep-kpi__value">{totalViews}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Date checks (30d)</p><p className="rep-kpi__value">{totalQuotes}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Homes tracked</p><p className="rep-kpi__value">{rows.length}</p></div>
              </div>

              <div className="panel" style={{ marginBottom: "1.4rem" }}>
                <div className="panel__head"><h3>By property</h3></div>
                {totalViews + totalQuotes === 0 ? (
                  <p style={{ color: "var(--stone)", margin: 0 }}>No traffic recorded yet. Views and date checks will appear here as visitors browse the site.</p>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ledger">
                      <thead><tr><th>Property</th><th>Views 30d</th><th>Views 7d</th><th>Unique visitors</th><th>Came back</th><th>Date checks</th></tr></thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.slug}>
                            <td>{r.name}</td>
                            <td>{r.views30}</td>
                            <td>{r.views7}</td>
                            <td>{r.uniques}</td>
                            <td>{r.repeat}</td>
                            <td>{r.quotes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Most-wanted dates</h3></div>
                <p className="panel__hint" style={{ marginTop: 0 }}>Arrival weeks people are checking most. Strong early interest is a reason to hold or raise the price, not discount.</p>
                {hotWeeks.length === 0 ? (
                  <p style={{ color: "var(--stone)", margin: 0 }}>No date checks yet.</p>
                ) : (
                  <ul className="kv" style={{ margin: 0 }}>
                    {hotWeeks.map(([week, n]) => (
                      <li key={week}><span>{week}</span><span>{n} {n === 1 ? "check" : "checks"}</span></li>
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
