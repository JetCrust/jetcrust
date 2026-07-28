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

// Create a new property from an edited object.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const body = await req.json().catch(() => null);
  const data = body?.data;
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Invalid property." }, { status: 400 });
  if (!data.name || !String(data.name).trim()) return NextResponse.json({ error: "Please give the property a name." }, { status: 400 });

  const slug = await uniqueSlug(data.slug || data.name);
  data.slug = slug;

  const created = await prisma.property.create({
    data: {
      slug,
      status: data.status === "live" ? "live" : "draft",
      order: Number(data.order) || 99,
      name: String(data.name),
      location: String(data.location || ""),
      data: JSON.stringify(data),
    },
  });
  return NextResponse.json({ slug: created.slug });
}
