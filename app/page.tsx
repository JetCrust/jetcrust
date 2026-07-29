import Link from "next/link";
import type { Metadata } from "next";
import MarketingHeader from "./components/MarketingHeader";
import MarketingFooter from "./components/MarketingFooter";
import WhatsAppButton from "./components/WhatsAppButton";
import ClientInteractions from "./components/ClientInteractions";
import { getProperties, imageUrl, priceLabel, type Property } from "@/lib/properties";

export const metadata: Metadata = {
  title: "Luxury Villas & Penthouses in Transylvania & Bucharest | Jet Crust",
  description:
    "Hand-selected luxury estates and penthouses in Transylvania and Bucharest. Historic villa near Bran Castle with a marble pool and private cinema. Direct booking, no platform fees.",
  alternates: { canonical: process.env.SITE_ORIGIN || "https://jetcrust.com" },
};

export default async function Home() {
  const properties = await getProperties();
  const estates = properties.filter((p) => p.tier !== "residence");
  const residences = properties.filter((p) => p.tier === "residence");
  const heroImg = imageUrl("castelaria", "castelaria-pool", 2000);
  const heroStyle = {
    backgroundImage: `linear-gradient(180deg, rgba(14,17,14,0.34) 0%, rgba(14,17,14,0.12) 38%, rgba(14,17,14,0.78) 100%), url('${heroImg}')`,
  };

  return (
    <>
      <MarketingHeader />

      {/* HERO */}
      <section className="hero">
        <div className="hero__media slot has-photo" id="heroMedia" style={heroStyle} />
        <div className="wrap hero__inner">
          <p className="overline eyebrow-line">Transylvania · Bucharest · Beyond</p>
          <h1 className="hero__title">Where legend meets <em>private sanctuary</em></h1>
          <p className="hero__sub">
            Luxury villas in Transylvania near Bran Castle and a lakeside penthouse in Bucharest, hosted with quiet
            precision. Extraordinary homes for travellers who expect more than a room. Book direct, with no platform fees.
          </p>
          <div className="hero__actions">
            <a className="btn btn--brass" href="#collection">Check dates &amp; reserve</a>
            <a className="btn btn--ghost-light" href="#enquire">Talk to us</a>
          </div>
        </div>
        <div className="hero__scroll">Scroll to discover</div>
      </section>

      {/* TRUST BAR */}
      <section className="trust" aria-label="Why Jet Crust">
        <div className="trust__grid">
          <div className="trust__item"><h4>Personally Selected</h4><p>Every home is visited, vetted and chosen by us</p></div>
          <div className="trust__item"><h4>Hosted With Care</h4><p>Owner-managed stays with concierge on request</p></div>
          <div className="trust__item"><h4>Direct &amp; Discreet</h4><p>Book with us, no platform layers or surprises</p></div>
        </div>
      </section>

      {/* COLLECTION */}
      <section className="section section--cream" id="collection">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="overline eyebrow-line">The Collection</p>
            <h2>A small collection, chosen without compromise</h2>
            <p className="lead">
              We would rather offer a handful of remarkable homes than a catalogue of ordinary ones. Each stay below
              is one we would happily book ourselves.
            </p>
          </div>
          <div className="collection">
            {estates.map((p: Property) => (
              <article className="property reveal" key={p.slug}>
                <div className="property__figure">
                  <div
                    className="property__media slot has-photo"
                    style={{ backgroundImage: `url('${imageUrl(p.img_key, p.card.image, 1400)}')` }}
                  />
                </div>
                <div className="property__meta">
                  <span className="property__loc">{p.location}</span>
                  <span className="property__price">{priceLabel(p)}</span>
                </div>
                <h3 className="property__name">{p.name}</h3>
                <p className="property__desc">{p.card.desc}</p>
                <div className="property__tags">
                  {p.card.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
                </div>
                <div className="property__foot">
                  <Link className="textlink" href={`/${p.slug}`}>
                    Explore {p.name} <span className="arw">&rarr;</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>

          {residences.length > 0 && (
            <div style={{ marginTop: "3.5rem" }}>
              <div className="sec-head reveal" style={{ marginBottom: "1.6rem" }}>
                <p className="overline eyebrow-line">City Residences</p>
                <h2 style={{ fontSize: "clamp(1.6rem,3vw,2rem)" }}>For a shorter city stay</h2>
                <p className="lead">Refined apartments in the city, for a night or two between the estates. Same standard of hosting, a more intimate scale.</p>
              </div>
              <div className="collection">
                {residences.map((p: Property) => (
                  <article className="property reveal" key={p.slug}>
                    <div className="property__figure">
                      <div className="property__media slot has-photo" style={{ backgroundImage: `url('${imageUrl(p.img_key, p.card.image, 1400)}')` }} />
                    </div>
                    <div className="property__meta">
                      <span className="property__loc">{p.location}</span>
                      <span className="property__price">{priceLabel(p)}</span>
                    </div>
                    <h3 className="property__name">{p.name}</h3>
                    <p className="property__desc">{p.card.desc}</p>
                    <div className="property__tags">
                      {p.card.tags.map((t) => <span className="tag" key={t}>{t}</span>)}
                    </div>
                    <div className="property__foot">
                      <Link className="textlink" href={`/${p.slug}`}>Explore {p.name} <span className="arw">&rarr;</span></Link>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* OUR STANDARD */}
      <section className="section section--forest" id="edge">
        <div className="wrap edge">
          <div
            className="edge__media slot has-photo reveal"
            style={{ backgroundImage: `url('${imageUrl("castelaria", "castelaria-06", 1400)}')` }}
          />
          <div className="reveal">
            <p className="overline eyebrow-line">Our Standard</p>
            <h2>The Jet Crust difference</h2>
            <p className="lead">
              Romania is one of Europe&apos;s most quietly extraordinary destinations, and it is barely represented on
              the platforms most travellers know. That gap is our advantage, and yours.
            </p>
            <ul className="edge__list">
              <li><span className="edge__num">01</span><div><h4>Selected in person</h4><p>We only list homes we have stood inside. If it would not impress us, it does not join the collection.</p></div></li>
              <li><span className="edge__num">02</span><div><h4>Historic meets modern</h4><p>Centuries-old character paired with the amenities you actually want. Legend on the outside, sanctuary within.</p></div></li>
              <li><span className="edge__num">03</span><div><h4>Looked after, personally</h4><p>Direct hosts, local knowledge and concierge on request. A real person answers, every time.</p></div></li>
            </ul>
          </div>
        </div>
      </section>

      {/* EXPERIENCES */}
      <section className="section section--cream" id="experiences">
        <div className="wrap">
          <div className="sec-head center reveal">
            <p className="overline eyebrow-line" style={{ justifyContent: "center" }}>Ways to Stay</p>
            <h2>Find your kind of escape</h2>
            <p className="lead" style={{ marginInline: "auto" }}>Discover our homes by the feeling you are looking for, not just the map.</p>
          </div>
          <div className="exp-grid">
            <a className="exp reveal" href="#collection">
              <div className="exp__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("castelaria", "castelaria-08", 800)}')` }} />
              <div className="exp__body"><h3>Historic Luxury</h3><p>Estates with a story, restored for the way we live now.</p></div>
            </a>
            <a className="exp reveal" href="#collection">
              <div className="exp__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("marque", "marque-08", 800)}')` }} />
              <div className="exp__body"><h3>Views &amp; Privacy</h3><p>Homes that keep the world at a distance and the horizon close.</p></div>
            </a>
            <a className="exp reveal" href="#collection">
              <div className="exp__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("soho", "soho-02", 800)}')` }} />
              <div className="exp__body"><h3>Cultural Immersion</h3><p>Dracula lore, mountain villages and quiet Romanian ritual.</p></div>
            </a>
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="section section--ink" id="testimonials">
        <div className="wrap">
          <div className="quote-wrap">
            <p className="overline eyebrow-line" style={{ justifyContent: "center" }}>In Their Words</p>
            <blockquote className="quote active">
              Castelaria is a luxurious gem in Bran. The indoor marble pool, the saunas, the private theatre. Every
              detail felt considered. Perfect for a memorable and exclusive getaway.
              <span className="quote__author">Olivia S. · Castelaria</span>
            </blockquote>
            <blockquote className="quote">
              We booked directly and were looked after from the first message to the last morning. This is how travel
              to Romania should feel.
              <span className="quote__author">Marcus &amp; Lena · MarqueDeLago</span>
            </blockquote>
            <blockquote className="quote">
              The blend of history and comfort is unlike anywhere we have stayed in Europe. We are already planning the
              next visit.
              <span className="quote__author">The Ardelean Family · Castelaria</span>
            </blockquote>
            <div className="quote-dots" id="quoteDots" aria-label="Choose testimonial">
              <button className="active" aria-label="Testimonial 1"></button>
              <button aria-label="Testimonial 2"></button>
              <button aria-label="Testimonial 3"></button>
            </div>
          </div>
        </div>
      </section>

      {/* DESTINATIONS */}
      <section className="section section--stone" id="destinations">
        <div className="wrap">
          <div className="sec-head reveal">
            <p className="overline eyebrow-line">Destinations</p>
            <h2>Where we are, and where we are going</h2>
            <p className="lead">A collection that grows with intention. New homes and new destinations join only when they meet the standard.</p>
          </div>
          <div className="dest-grid">
            <a className="dest reveal" href="#collection">
              <div className="dest__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("castelaria", "castelaria-01", 800)}')` }} />
              <div className="dest__body"><h3>Bran</h3><p>Transylvania</p></div>
            </a>
            <a className="dest reveal" href="#collection">
              <div className="dest__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("marque", "marque-14", 800)}')` }} />
              <div className="dest__body"><h3>Bucharest</h3><p>Capital</p></div>
            </a>
            <a className="dest dest--soon reveal" href="#collection">
              <span className="dest__badge">Coming Soon</span>
              <div className="dest__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("soho", "soho-15", 800)}')` }} />
              <div className="dest__body"><h3>Los Angeles</h3><p>Register interest</p></div>
            </a>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="section cta-band" id="enquire">
        <div className="cta-band__media slot has-photo" style={{ backgroundImage: `url('${imageUrl("castelaria", "castelaria-hero", 2000)}')` }} />
        <div className="wrap">
          <p className="overline eyebrow-line" style={{ justifyContent: "center" }}>Ready When You Are</p>
          <h2>Check dates and reserve</h2>
          <p className="lead">Pick your home, see live availability and pricing, and hold your dates in minutes. Prefer to talk it through? We are a message or a call away.</p>
          <div className="cta-band__actions">
            <a className="btn btn--brass" href="#collection">Check dates &amp; reserve</a>
            <a className="btn btn--ghost-light" href="tel:+40770111555">Call us</a>
          </div>
        </div>
      </section>

      <MarketingFooter />
      <WhatsAppButton />
      <ClientInteractions />
    </>
  );
}
