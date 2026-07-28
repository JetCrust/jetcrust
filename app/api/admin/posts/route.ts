import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/posts";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

const schema = z.object({
  title: z.string().min(1).max(200),
  excerpt: z.string().max(400).default(""),
  body: z.string().default(""),
  coverImage: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).default([]),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).default("DRAFT"),
  source: z.string().default("manual"),
});

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "post";
  let slug = root;
  let n = 2;
  while (await prisma.post.findUnique({ where: { slug } })) slug = `${root}-${n++}`;
  return slug;
}

export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please provide at least a title." }, { status: 400 });
  const d = parsed.data;
  const post = await prisma.post.create({
    data: {
      slug: await uniqueSlug(d.title),
      title: d.title,
      excerpt: d.excerpt,
      body: d.body,
      coverImage: d.coverImage || null,
      tags: JSON.stringify(d.tags),
      faq: JSON.stringify(d.faq),
      seoTitle: d.seoTitle || null,
      seoDescription: d.seoDescription || null,
      status: d.status,
      source: d.source,
      publishedAt: d.status === "PUBLISHED" ? new Date() : null,
    },
  });
  return NextResponse.json({ id: post.id, slug: post.slug });
}
