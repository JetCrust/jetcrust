import Link from "next/link";
import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { unitLabel, type AddonUnit } from "@/lib/pricing";

const money = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

export default async function AdminProperties() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  if (!session) redirect("/account?next=/admin/properties");
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
  const properties = await getProperties(true);

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
                <h2>Properties &amp; pricing</h2>
                <p className="lead" style={{ marginBottom: 0 }}>
                  Add, edit, publish or remove homes, and set their pricing, minimum stay and add-ons. Changes go live
                  immediately. Photos are referenced by file name for now; direct upload arrives once you are on hosting.
                </p>
              </div>

              <div style={{ display: "flex", gap: "0.7rem", flexWrap: "wrap", marginBottom: "1.6rem" }}>
                <Link className="btn btn--brass" href="/admin/properties/new">Add a property</Link>
              </div>

              <div className="stack">
                {properties.map((p) => (
                  <div className="panel" key={p.slug}>
                    <div className="panel__head">
                      <h3>
                        {p.name}{" "}
                        <span className={`pill pill--${p.status === "live" ? "confirmed" : "awaiting-approval"}`} style={{ marginLeft: "0.4rem", verticalAlign: "middle" }}>
                          {p.status === "live" ? "Live" : "Draft"}
                        </span>
                      </h3>
                      <Link className="textlink" href={`/admin/properties/${p.slug}/edit`}>Edit &rarr;</Link>
                    </div>
                    <p className="panel__hint" style={{ marginTop: "-0.4rem" }}>{p.location}</p>

                    <ul className="kv">
                      <li><span>Base nightly</span><span>{money(p.pricing.base_nightly_eur)}</span></li>
                      {p.pricing.weekend_nightly_eur && (
                        <li><span>Weekend nightly</span><span>{money(p.pricing.weekend_nightly_eur)}</span></li>
                      )}
                      <li><span>Minimum stay</span><span>{p.pricing.min_nights} night{p.pricing.min_nights === 1 ? "" : "s"}</span></li>
                      <li><span>Sleeps</span><span>Up to {p.capacity.sleeps}</span></li>
                      {p.pricing.dynamic?.enabled && (
                        <li>
                          <span>Demand pricing</span>
                          <span>On · floor {money(p.pricing.dynamic.floor_eur)} · ceiling {money(p.pricing.dynamic.ceiling_eur)}</span>
                        </li>
                      )}
                    </ul>

                    {(p.pricing.seasonal || []).length > 0 && (
                      <>
                        <p className="panel__hint" style={{ marginTop: "1.2rem", marginBottom: "0.4rem" }}>Seasonal rates</p>
                        <ul className="kv">
                          {(p.pricing.seasonal || []).map((s) => (
                            <li key={s.name}><span>{s.name} ({s.from} to {s.to})</span><span>{money(s.nightly_eur)}</span></li>
                          ))}
                        </ul>
                      </>
                    )}

                    <p className="panel__hint" style={{ marginTop: "1.2rem", marginBottom: "0.4rem" }}>Add-ons</p>
                    <ul className="kv">
                      {(p.addons || []).map((a) => (
                        <li key={a.value}>
                          <span>{a.title}</span>
                          <span>
                            {a.price_eur ? `${money(a.price_eur)} ${unitLabel((a.unit as AddonUnit) || "stay")}` : "Price on request"}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
