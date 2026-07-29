import { redirect } from "next/navigation";
import AppHeader from "../../components/AppHeader";
import ConsoleNav from "../../components/ConsoleNav";
import ChannelRates from "../../components/ChannelRates";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { staffScope } from "@/lib/access";

export default async function AdminChannelRates() {
  const scope = await staffScope();
  if (!scope) redirect("/account?next=/admin");
  const slugs = scope.slugs;

  const [props, pendingCount] = await Promise.all([
    getProperties(true),
    prisma.booking.count({ where: { status: "REQUESTED", ...(slugs ? { propertySlug: { in: slugs } } : {}) } }),
  ]);
  const rows = props
    .filter((p) => (slugs ? slugs.includes(p.slug) : true))
    .map((p) => ({ slug: p.slug, name: p.name, base: p.pricing.base_nightly_eur, weekend: p.pricing.weekend_nightly_eur || p.pricing.base_nightly_eur }));

  return (
    <>
      <AppHeader />
      <main className="section section--cream" style={{ minHeight: "70vh" }}>
        <div className="wrap wrap--wide">
          <div className="console">
            <ConsoleNav pendingCount={pendingCount} role={scope.isSuper ? "ADMIN" : "MANAGER"} />
            <div>
              <div className="sec-head" style={{ marginBottom: "1.4rem" }}>
                <p className="overline eyebrow-line">Admin · Accounting</p>
                <h2>Channel rates helper</h2>
                <p className="lead" style={{ marginBottom: 0 }}>The price to list on Airbnb, Booking.com and VRBO so you keep the payout you want after their fees. A calculator, not a push (direct rate push needs partner status).</p>
              </div>
              <ChannelRates properties={rows} />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
