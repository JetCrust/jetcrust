import type { MetadataRoute } from "next";
import { getProperties } from "@/lib/properties";
import { getPublishedPosts } from "@/lib/posts";

const BASE = process.env.SITE_ORIGIN || "https://jetcrust.com";

// Regenerate so published Journal posts enter the sitemap without a redeploy.
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const props = (await getProperties()).map((p) => ({
    url: `${BASE}/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.9,
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
    ...props,
    ...journal,
  ];
}
