import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import LocalTime from "../../components/LocalTime";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope, slugFilter } from "@/lib/access";

const stars = (n: number) => "★★★★★".slice(0, n) + "☆☆☆☆☆".slice(0, 5 - n);

export default async function AdminReviews() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin/reviews");
  const sf = slugFilter(scope);

  const [pendingCount, reviews, props] = await Promise.all([
    prisma.booking.count({ where: { status: "REQUESTED", ...sf } }),
    prisma.booking.findMany({ where: { reviewRating: { not: null }, ...sf }, include: { user: true }, orderBy: { reviewedAt: "desc" } }),
    getProperties(true),
  ]);
  const nameOf = (s: string) => props.find((p) => p.slug === s)?.name || s;

  const count = reviews.length;
  const avg = count ? reviews.reduce((s, b) => s + (b.reviewRating || 0), 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((b) => b.reviewRating === n).length }));
  const lowCount = reviews.filter((b) => (b.reviewRating || 0) <= 3).length;

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.isSuper ? "ADMIN" : "MANAGER"} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Admin</p>
                <h2>Reviews &amp; ratings</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Every guest&rsquo;s private rating after checkout. Follow up on anything below four stars before it becomes public.</p>
              </div>

              <div className="rep-kpis" style={{ marginBottom: "1.4rem" }}>
                <div className="rep-kpi"><p className="rep-kpi__label">Average rating</p><p className="rep-kpi__value">{count ? avg.toFixed(2) : "—"}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Reviews</p><p className="rep-kpi__value">{count}</p></div>
                <div className="rep-kpi"><p className="rep-kpi__label">Need follow-up (≤3★)</p><p className="rep-kpi__value" style={{ color: lowCount ? "#a3412e" : undefined }}>{lowCount}</p></div>
              </div>

              <div className="panel" style={{ marginBottom: "1.4rem" }}>
                <div className="panel__head"><h3>Distribution</h3></div>
                {count === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>No reviews yet.</p> : (
                  <ul className="kv" style={{ margin: 0 }}>
                    {dist.map(({ n, c }) => (
                      <li key={n}>
                        <span style={{ minWidth: 90 }}>{stars(n)}</span>
                        <span style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1 }}>
                          <span style={{ flex: 1, height: 8, background: "var(--line)", borderRadius: 4, overflow: "hidden" }}>
                            <span style={{ display: "block", height: "100%", width: `${count ? (c / count) * 100 : 0}%`, background: n <= 3 ? "#a3412e" : "var(--forest, #253026)" }} />
                          </span>
                          <span style={{ minWidth: 28, textAlign: "right" }}>{c}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="panel">
                <div className="panel__head"><h3>All reviews</h3><span className="console__count">{count}</span></div>
                {count === 0 ? <p style={{ color: "var(--stone)", margin: 0 }}>Reviews will appear here after guests check out.</p> : (
                  <div className="stack">
                    {reviews.map((b) => {
                      const low = (b.reviewRating || 0) <= 3;
                      return (
                        <div key={b.id} style={{ borderTop: "1px solid var(--line)", paddingTop: "0.9rem" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.8rem", flexWrap: "wrap" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                              <span style={{ color: low ? "#a3412e" : "var(--brass, #9a7b3f)", fontSize: "1.05rem", letterSpacing: "0.05em" }}>{stars(b.reviewRating || 0)}</span>
                              <strong>{nameOf(b.propertySlug)}</strong>
                              {low && <span className="tag" style={{ color: "#a3412e", borderColor: "#a3412e" }}>Follow up</span>}
                            </div>
                            <span style={{ fontSize: "0.8rem", color: "var(--stone)" }}>{b.reviewedAt && <LocalTime iso={b.reviewedAt.toISOString()} />}</span>
                          </div>
                          {b.reviewText && <p style={{ margin: "0.4rem 0 0.5rem", color: "var(--ink-soft)" }}>&ldquo;{b.reviewText}&rdquo;</p>}
                          <div style={{ display: "flex", gap: "1rem", fontSize: "0.85rem", flexWrap: "wrap" }}>
                            <Link className="textlink" href={`/admin/guests/${b.userId}`}>{b.user.name || b.user.email}</Link>
                            <Link className="textlink" href={`/admin/bookings/${b.id}`}>Open booking →</Link>
                            {low && <Link className="textlink" href={`/admin/guests/${b.userId}`} style={{ color: "#a3412e" }}>Message to make it right →</Link>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
