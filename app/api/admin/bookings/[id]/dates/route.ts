import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { upsertBookingBlock, overlapsExisting } from "@/lib/calendar-blocks";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  force: z.boolean().optional(),
});

// Move or extend a booking from the calendar (drag / resize). Updates the stay
// dates and its availability block together, warning on any overlap first.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid dates." }, { status: 400 });

  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const checkIn = new Date(`${parsed.data.checkIn}T00:00:00Z`);
  const checkOut = new Date(`${parsed.data.checkOut}T00:00:00Z`);
  if (checkOut <= checkIn) return NextResponse.json({ error: "Check-out must be after check-in." }, { status: 400 });

  const clashes = await overlapsExisting(b.propertySlug, checkIn, checkOut, id);
  if (clashes.length > 0 && !parsed.data.force) {
    return NextResponse.json({ error: "overlap", overlap: true, count: clashes.length }, { status: 409 });
  }

  await prisma.booking.update({ where: { id }, data: { checkIn, checkOut } });
  await upsertBookingBlock(id, b.propertySlug, checkIn, checkOut);
  return NextResponse.json({ ok: true });
}
