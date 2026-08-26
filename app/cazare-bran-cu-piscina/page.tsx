import Link from "next/link";
import type { Metadata } from "next";
import MarketingHeader from "../components/MarketingHeader";
import MarketingFooter from "../components/MarketingFooter";
import { getProperty, imageUrl } from "@/lib/properties";

const SITE = process.env.SITE_ORIGIN || "https://jetcrust.com";
const TITLE = "Cazare în Bran cu Piscină Interioară Încălzită | Castelaria";
const DESC = "Castelaria, vilă de lux în Bran cu piscină interioară din marmură, încălzită, saună, cinema și cramă, la 12 minute de mers pe jos de Castelul Bran. Rezervare directă.";
const OG = `${SITE}${imageUrl("castelaria", "castelaria-pool", 2000)}`;

export const metadata: Metadata = {
  title: TITLE,
  description: DESC,
  alternates: { canonical: `${SITE}/cazare-bran-cu-piscina` },
  openGraph: { type: "website", siteName: "Jet Crust", locale: "ro_RO", url: `${SITE}/cazare-bran-cu-piscina`, title: TITLE, description: DESC, images: [{ url: OG, width: 1200, height: 800, alt: "Piscina interioară de la Castelaria, Bran" }] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESC, images: [OG] },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "LodgingBusiness",
  name: "Castelaria — vilă de lux cu piscină interioară în Bran",
  description: DESC,
  url: `${SITE}/cazare-bran-cu-piscina`,
  image: OG,
  address: { "@type": "PostalAddress", addressLocality: "Bran", addressRegion: "Brașov", addressCountry: "RO" },
  amenityFeature: [
    { "@type": "LocationFeatureSpecification", name: "Piscină interioară încălzită", value: true },
    { "@type": "LocationFeatureSpecification", name: "Saună", value: true },
    { "@type": "LocationFeatureSpecification", name: "Cinema privat", value: true },
  ],
};

