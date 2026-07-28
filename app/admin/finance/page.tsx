import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import FinanceFilters from "../../components/FinanceFilters";
import ExpenseManager from "../../components/ExpenseManager";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { buildPL } from "@/lib/accounting";

const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const signed = (c: number) => (c < 0 ? `−${money(-c)}` : money(c));

function monthDefaults() {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

export default async function FinancePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/finance");
  if (role !== "ADMIN") {
    return (
      <>
        <AppHeader />
        <main className="section section--cream" style={{ minHeight: "60vh" }}><div className="wrap"><h2>Not authorized</h2></div></main>
      </>
    );
  }

  const sp = await searchParams;
  const def = monthDefaults();
  const start = sp.start || def.start;
  const end = sp.end || def.end;
  const property = sp.property || "all";

  const pendingCount = await prisma.booking.count({ where: { status: "REQUESTED" } });
  const props = await prisma.property.findMany({ select: { slug: true, name: true }, orderBy: { order: "asc" } });
  const report = await buildPL(new Date(start), new Date(`${end}T23:59:59`), property !== "all" ? property : undefined);
  const t = report.totals;

  const exportHref = `/api/admin/finance/export?start=${start}&end=${end}&property=${property}`;

  const kpis = [
    { label: "Net income", value: money(t.netIncomeCents), hint: `${t.bookings} booking${t.bookings === 1 ? "" : "s"}` },
    { label: "Costs", value: money(t.costsCents), hint: "cleaning, upkeep, supplies" },
    { label: "Commissions", value: money(t.commissionCents), hint: "OTA / partner fees" },
    { label: "Profit (P&L)", value: signed(t.plCents), hint: "income − costs − commissions", strong: true },
  ];

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.2rem" }}>
                <p className="overline eyebrow-line">Finance</p>
                <h2 style={{ fontSize: "clamp(1.8rem,3.4vw,2.4rem)" }}>Profit &amp; loss</h2>
                <p className="lead" style={{ marginBottom: 0 }}>Income, costs and commissions — by property and date range. Export for your accountant.</p>
              </div>

              <FinanceFilters start={start} end={end} property={property} properties={props} exportHref={exportHref} />

              <div className="kpis" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: "1rem", margin: "1.4rem 0" }}>
                {kpis.map((k) => (
                  <div key={k.label} className="panel" style={{ margin: 0, borderColor: k.strong ? "var(--brass)" : undefined }}>
                    <p className="panel__hint" style={{ marginBottom: "0.3rem" }}>{k.label}</p>
                    <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: "1.7rem", color: k.strong ? "var(--brass)" : "var(--ink)" }}>{k.value}</p>
                    <p style={{ margin: "0.2rem 0 0", fontSize: "0.78rem", color: "var(--stone)" }}>{k.hint}</p>
                  </div>
                ))}
              </div>

              <div className="panel">
                <div className="panel__head"><h3>Income breakdown</h3></div>
                <ul className="kv">
                  <li><span>Stays &amp; add-ons</span><span>{money(t.stayCents)}</span></li>
                  <li><span>Extras (bar, services)</span><span>{money(t.extrasCents)}</span></li>
                  <li><span>Deposit captures (damage)</span><span>{money(t.depositCents)}</span></li>
                  <li><span>Gross income</span><span>{money(t.grossCents)}</span></li>
                  <li><span>Refunds</span><span>−{money(t.refundsCents)}</span></li>
                  <li style={{ fontWeight: 600 }}><span>Net income</span><span>{money(t.netIncomeCents)}</span></li>
                  <li><span>Costs</span><span>−{money(t.costsCents)}</span></li>
                  <li><span>Commissions</span><span>−{money(t.commissionCents)}</span></li>
                  <li style={{ fontWeight: 700, color: "var(--brass)" }}><span>Profit (P&amp;L)</span><span>{signed(t.plCents)}</span></li>
                </ul>
              </div>

              {report.byProperty.length > 0 && (
                <div className="panel">
                  <div className="panel__head"><h3>By property</h3></div>
                  <div style={{ overflowX: "auto" }}>
                    <table className="ledger">
                      <thead>
                        <tr><th>Property</th><th>Bookings</th><th>Net income</th><th>Costs</th><th>Commission</th><th>Profit</th></tr>
                      </thead>
                      <tbody>
                        {report.byProperty.map((p) => (
                          <tr key={p.propertySlug}>
                            <td>{p.name}</td>
                            <td>{p.bookings}</td>
                            <td>{money(p.netIncomeCents)}</td>
                            <td>{money(p.costsCents)}</td>
                            <td>{money(p.commissionCents)}</td>
                            <td style={{ fontWeight: 600 }}>{signed(p.plCents)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <ExpenseManager properties={props} start={start} end={end} property={property} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
