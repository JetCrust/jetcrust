import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Update a property. Slug is immutable (URLs and existing bookings depend on it).
export async function PATCH(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { slug } = await params;
  const existing = await prisma.property.findUnique({ where: { slug } });
  if (!existing) return NextResponse.json({ error: "Property not found." }, { status: 404 });

  const body = await req.json().catch(() => null);
  const data = body?.data;
  if (!data || typeof data !== "object") return NextResponse.json({ error: "Invalid property." }, { status: 400 });
  if (!data.name || !String(data.name).trim()) return NextResponse.json({ error: "Please give the property a name." }, { status: 400 });

  data.slug = slug; // keep the original slug

  await prisma.property.update({
    where: { slug },
    data: {
      status: data.status === "live" ? "live" : "draft",
      order: Number(data.order) || 99,
      name: String(data.name),
      location: String(data.location || ""),
      data: JSON.stringify(data),
    },
  });
  return NextResponse.json({ ok: true });
}

// Delete a property. Blocked if bookings reference it (unpublish instead).
export async function DELETE(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { slug } = await params;

  const bookings = await prisma.booking.count({ where: { propertySlug: slug } });
  if (bookings > 0) {
    return NextResponse.json(
      { error: `This home has ${bookings} booking(s). Unpublish it instead of deleting, so its history is kept.` },
      { status: 409 },
    );
  }
  await prisma.property.delete({ where: { slug } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
