import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { searchPerformance } from "@/lib/gsc";

export const dynamic = "force-dynamic";

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
const pos = (n: number) => n.toFixed(1);
const num = (n: number) => Math.round(n).toLocaleString("en-US");
const short = (u: string) => u.replace(/^https?:\/\/[^/]+/, "") || "/";

export default async function SearchPerformance() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/search");
  if (role !== "ADMIN") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2><p className="lead">Only a Super Admin can see search performance.</p></div></main></>);
  }
  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } }).catch(() => 0);
  const r = await searchPerformance(28);

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Google Search</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Search performance</h2>
                <p className="lead" style={{ marginBottom: 0 }}>What people search on Google to find you, from Search Console. Last 28 days ({r.start} to {r.end}).</p>
              </div>

              {!r.configured ? (
                <div className="panel"><p style={{ margin: 0, color: "var(--stone)" }}>Not connected yet. Add <strong>GOOGLE_SERVICE_ACCOUNT_KEY</strong> in Vercel → Production (paste the whole service-account JSON), then redeploy.</p></div>
              ) : r.error ? (
                <div className="panel"><p style={{ margin: 0, color: "#a3412e" }}>Search Console error: {r.error}</p></div>
              ) : (
                <>
                  <div className="rep-kpis" style={{ marginBottom: "1.4rem" }}>
                    <div className="rep-kpi"><p className="rep-kpi__label">Clicks</p><p className="rep-kpi__value">{num(r.totals.clicks)}</p></div>
                    <div className="rep-kpi"><p className="rep-kpi__label">Impressions</p><p className="rep-kpi__value">{num(r.totals.impressions)}</p></div>
                    <div className="rep-kpi"><p className="rep-kpi__label">Avg. CTR</p><p className="rep-kpi__value">{pct(r.totals.ctr)}</p></div>
                    <div className="rep-kpi"><p className="rep-kpi__label">Avg. position</p><p className="rep-kpi__value">{pos(r.totals.position)}</p></div>
                  </div>

                  <div className="panel" style={{ marginBottom: "1.4rem" }}>
                    <div className="panel__head"><h3>Top search queries</h3></div>
                    {r.queries.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No query data yet.</p> : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="ledger">
                          <thead><tr><th>Query</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead>
                          <tbody>
                            {r.queries.map((q) => (
                              <tr key={q.key}><td>{q.key}</td><td>{num(q.clicks)}</td><td>{num(q.impressions)}</td><td>{pct(q.ctr)}</td><td>{pos(q.position)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  <div className="panel">
                    <div className="panel__head"><h3>Top pages</h3></div>
                    {r.pages.length === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No page data yet.</p> : (
                      <div style={{ overflowX: "auto" }}>
                        <table className="ledger">
                          <thead><tr><th>Page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead>
                          <tbody>
                            {r.pages.map((p) => (
                              <tr key={p.key}><td>{short(p.key)}</td><td>{num(p.clicks)}</td><td>{num(p.impressions)}</td><td>{pct(p.ctr)}</td><td>{pos(p.position)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
