import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import WhatsAppButton from "../components/WhatsAppButton";
import ClientInteractions from "../components/ClientInteractions";
import TrackView from "../components/TrackView";
import Gallery, { type GalleryImage } from "../components/Gallery";
import { getProperties, getProperty, imageUrl, imageSet, type Property } from "@/lib/properties";

export async function generateStaticParams() {
  return (await getProperties()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProperty(slug);
  if (!p) return {};
  return { title: p.seo.title, description: p.seo.description };
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = (await getProperty(slug)) as Property | null;
  if (!p || p.status !== "live") notFound();

  const other = await getProperty(p.cross_sell);
  const galleryImages: GalleryImage[] = p.gallery.images.map((g) => {
    const im = imageSet(p.img_key, g.file);
    return { src: im.src, srcSet: im.srcSet, caption: g.caption };
  });

  return (
    <>
      <TrackView slug={p.slug} />
      <MarketingHeader />

      {/* HERO */}
      <section className="pdp-hero">
        <div className="pdp-hero__media" style={{ backgroundImage: `url('${imageUrl(p.img_key, p.hero_image, 2000)}')` }} />
        <div className="wrap pdp-hero__inner">
          <p className="overline eyebrow-line">{p.location}</p>
          <h1 className="pdp-hero__name">{p.name}</h1>
          <p className="pdp-hero__tag">{p.tagline}</p>
          <div className="pdp-stats">
            {p.hero_stats.map((s) => (
              <div className="pdp-stat" key={s.label}><span className="n">{s.n}</span><span className="l">{s.label}</span></div>
            ))}
          </div>
          <div className="pdp-hero__actions">
            <Link className="btn btn--brass" href={`/book/${p.slug}`}>Check Availability</Link>
            <a className="btn btn--ghost-light" href="#gallery">View the Gallery</a>
          </div>
        </div>
      </section>

      {/* STORY + BOOKING ASIDE */}
      <section className="section section--cream">
        <div className="wrap pdp-intro">
          <div className="pdp-story reveal">
            <p className="overline eyebrow-line">The House</p>
            <h2>{p.story_heading}</h2>
            {p.story.map((para, i) => (
              <p key={i} className={i === 0 ? "drop" : undefined}>{para}</p>
            ))}
          </div>
          <aside className="pdp-aside reveal">
            <div className="price">€{p.pricing.base_nightly_eur.toLocaleString("en-US")} <small>/ night</small></div>
            <div className="rule"></div>
            <ul>
              {p.aside_facts.map((f) => (
                <li key={f.label}>{f.label} <span>{f.value}</span></li>
              ))}
            </ul>
            <Link className="btn btn--brass" href={`/book/${p.slug}`}>Check Availability</Link>
            <p className="note">Direct booking. A real person replies, personally.</p>
          </aside>
        </div>
      </section>

      {/* SIGNATURE FEATURES */}
      <section className="section section--forest">
        <div className="wrap">
          <div className="sec-head reveal"><p className="overline eyebrow-line">The Signatures</p><h2>Reasons guests never quite want to leave</h2></div>
          <div className="features">
            {p.features.map((f) => (
              <div className="feature reveal" key={f.title}>
                <div className="feature__media" style={{ backgroundImage: `url('${imageUrl(p.img_key, f.image, 800)}')` }} />
                <h3>{f.title}</h3>
                <p>{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* GALLERY */}
      <section className="section section--cream" id="gallery">
        <div className="wrap">
          <div className="sec-head center reveal"><p className="overline eyebrow-line" style={{ justifyContent: "center" }}>The Gallery</p><h2>A closer look at {p.name}</h2></div>
          <Gallery images={galleryImages} />
        </div>
      </section>

      {/* AMENITIES */}
      <section className="section section--forest">
        <div className="wrap">
          <div className="sec-head reveal"><p className="overline eyebrow-line">Every Detail</p><h2>What is inside</h2></div>
          <div className="amenities reveal">
            {p.amenities.map((a) => (
              <div className="amen" key={a.category}>
                <h4>{a.category}</h4>
                <ul>{a.items.map((i) => <li key={i}>{i}</li>)}</ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SETTING */}
      <section className="section section--stone">
        <div className="wrap loc-grid">
          <div className="reveal">
            <p className="overline eyebrow-line">The Setting</p>
            <h2 style={{ fontSize: "clamp(1.9rem,3.6vw,2.9rem)" }}>{p.setting.heading}</h2>
            <p className="lead" style={{ marginTop: "1.2rem" }}>{p.setting.lead}</p>
            <ul className="loc-list">
              {p.setting.proximity.map((x) => (
                <li key={x.value}><b>{x.value}</b><span>{x.text}</span></li>
              ))}
            </ul>
          </div>
          <div className="loc-map reveal" style={{ backgroundImage: `url('${imageUrl(p.img_key, p.setting.map_image, 1400)}')` }} aria-label={`${p.name} setting`} />
        </div>
      </section>

      {/* ADD-ONS */}
      <section className="section section--cream">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="overline eyebrow-line">Make It Yours</p>
            <h2>Add the moments that make the stay</h2>
            <p className="lead" style={{ marginTop: "1.2rem" }}>Choose when you book, or add them later from your guest dashboard. We arrange everything before you arrive.</p>
          </div>
          <div className="addons reveal">
            {p.addons.map((a) => (
              <div className="addon" key={a.value}>
                <span className="ic">{a.icon}</span>
                <h4>{a.title}</h4>
                <p>{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOOK CTA */}
      <section className="section cta-band" id="book">
        <div className="cta-band__media" style={{ backgroundImage: `url('${imageUrl(p.img_key, p.hero_image, 2000)}')` }} />
        <div className="wrap">
          <p className="overline eyebrow-line" style={{ justifyContent: "center" }}>Ready When You Are</p>
          <h2>Reserve {p.name}</h2>
          <p className="lead">Check your dates, accept the agreement and place a hold. We confirm personally, and your card is charged only once approved.</p>
          <div className="cta-band__actions">
            <Link className="btn btn--brass" href={`/book/${p.slug}`}>Check Availability</Link>
            <a className="btn btn--ghost-light" href="tel:+40770111555">Call Us</a>
          </div>
        </div>
      </section>

      {/* CROSS-SELL */}
      {other && (
        <section className="cross">
          <div className="cross__media" style={{ backgroundImage: `url('${imageUrl(other.img_key, other.hero_image, 1400)}')` }} />
          <div className="wrap">
            <p className="overline eyebrow-line" style={{ justifyContent: "flex-start" }}>Also in the Collection</p>
            <h2>{other.name}, {other.location}</h2>
            <p className="lead" style={{ color: "rgba(246,241,231,0.86)", margin: "1rem 0 1.8rem", maxWidth: "46ch" }}>{other.tagline}</p>
            <Link className="btn btn--ghost-light" href={`/${other.slug}`}>Discover {other.name}</Link>
          </div>
        </section>
      )}

      <MarketingFooter />
      <WhatsAppButton />
      <ClientInteractions />
    </>
  );
}
