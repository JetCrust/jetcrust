import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { upsertBookingBlock, overlapsExisting } from "@/lib/calendar-blocks";

const schema = z.object({
  propertySlug: z.string().min(1),
  guestName: z.string().min(1).max(120),
  guestEmail: z.string().email().optional().or(z.literal("")),
  checkIn: z.string(),
  checkOut: z.string(),
  guests: z.number().int().positive().max(64).default(2),
  amountEur: z.number().nonnegative().default(0),
  note: z.string().max(300).optional(),
  force: z.boolean().optional(), // proceed despite an overlap
});

// Admin creates a booking directly (phone/email/repeat guest, or an OTA stay we
// want in our own system). Attaches to an existing guest by email, or creates a
// light guest account so the stay still lives in the CRM.
export async function POST(req: Request) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const d = parsed.data;

  const checkIn = new Date(`${d.checkIn}T00:00:00Z`);
  const checkOut = new Date(`${d.checkOut}T00:00:00Z`);
  if (checkOut <= checkIn) return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });

  const property = await getProperty(d.propertySlug);
  if (!property) return NextResponse.json({ error: "Unknown property." }, { status: 400 });

  const clashes = await overlapsExisting(d.propertySlug, checkIn, checkOut);
  if (clashes.length > 0 && !d.force) {
    return NextResponse.json({ error: "overlap", overlap: true, count: clashes.length }, { status: 409 });
  }

  // Find or create the guest.
  const email = d.guestEmail && d.guestEmail.length > 0
    ? d.guestEmail.toLowerCase()
    : `manual+${crypto.randomUUID().slice(0, 8)}@guest.jetcrust.com`;
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const passwordHash = await bcrypt.hash(crypto.randomUUID(), 10);
    user = await prisma.user.create({ data: { email, name: d.guestName.trim(), passwordHash, role: "GUEST" } });
  }

  const amountCents = Math.round(d.amountEur * 100);
  const booking = await prisma.booking.create({
    data: {
      propertySlug: d.propertySlug,
      userId: user.id,
      checkIn, checkOut,
      guests: d.guests,
      status: "APPROVED",
      approvedAt: new Date(),
      amountCents,
      depositCents: amountCents,
      balanceCents: 0,
      note: d.note?.trim() || "Added manually by the team",
      securityCents: Math.round((Number(property.pricing?.deposit_eur) || 0) * 100),
    },
  });
  await upsertBookingBlock(booking.id, d.propertySlug, checkIn, checkOut);

  return NextResponse.json({ ok: true, bookingId: booking.id });
}
