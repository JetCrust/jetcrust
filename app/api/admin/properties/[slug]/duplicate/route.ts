import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { slugify } from "@/lib/posts";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

async function uniqueSlug(base: string): Promise<string> {
  const root = slugify(base) || "property";
  let slug = root;
  let n = 2;
  while (await prisma.property.findUnique({ where: { slug } })) slug = `${root}-${n++}`;
  return slug;
}

// Duplicate a home as a draft starting point (keeps all the rich content).
export async function POST(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { slug } = await params;
  const src = await prisma.property.findUnique({ where: { slug } });
  if (!src) return NextResponse.json({ error: "Property not found." }, { status: 404 });

  const data = JSON.parse(src.data);
  const newSlug = await uniqueSlug(`${slug}-copy`);
  data.slug = newSlug;
  data.name = `${data.name} (copy)`;
  data.status = "draft";

  const created = await prisma.property.create({
    data: {
      slug: newSlug,
      status: "draft",
      order: (Number(src.order) || 99) + 1,
      name: data.name,
      location: src.location,
      data: JSON.stringify(data),
    },
  });
  return NextResponse.json({ slug: created.slug });
}
