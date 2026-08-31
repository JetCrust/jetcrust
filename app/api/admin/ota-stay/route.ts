import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isOpsOrAdmin } from "@/lib/access";

const schema = z.object({
  propertySlug: z.string().min(1),
  channel: z.string().min(1).max(40),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guestName: z.string().max(120).optional(),
  guests: z.number().int().min(1).max(64).optional(),
});

// Manually add an OTA stay (Airbnb/Booking/VRBO) for check-in/out and the Bookings
// list. otaUid stays null, so the calendar sync never touches or cancels it.
export async function POST(req: Request) {
  if (!(await isOpsOrAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the property, channel and dates." }, { status: 400 });
  const d = parsed.data;
  if (new Date(d.checkOut) <= new Date(d.checkIn)) return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });
  const u = await prisma.user.upsert({
    where: { email: "ota-guest@jetcrust.internal" },
    update: {},
    create: { email: "ota-guest@jetcrust.internal", name: "OTA guest", role: "GUEST", passwordHash: "" },
  });
  const b = await prisma.booking.create({
    data: {
      propertySlug: d.propertySlug, channel: d.channel, guestName: d.guestName?.trim() || `${d.channel} guest`,
      userId: u.id, otaUid: null,
      checkIn: new Date(d.checkIn + "T00:00:00Z"), checkOut: new Date(d.checkOut + "T00:00:00Z"),
      guests: d.guests || 2, amountCents: 0, currency: "eur", status: "APPROVED", addons: "[]", breakdown: "{}",
    },
  });
  return NextResponse.json({ ok: true, id: b.id });
}
