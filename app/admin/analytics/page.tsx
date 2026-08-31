import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope } from "@/lib/access";
import { searchPerformance } from "@/lib/gsc";

export const dynamic = "force-dynamic";

const DAY = 86400000;
const gscPct = (n: number) => `${(n * 100).toFixed(1)}%`;
const gscPos = (n: number) => n.toFixed(1);
const gscNum = (n: number) => Math.round(n).toLocaleString("en-US");
const gscShort = (u: string) => u.replace(/^https?:\/\/[^/]+/, "") || "/";
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
  // Google Search Console performance — Super Admin only.
  const gsc = scope.isSuper ? await searchPerformance(28) : null;

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

  // Where the visitors came from (views only), by channel.
  const sourceCounts = new Map<string, number>();
  for (const e of events) {
    if (e.type !== "view") continue;
    const s = e.source || "Direct";
    sourceCounts.set(s, (sourceCounts.get(s) || 0) + 1);
  }
  const sources = [...sourceCounts.entries()].sort((a, b) => b[1] - a[1]);
  const sourceTotal = sources.reduce((s, [, n]) => s + n, 0);

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

              <div className="panel" style={{ marginBottom: "1.4rem" }}>
                <div className="panel__head"><h3>Where visitors come from</h3></div>
                <p className="panel__hint" style={{ marginTop: 0 }}>How people reached your property pages (last 30 days). Google means search, Social means Instagram/Facebook and the like, Direct means they typed the address or came from a bookmark. Put your effort where it pays off.</p>
                {sourceTotal === 0 ? (
                  <p style={{ color: "var(--stone)", margin: 0 }}>No traffic recorded yet. Sources appear as visitors arrive.</p>
                ) : (
                  <ul className="kv" style={{ margin: 0 }}>
                    {sources.map(([src, n]) => (
                      <li key={src}><span>{src}</span><span>{n} · {Math.round((n / sourceTotal) * 100)}%</span></li>
                    ))}
                  </ul>
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

              {gsc && (
                <div style={{ marginTop: "1.4rem" }}>
                  <div className="sec-head" style={{ marginBottom: "1rem" }}>
                    <p className="overline eyebrow-line">Google Search</p>
                    <h3 style={{ fontSize: "clamp(1.4rem,3vw,1.8rem)", margin: 0 }}>Search performance</h3>
                    <p className="lead" style={{ marginBottom: 0, fontSize: "0.95rem" }}>What people search on Google to find you, from Search Console. Last 28 days ({gsc.start} to {gsc.end}).</p>
                  </div>

                  {gsc.status === "no_key" ? (
                    <div className="panel"><p style={{ margin: 0, color: "var(--stone)" }}>Not connected. <strong>GOOGLE_SERVICE_ACCOUNT_KEY</strong> isn&rsquo;t set in this environment. Add it in Vercel → Settings → Environment Variables (Production), paste the whole service-account JSON, then redeploy.</p></div>
                  ) : gsc.status === "bad_key" ? (
                    <div className="panel"><p style={{ margin: 0, color: "#a3412e" }}>The <strong>GOOGLE_SERVICE_ACCOUNT_KEY</strong> value isn&rsquo;t valid JSON. Re-paste the entire service-account file (curly brace to curly brace), with no extra surrounding quotes, then redeploy.</p></div>
                  ) : gsc.status === "auth" ? (
                    <div className="panel"><p style={{ margin: 0, color: "#a3412e" }}>Key loaded{gsc.keyEmail ? <> (<code>{gsc.keyEmail}</code>)</> : null}, but Google rejected the sign-in. Check the service account is active and the Search Console API is enabled for its project.</p></div>
                  ) : gsc.status === "error" ? (
                    <div className="panel"><p style={{ margin: 0, color: "#a3412e" }}>Connected{gsc.keyEmail ? <> as <code>{gsc.keyEmail}</code></> : null}, but the query failed: {gsc.error}. Usually this means that account hasn&rsquo;t been added as a user on the jetcrust.com Search Console property.</p></div>
                  ) : (
                    <>
                      <p style={{ margin: "0 0 1.2rem", fontSize: "0.85rem", color: "var(--stone)" }}>
                        <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 999, background: "#3f9d5a", marginRight: 6 }} />
                        Live{gsc.keyEmail ? <> · connected as <code>{gsc.keyEmail}</code></> : null}. Latest finalized day is <strong>{gsc.end}</strong> — Google publishes complete data about 2 days late, so that&rsquo;s as current as Search Console gets. Refreshed on every visit.
                      </p>
                      <div className="rep-kpis" style={{ marginBottom: "1.4rem" }}>
                        <div className="rep-kpi"><p className="rep-kpi__label">Clicks</p><p className="rep-kpi__value">{gscNum(gsc.totals.clicks)}</p></div>
                        <div className="rep-kpi"><p className="rep-kpi__label">Impressions</p><p className="rep-kpi__value">{gscNum(gsc.totals.impressions)}</p></div>
                        <div className="rep-kpi"><p className="rep-kpi__label">Avg. CTR</p><p className="rep-kpi__value">{gscPct(gsc.totals.ctr)}</p></div>
                        <div className="rep-kpi"><p className="rep-kpi__label">Avg. position</p><p className="rep-kpi__value">{gscPos(gsc.totals.position)}</p></div>
                      </div>

                      <div className="panel" style={{ marginBottom: "1.4rem" }}>
                        <div className="panel__head"><h3>Top search queries</h3></div>
                        {gsc.queries.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No query data yet.</p> : (
                          <div style={{ overflowX: "auto" }}>
                            <table className="ledger">
                              <thead><tr><th>Query</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th></tr></thead>
                              <tbody>{gsc.queries.map((q) => (<tr key={q.key}><td>{q.key}</td><td>{gscNum(q.clicks)}</td><td>{gscNum(q.impressions)}</td><td>{gscPct(q.ctr)}</td><td>{gscPos(q.position)}</td></tr>))}</tbody>
                            </table>
                          </div>
                        )}
                      </div>

                      <div className="panel">
                        <div className="panel__head"><h3>Top pages</h3></div>
                        {gsc.pages.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No page data yet.</p> : (
                          <div style={{ overflowX: "auto" }}>
                            <table className="ledger">
                              <thead><tr><th>Page</th><th>Clicks</th><th>Impr.</th><th>CTR</th><th>Pos.</th></tr></thead>
                              <tbody>{gsc.pages.map((p) => (<tr key={p.key}><td>{gscShort(p.key)}</td><td>{gscNum(p.clicks)}</td><td>{gscNum(p.impressions)}</td><td>{gscPct(p.ctr)}</td><td>{gscPos(p.position)}</td></tr>))}</tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
