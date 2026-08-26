import type { MetadataRoute } from "next";
import { getProperties } from "@/lib/properties";
import { getPublishedPosts } from "@/lib/posts";
import { areaSlug } from "@/lib/seo";

const BASE = process.env.SITE_ORIGIN || "https://jetcrust.com";

// Regenerate so published Journal posts enter the sitemap without a redeploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const liveProps = await getProperties();
  const props = liveProps.map((p) => ({
    url: `${BASE}/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
  }));
  // One hub per destination area, generated from property locations.
  const areas = [...new Set(liveProps.map((p) => areaSlug(p.location)).filter(Boolean))].map((a) => ({
    url: `${BASE}/destinations/${a}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));
  const posts = await getPublishedPosts();
  const journal = posts.map((p) => ({
    url: `${BASE}/journal/${p.slug}`,
    lastModified: p.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));
  return [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/journal`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/destinations`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${BASE}/cazare-bran-cu-piscina`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: `${BASE}/gdpr`, lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    ...props,
    ...areas,
    ...journal,
  ];
}
