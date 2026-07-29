import Link from "next/link";
import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import { getProperties, imageUrl } from "@/lib/properties";
import { areaName, areaSlug } from "@/lib/seo";

const SITE = process.env.SITE_ORIGIN || "https://jetcrust.com";

export const metadata: Metadata = {
  title: "Destinations | Jet Crust",
  description: "Explore our luxury rentals by destination, from Transylvania to Bucharest.",
  alternates: { canonical: `${SITE}/destinations` },
};

export default async function Destinations() {
  const props = await getProperties();
  const byArea = new Map<string, { label: string; homes: typeof props }>();
  for (const p of props) {
    const slug = areaSlug(p.location);
    if (!slug) continue;
    const g = byArea.get(slug) || { label: areaName(p.location), homes: [] };
    g.homes.push(p);
    byArea.set(slug, g);
  }
  const areas = [...byArea.entries()];

  return (
    <>
      <MarketingHeader />
      <section className="pdp-hero" style={{ minHeight: "38vh" }}>
        <div className="pdp-hero__media" style={{ backgroundImage: "linear-gradient(135deg,#2A3A2C 0%,#1A241B 55%,#10160F 100%)" }} />
        <div className="wrap pdp-hero__inner" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <p className="overline eyebrow-line">Destinations</p>
          <h1 className="pdp-hero__name">Where we host</h1>
          <p className="pdp-hero__tag">Our homes, and the places around them.</p>
        </div>
      </section>
      <main className="section section--cream">
        <div className="wrap">
          <div className="journal-grid">
            {areas.map(([slug, g]) => (
              <Link className="post-card" key={slug} href={`/destinations/${slug}`}>
                <div className="post-card__media" style={{ backgroundImage: `url('${imageUrl(g.homes[0].img_key, g.homes[0].hero_image, 1400)}')` }} />
                <span className="post-card__meta">{g.homes.length} {g.homes.length === 1 ? "home" : "homes"}</span>
                <h3>{g.label}</h3>
                <p>{g.homes.map((h) => h.name).join(", ")}</p>
              </Link>
            ))}
          </div>
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
