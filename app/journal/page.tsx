import Link from "next/link";
import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import WhatsAppButton from "../components/WhatsAppButton";
import ClientInteractions from "../components/ClientInteractions";
import { getPublishedPosts, parseJson } from "@/lib/posts";

export const metadata: Metadata = {
  title: "The Journal | Jet Crust",
  description: "Guides, itineraries and insider local insight for Bran, Bran Castle, the Transylvanian mountains and Bucharest, written by the Jet Crust team to help you plan an unforgettable luxury stay.",
};

// Read fresh from the DB so newly published posts appear without a redeploy.
export const dynamic = "force-dynamic";

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default async function JournalIndex() {
  const posts = await getPublishedPosts();
  return (
    <>
      <MarketingHeader />
      <section className="pdp-hero" style={{ minHeight: "42vh" }}>
        <div className="pdp-hero__media" style={{ backgroundImage: "linear-gradient(135deg,#2A3A2C 0%,#1A241B 55%,#10160F 100%)" }} />
        <div className="wrap pdp-hero__inner" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <p className="overline eyebrow-line">The Journal</p>
          <h1 className="pdp-hero__name">Stories &amp; guides</h1>
          <p className="pdp-hero__tag">Itineraries, local insight and seasonal highlights for the places we call home.</p>
        </div>
      </section>

      <main className="section section--cream">
        <div className="wrap">
          {posts.length === 0 ? (
            <p className="lead">The first stories are on their way. Check back soon.</p>
          ) : (
            <div className="journal-grid">
              {posts.map((p) => {
                const tags = parseJson<string[]>(p.tags, []);
                return (
                  <Link className="post-card" key={p.id} href={`/journal/${p.slug}`}>
                    <div className="post-card__media" style={p.coverImage ? { backgroundImage: `url('${p.coverImage}')` } : undefined} />
                    <span className="post-card__meta">{tags[0] || "Travel"} · {fmt(p.publishedAt)}</span>
                    <h3>{p.title}</h3>
                    <p>{p.excerpt}</p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <MarketingFooter />
      <WhatsAppButton />
      <ClientInteractions />
    </>
  );
}
