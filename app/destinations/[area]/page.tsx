import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MarketingHeader from "../../components/MarketingHeader";
import MarketingFooter from "../../components/MarketingFooter";
import { getProperties, imageUrl } from "@/lib/properties";
import { getPublishedPosts, parseJson } from "@/lib/posts";
import { areaName, areaSlug, postMatchesArea } from "@/lib/seo";

const SITE = process.env.SITE_ORIGIN || "https://jetcrust.com";
const fmt = (d: Date | null) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "");

async function areaData(areaParam: string) {
  const props = await getProperties();
  const homes = props.filter((p) => areaSlug(p.location) === areaParam);
  if (!homes.length) return null;
  const label = areaName(homes[0].location);
  const posts = (await getPublishedPosts()).filter((p) => postMatchesArea(parseJson<string[]>(p.tags, []), homes[0].location));
  return { homes, label, posts };
}

export async function generateStaticParams() {
  const props = await getProperties();
  return [...new Set(props.map((p) => areaSlug(p.location)))].filter(Boolean).map((area) => ({ area }));
}

export async function generateMetadata({ params }: { params: Promise<{ area: string }> }): Promise<Metadata> {
  const { area } = await params;
  const d = await areaData(area);
  if (!d) return {};
  const title = `${d.label} villas & luxury stays | Jet Crust`;
  const description = `Curated luxury villas and stays in ${d.label}, with private amenities, stories and local guides from Jet Crust. Featuring ${d.homes.map((h) => h.name).join(", ")}. Book directly, no platform fees.`;
  return { title, description, alternates: { canonical: `${SITE}/destinations/${area}` }, openGraph: { title, description, url: `${SITE}/destinations/${area}`, type: "website" } };
}

export default async function DestinationPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  const d = await areaData(area);
  if (!d) notFound();

  return (
    <>
      <MarketingHeader />
      <section className="pdp-hero" style={{ minHeight: "40vh" }}>
        <div className="pdp-hero__media" style={{ backgroundImage: `url('${imageUrl(d.homes[0].img_key, d.homes[0].hero_image, 2000)}')` }} />
        <div className="wrap pdp-hero__inner" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <p className="overline eyebrow-line">Destination</p>
          <h1 className="pdp-hero__name">{d.label}</h1>
          <p className="pdp-hero__tag">Where to stay, and what to do, in {d.label}.</p>
        </div>
      </section>

      <main className="section section--cream">
        <div className="wrap">
          <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
            <p className="overline eyebrow-line">Stays</p>
            <h2>Our homes in {d.label}</h2>
          </div>
          <div className="journal-grid" style={{ marginBottom: "3rem" }}>
            {d.homes.map((h) => (
              <Link className="post-card" key={h.slug} href={`/${h.slug}`}>
                <div className="post-card__media" style={{ backgroundImage: `url('${imageUrl(h.img_key, h.card?.image || h.hero_image, 1400)}')` }} />
                <span className="post-card__meta">{h.location} · from €{h.pricing.base_nightly_eur.toLocaleString("en-US")}/night</span>
                <h3>{h.name}</h3>
                <p>{h.tagline}</p>
              </Link>
            ))}
          </div>

          {d.posts.length > 0 && (
            <>
              <div className="sec-head" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">The Journal</p>
                <h2>Stories from {d.label}</h2>
              </div>
              <div className="journal-grid">
                {d.posts.map((p) => (
                  <Link className="post-card" key={p.id} href={`/journal/${p.slug}`}>
                    <div className="post-card__media" style={p.coverImage ? { backgroundImage: `url('${p.coverImage}')` } : undefined} />
                    <span className="post-card__meta">{parseJson<string[]>(p.tags, [])[0] || d.label} · {fmt(p.publishedAt)}</span>
                    <h3>{p.title}</h3>
                    <p>{p.excerpt}</p>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
      <MarketingFooter />
    </>
  );
}
