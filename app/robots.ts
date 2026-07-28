import type { MetadataRoute } from "next";

const BASE = process.env.SITE_ORIGIN || "https://jetcrust.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/account", "/admin", "/api/"] },
    sitemap: `${BASE}/sitemap.xml`,
  };
}
