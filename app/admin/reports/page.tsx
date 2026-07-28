import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import ReportsFilters from "../../components/ReportsFilters";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildPerformance, type Performance } from "@/lib/reports";

const money = (c: number) => `€${Math.round(c / 100).toLocaleString("en-US")}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const nights = (n: number) => `${n.toFixed(1)} nights`;

function monthDefaults() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1)); // YTD by default
  const end = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/reports");
  if (role !== "ADMIN") {
    return (<><AppHeader /><main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main></>);
  }

  const sp = await searchParams;
  const def = monthDefaults();
  const start = sp.start || def.start;
  const end = sp.end || def.end;
  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const perf = await buildPerformance(new Date(`${start}T00:00:00Z`), new Date(`${end}T23:59:59Z`));
  const t = perf.totals;

  const kpis = [
    { label: "Occupancy", value: pct(t.occupancy) },
    { label: "ADR", value: money(t.adrCents), hint: "avg nightly rate" },
    { label: "RevPAR", value: money(t.revparCents), hint: "revenue per available night" },
    { label: "Revenue", value: money(t.totalRevenueCents), hint: `${t.bookings} bookings` },
    { label: "Avg stay", value: nights(t.avgStayNights) },
    { label: "Cancellations", value: pct(t.cancellationRate), hint: "of decided requests" },
  ];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Performance</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Reports &amp; performance</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Occupancy, rate and revenue intelligence — to learn your pricing across seasons. Export the numbers for your accountant.</p>
              </div>

              <ReportsFilters start={start} end={end} exportHref={`/api/admin/reports/export?start=${start}&end=${end}`} />

              <div className="rep-kpis">
                {kpis.map((k) => (
                  <div key={k.label} className="rep-kpi">
                    <p className="rep-kpi__label">{k.label}</p>
                    <p className="rep-kpi__value">{k.value}</p>
                    {k.hint && <p className="rep-kpi__hint">{k.hint}</p>}
                  </div>
                ))}
              </div>

              <div className="rep-charts">
                <div className="panel" style={{ margin: 0 }}>
                  <div className="panel__head"><h3>Revenue by month</h3></div>
                  <RevenueLine data={perf.monthlyRevenue} year={new Date(`${start}T00:00:00Z`).getUTCFullYear()} />
                </div>
                <div className="panel" style={{ margin: 0 }}>
                  <div className="panel__head"><h3>Occupancy by property</h3></div>
                  <OccupancyBars data={perf.byProperty} />
                </div>
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Property comparison</h3></div>
                <div style={{ overflowX: "auto" }}>
                  <table className="ledger">
                    <thead><tr><th>Property</th><th>Occupancy</th><th>ADR</th><th>RevPAR</th><th>Revenue</th><th>Bookings</th><th>Avg stay</th></tr></thead>
                    <tbody>
                      {perf.byProperty.map((p) => (
                        <tr key={p.slug}>
                          <td>{p.name}</td>
                          <td>{pct(p.occupancy)}</td>
                          <td>{money(p.adrCents)}</td>
                          <td>{money(p.revparCents)}</td>
                          <td>{money(p.roomRevenueCents)}</td>
                          <td>{p.bookings}</td>
                          <td>{p.avgStayNights ? nights(p.avgStayNights) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="panel__hint" style={{ marginTop: "0.8rem", marginBottom: 0 }}>
                  Booking source: {perf.sources.map((s) => `${s.label} ${s.bookings}`).join(" · ")}. Full accounting (utilities, tax, P&amp;L) lives in your accounting software — use Export to feed it.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

/* ---- Pure-SVG charts (server-rendered) ---- */
function RevenueLine({ data, year }: { data: Performance["monthlyRevenue"]; year: number }) {
  const W = 640, H = 220, pad = { l: 44, r: 12, t: 14, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(1, ...data.map((d) => Math.max(d.thisYear, d.lastYear)));
  const x = (i: number) => pad.l + (i / (data.length - 1)) * iw;
  const y = (v: number) => pad.t + ih - (v / max) * ih;
  const path = (key: "thisYear" | "lastYear") => data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d[key]).toFixed(1)}`).join(" ");
  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const hasLast = data.some((d) => d.lastYear > 0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rep-svg" role="img" aria-label="Revenue by month">
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize={9} fill="var(--stone)">€{Math.round(v / 100 / 1000)}k</text>
        </g>
      ))}
      {hasLast && <path d={path("lastYear")} fill="none" stroke="var(--stone)" strokeWidth={1.5} strokeDasharray="4 4" opacity={0.6} />}
      <path d={path("thisYear")} fill="none" stroke="var(--brass)" strokeWidth={2.5} />
      {data.map((d, i) => <circle key={i} cx={x(i)} cy={y(d.thisYear)} r={2.5} fill="var(--brass)" />)}
      {data.map((d, i) => <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize={9} fill="var(--stone)">{d.month}</text>)}
      <g transform={`translate(${pad.l},${pad.t - 2})`} fontSize={9}>
        <rect x={0} y={-2} width={10} height={3} fill="var(--brass)" /><text x={14} y={2} fill="var(--ink-soft)">{year}</text>
        {hasLast && (<><rect x={54} y={-2} width={10} height={3} fill="var(--stone)" opacity={0.6} /><text x={68} y={2} fill="var(--ink-soft)">{year - 1}</text></>)}
      </g>
    </svg>
  );
}

function OccupancyBars({ data }: { data: Performance["byProperty"] }) {
  const W = 640, H = 220, pad = { l: 34, r: 12, t: 14, b: 40 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const n = Math.max(1, data.length);
  const bw = Math.min(90, (iw / n) * 0.55);
  const cx = (i: number) => pad.l + (i + 0.5) * (iw / n);
  const y = (v: number) => pad.t + ih - v * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="rep-svg" role="img" aria-label="Occupancy by property">
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
        <g key={i}>
          <line x1={pad.l} x2={W - pad.r} y1={y(f)} y2={y(f)} stroke="var(--line)" strokeWidth={1} />
          <text x={pad.l - 6} y={y(f) + 3} textAnchor="end" fontSize={9} fill="var(--stone)">{Math.round(f * 100)}%</text>
        </g>
      ))}
      {data.map((p, i) => {
        const h = p.occupancy * ih;
        return (
          <g key={p.slug}>
            <rect x={cx(i) - bw / 2} y={pad.t + ih - h} width={bw} height={h} rx={4} fill="#3f6199" />
            <text x={cx(i)} y={pad.t + ih - h - 5} textAnchor="middle" fontSize={9} fill="var(--ink-soft)">{Math.round(p.occupancy * 100)}%</text>
            <text x={cx(i)} y={H - 22} textAnchor="middle" fontSize={9} fill="var(--stone)">{p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
