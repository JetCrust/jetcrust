import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isOpsOrAdmin } from "@/lib/access";

const schema = z.object({
  email: z.string().email(),
  propertySlug: z.string().min(1),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  priceEur: z.number().positive(),
  note: z.string().max(200).optional(),
});

// Create a private rate for a guest + dates (applied invisibly when they book).
export async function POST(req: Request) {
  if (!(await isOpsOrAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the email, dates and price." }, { status: 400 });
  const d = parsed.data;
  if (new Date(d.checkOut) <= new Date(d.checkIn)) return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });

  const offer = await prisma.privateOffer.create({
    data: {
      email: d.email.toLowerCase().trim(),
      propertySlug: d.propertySlug,
      checkIn: new Date(d.checkIn + "T00:00:00Z"),
      checkOut: new Date(d.checkOut + "T00:00:00Z"),
      priceCents: Math.round(d.priceEur * 100),
      note: d.note?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, id: offer.id });
}

// Void an offer (e.g. set wrong, or no longer needed).
export async function DELETE(req: Request) {
  if (!(await isOpsOrAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await prisma.privateOffer.update({ where: { id }, data: { status: "void" } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
