import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Add or remove a single incoming iCal feed (Airbnb / Booking.com / VRBO ...) on a
// property, without loading the whole property editor. Keeps ical_urls unique.
async function readUrls(slug: string) {
  const existing = await prisma.property.findUnique({ where: { slug } });
  if (!existing) return null;
  const data = JSON.parse(existing.data) as Record<string, unknown>;
  const urls = Array.isArray(data.ical_urls) ? (data.ical_urls as string[]) : [];
  return { data, urls };
}

async function save(slug: string, data: Record<string, unknown>, urls: string[]) {
  data.ical_urls = urls;
  await prisma.property.update({ where: { slug }, data: { data: JSON.stringify(data) } });
}

export async function POST(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const url = String(body?.url || "").trim();
  if (!/^https?:\/\/.+/i.test(url)) return NextResponse.json({ error: "Please paste a full https:// calendar link." }, { status: 400 });

  const found = await readUrls(slug);
  if (!found) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  if (found.urls.includes(url)) return NextResponse.json({ error: "That calendar is already connected." }, { status: 409 });

  await save(slug, found.data, [...found.urls, url]);
  return NextResponse.json({ ok: true, urls: [...found.urls, url] });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const { slug } = await params;
  const body = await req.json().catch(() => null);
  const url = String(body?.url || "").trim();

  const found = await readUrls(slug);
  if (!found) return NextResponse.json({ error: "Property not found." }, { status: 404 });
  const next = found.urls.filter((u) => u !== url);
  await save(slug, found.data, next);
  // Drop this property's imported blocks so a removed feed stops blocking; next sync repopulates from the rest.
  await prisma.availabilityBlock.deleteMany({ where: { propertySlug: slug, source: "ICAL" } });
  return NextResponse.json({ ok: true, urls: next });
}
