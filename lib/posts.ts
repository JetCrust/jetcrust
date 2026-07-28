import { prisma } from "./prisma";
import { marked } from "marked";

export type Faq = { q: string; a: string };

export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false }) as string;
  return html.replace(/<script[\s\S]*?<\/script>/gi, "");
}

export function parseJson<T>(s: string | null | undefined, fallback: T): T {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function slugify(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

export function getPublishedPosts() {
  return prisma.post.findMany({ where: { status: "PUBLISHED" }, orderBy: { publishedAt: "desc" } });
}

export function getAllPosts() {
  return prisma.post.findMany({ orderBy: [{ status: "asc" }, { updatedAt: "desc" }] });
}

export function getPostBySlug(slug: string) {
  return prisma.post.findUnique({ where: { slug } });
}

export function readTime(md: string): number {
  return Math.max(1, Math.round(md.split(/\s+/).length / 200));
}
