import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from "./components/CookieBanner";
import AssistantGate from "./components/AssistantGate";

const OG_IMAGE = "/assets/img/castelaria-pool.jpg";
const SITE_DESC = "Exclusive villas, penthouses and retreats where Transylvanian legend meets private sanctuary. Book directly with Jet Crust.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || "https://jetcrust.com"),
  title: "Jet Crust — Curated Luxury Escapes in Remarkable Places",
  description: SITE_DESC,
  // Global social-share defaults; pages with their own openGraph/twitter override these.
  openGraph: {
    type: "website",
    siteName: "Jet Crust",
    locale: "en_US",
    title: "Jet Crust — Curated Luxury Escapes in Remarkable Places",
    description: SITE_DESC,
    images: [{ url: OG_IMAGE, width: 1200, height: 800, alt: "Jet Crust luxury villa" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Jet Crust — Curated Luxury Escapes in Remarkable Places",
    description: SITE_DESC,
    images: [OG_IMAGE],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Jost:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <CookieBanner />
        <AssistantGate />
      </body>
    </html>
  );
}