export default async function CazareBranPiscina() {
  const p = await getProperty("castelaria");
  const hero = imageUrl("castelaria", "castelaria-pool", 2000);
  const gallery = (p?.gallery.images || []).slice(0, 6).map((g) => imageUrl(p!.img_key, g.file, 1400));

  return (
    <>
      <MarketingHeader />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main lang="ro">
        <section className="hero" style={{ minHeight: "70vh" }}>
          <div className="hero__media" style={{ backgroundImage: `linear-gradient(180deg, rgba(14,17,14,0.38) 0%, rgba(14,17,14,0.2) 40%, rgba(14,17,14,0.82) 100%), url('${hero}')`, backgroundSize: "cover", backgroundPosition: "center" }} />
          <div className="wrap hero__inner" style={{ position: "relative", zIndex: 2 }}>
            <p className="overline" style={{ color: "var(--brass, #c8a76a)" }}>Bran · Transilvania</p>
            <h1 style={{ color: "#fff", maxWidth: "16ch" }}>Cazare în Bran cu piscină interioară încălzită</h1>
            <p className="lead" style={{ color: "rgba(255,255,255,0.9)", maxWidth: "52ch" }}>
              Castelaria este o vilă privată de lux la câțiva pași de Castelul Bran, cu piscină interioară din marmură, saună, sală de cinema și cramă. Un loc rezervat exclusiv pentru voi și invitații voștri.
            </p>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "1.2rem" }}>
              <Link className="btn btn--brass" href="/book/castelaria">Verificați disponibilitatea</Link>
              <Link className="btn btn--ghost-light" href="/castelaria">Descoperiți Castelaria</Link>
            </div>
          </div>
        </section>

        <section className="section section--cream">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="sec-head"><p className="overline eyebrow-line">Vilă de lux cu piscină</p><h2>Căutați cazare în Bran cu piscină interioară?</h2></div>
            <p className="lead">
              Castelaria vă oferă exact asta, și mult mai mult. Este o vilă de lux din inima Transilvaniei, în zona Bran Moeciu, cu o piscină interioară din marmură, încălzită tot anul. Vă puteți bucura de ea în orice sezon, indiferent de vremea de afară.
            </p>
            <p>
              Este locul potrivit pentru o vacanță în familie, o escapadă romantică sau o ocazie specială, la doar 12 minute de mers pe jos de Castelul Bran. Casa poate găzdui până la 16 oaspeți și se închiriază integral, numai pentru grupul vostru.
            </p>
          </div>
        </section>

        <section className="section section--forest">
          <div className="wrap">
            <div className="sec-head center" style={{ textAlign: "center" }}><p className="overline eyebrow-line" style={{ justifyContent: "center" }}>Relaxare completă</p><h2>Piscina interioară din marmură, saună și spa</h2></div>
            <p className="lead" style={{ maxWidth: 720, margin: "0 auto", textAlign: "center" }}>
              Piscina interioară, realizată integral din marmură și încălzită, este disponibilă exclusiv pentru oaspeții vilei. Alături de ea veți găsi o saună uscată și una umedă, pentru o experiență completă de relaxare după o zi petrecută în munți.
            </p>
          </div>
        </section>

        <section className="section section--cream">
          <div className="wrap">
            <div className="sec-head"><p className="overline eyebrow-line">Facilități</p><h2>O casă completă, doar pentru voi</h2></div>
            <div className="feat-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "1.2rem", marginTop: "1.4rem" }}>
              {[
                ["Piscină interioară", "Din marmură, încălzită tot anul, doar pentru oaspeți."],
                ["Saună uscată și umedă", "Pentru relaxare în orice sezon."],
                ["Sală de cinema", "Serile de film, ca acasă, dar mai bine."],
                ["Cramă privată", "Un spațiu dedicat pasionaților de vin."],
                ["Sală de fitness", "Echipamente noi, de nivel profesional."],
                ["Până la 16 oaspeți", "Ideală pentru familii și grupuri de prieteni."],
              ].map(([t, d]) => (
                <div key={t} className="panel" style={{ margin: 0 }}>
                  <h3 style={{ marginBottom: "0.4rem" }}>{t}</h3>
                  <p style={{ margin: 0, color: "var(--ink-soft)" }}>{d}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {gallery.length > 0 && (
          <section className="section section--cream" style={{ paddingTop: 0 }}>
            <div className="wrap">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: "0.8rem" }}>
                {gallery.map((src, i) => (
                  <div key={i} style={{ aspectRatio: "4/3", backgroundImage: `url('${src}')`, backgroundSize: "cover", backgroundPosition: "center", borderRadius: 12 }} />
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="section section--stone">
          <div className="wrap" style={{ maxWidth: 760 }}>
            <div className="sec-head"><p className="overline eyebrow-line">Locație</p><h2>Bran, la poalele Bucegilor</h2></div>
            <p>
              Castelaria se află în Bran, județul Brașov, la doar 12 minute de mers pe jos de celebrul Castel Bran. Zona Bran Moeciu oferă peisaje montane, aer curat și acces facil către atracțiile Transilvaniei. Bucureștiul este la aproximativ trei ore cu mașina.
            </p>
          </div>
        </section>

        <section className="section cta-band" id="rezervare">
          <div className="cta-band__media" style={{ backgroundImage: `url('${imageUrl("castelaria", "castelaria-aerial", 2000)}')` }} />
          <div className="wrap cta-band__inner" style={{ position: "relative", zIndex: 2 }}>
            <h2 style={{ color: "#fff" }}>Rezervați cazare în Bran cu piscină</h2>
            <p className="lead" style={{ color: "rgba(255,255,255,0.9)", maxWidth: "48ch" }}>Rezervare directă prin Jet Crust, cel mai bun preț, fără comisioanele platformelor. Vă răspundem personal și confirmăm datele împreună cu voi.</p>
            <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", marginTop: "1rem" }}>
              <Link className="btn btn--brass" href="/book/castelaria">Verificați disponibilitatea</Link>
              <Link className="btn btn--ghost-light" href="/castelaria">Vedeți toate detaliile</Link>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
