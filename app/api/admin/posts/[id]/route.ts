import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

const schema = z.object({
  title: z.string().min(1).max(200).optional(),
  excerpt: z.string().max(400).optional(),
  body: z.string().optional(),
  coverImage: z.string().optional().nullable(),
  tags: z.array(z.string()).optional(),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).optional(),
  seoTitle: z.string().optional().nullable(),
  seoDescription: z.string().optional().nullable(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  const existing = await prisma.post.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid data." }, { status: 400 });
  const d = parsed.data;

  const data: Record<string, unknown> = {};
  if (d.title !== undefined) data.title = d.title;
  if (d.excerpt !== undefined) data.excerpt = d.excerpt;
  if (d.body !== undefined) data.body = d.body;
  if (d.coverImage !== undefined) data.coverImage = d.coverImage || null;
  if (d.tags !== undefined) data.tags = JSON.stringify(d.tags);
  if (d.faq !== undefined) data.faq = JSON.stringify(d.faq);
  if (d.seoTitle !== undefined) data.seoTitle = d.seoTitle || null;
  if (d.seoDescription !== undefined) data.seoDescription = d.seoDescription || null;
  if (d.status !== undefined) {
    data.status = d.status;
    // Set publishedAt the first time it goes live.
    if (d.status === "PUBLISHED" && !existing.publishedAt) data.publishedAt = new Date();
  }

  await prisma.post.update({ where: { id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { id } = await params;
  await prisma.post.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
