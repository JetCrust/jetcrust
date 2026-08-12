import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MarketingHeader from "../../components/MarketingHeader";
import MarketingFooter from "../../components/MarketingFooter";
import WhatsAppButton from "../../components/WhatsAppButton";
import ClientInteractions from "../../components/ClientInteractions";
import { getPostBySlug, getPublishedPosts, renderMarkdown, parseJson, readTime, type Faq } from "@/lib/posts";

const BASE = process.env.SITE_ORIGIN || "https://jetcrust.com";

// Prerender known posts; render newly published ones on demand and cache briefly.
export const revalidate = 300;

export async function generateStaticParams() {
  const posts = await getPublishedPosts();
  return posts.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p || p.status !== "PUBLISHED") return {};
  const SITE = process.env.SITE_ORIGIN || "https://jetcrust.com";
  const img = p.coverImage || "/assets/img/castelaria-pool.jpg";
  return {
    title: p.seoTitle || `${p.title} | Jet Crust`,
    description: p.seoDescription || p.excerpt,
    alternates: { canonical: `${SITE}/journal/${p.slug}` },
    openGraph: {
      type: "article", siteName: "Jet Crust", locale: "en_US",
      url: `${SITE}/journal/${p.slug}`,
      title: p.title, description: p.excerpt,
      images: [{ url: img, alt: p.title }],
    },
    twitter: { card: "summary_large_image", title: p.title, description: p.excerpt, images: [img] },
  };
}

function fmt(d: Date | null) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = await getPostBySlug(slug);
  if (!p || p.status !== "PUBLISHED") notFound();

  const tags = parseJson<string[]>(p.tags, []);
  const faq = parseJson<Faq[]>(p.faq, []);
  const html = renderMarkdown(p.body);

  const articleLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: p.title,
    description: p.excerpt,
    image: p.coverImage ? [p.coverImage.startsWith("http") ? p.coverImage : BASE + p.coverImage] : [],
    datePublished: p.publishedAt?.toISOString(),
    dateModified: p.updatedAt.toISOString(),
    author: { "@type": "Organization", name: "Jet Crust" },
    publisher: { "@type": "Organization", name: "Jet Crust" },
    mainEntityOfPage: `${BASE}/journal/${p.slug}`,
  };
  const faqLd = faq.length
    ? {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      }
    : null;

  return (
    <>
      <MarketingHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <section className="pdp-hero" style={{ minHeight: "52vh" }}>
        <div className="pdp-hero__media" style={p.coverImage ? { backgroundImage: `url('${p.coverImage}')` } : { backgroundImage: "linear-gradient(135deg,#2A3A2C,#10160F)" }} />
        <div className="wrap pdp-hero__inner" style={{ paddingTop: 40 }}>
          <p className="overline eyebrow-line">{tags[0] || "The Journal"}</p>
          <h1 className="pdp-hero__name" style={{ fontSize: "clamp(2.2rem,5vw,4rem)" }}>{p.title}</h1>
          <p className="pdp-hero__tag">{fmt(p.publishedAt)} · {readTime(p.body)} min read</p>
        </div>
      </section>

      <main className="section section--cream">
        <div className="wrap">
          <article className="article">
            <p className="lead" style={{ fontSize: "1.2rem", marginBottom: "2rem" }}>{p.excerpt}</p>
            <div dangerouslySetInnerHTML={{ __html: html }} />

            {faq.length > 0 && (
              <section style={{ marginTop: "3rem" }}>
                <h2>Frequently asked questions</h2>
                {faq.map((f, i) => (
                  <div className="faq-item" key={i}>
                    <h4>{f.q}</h4>
                    <p>{f.a}</p>
                  </div>
                ))}
              </section>
            )}

            <p style={{ marginTop: "3rem" }}><Link className="textlink" href="/journal">&larr; Back to the Journal</Link></p>
          </article>
        </div>
      </main>

      <MarketingFooter />
      <WhatsAppButton />
      <ClientInteractions />
    </>
  );
}
