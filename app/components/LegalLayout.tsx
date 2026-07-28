import MarketingHeader from "./MarketingHeader";
import MarketingFooter from "./MarketingFooter";
import WhatsAppButton from "./WhatsAppButton";
import ClientInteractions from "./ClientInteractions";

export default function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <MarketingHeader />
      <section className="pdp-hero" style={{ minHeight: "40vh" }}>
        <div className="pdp-hero__media" style={{ backgroundImage: "linear-gradient(135deg,#2A3A2C 0%,#1A241B 55%,#10160F 100%)" }} />
        <div className="wrap pdp-hero__inner" style={{ paddingTop: 40, paddingBottom: 40 }}>
          <p className="overline eyebrow-line">Legal</p>
          <h1 className="pdp-hero__name">{title}</h1>
        </div>
      </section>
      <main className="section section--cream">
        <div className="wrap">
          <article className="legal">
            <p className="updated">Last updated {updated}</p>
            <p className="disclaimer">
              This document is a template prepared for Jet Crust. Please review it with legal counsel and complete the
              details marked in brackets before you rely on it.
            </p>
            {children}
          </article>
        </div>
      </main>
      <MarketingFooter />
      <WhatsAppButton />
      <ClientInteractions />
    </>
  );
}
