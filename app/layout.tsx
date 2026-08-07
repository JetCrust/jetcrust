import type { Metadata } from "next";
import "./globals.css";
import CookieBanner from "./components/CookieBanner";
import AssistantGate from "./components/AssistantGate";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_ORIGIN || "https://jetcrust.com"),
  title: "Jet Crust — Curated Luxury Escapes in Remarkable Places",
  description:
    "Exclusive villas, penthouses and retreats where Transylvanian legend meets private sanctuary. Book directly with Jet Crust.",
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
