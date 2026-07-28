import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { sendEmail } from "@/lib/email";
import { toBookingData } from "@/lib/booking-data";
import { guestChangeAdminEmail } from "@/lib/emails";

const schema = z.object({
  addons: z.array(z.string()).optional(),
  guests: z.number().int().min(1).max(64).optional(),
  message: z.string().max(2000).optional(),
});

// Guest self-service: update add-ons, adjust guest count (within capacity), or send a change
// request. Add-ons and guest count apply directly; anything else is a message to the host.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { id } = await params;

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });

  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
  if (!booking) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (booking.userId !== userId) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (["DECLINED", "CANCELLED", "EXPIRED"].includes(booking.status)) {
    return NextResponse.json({ error: "This booking can no longer be changed." }, { status: 409 });
  }

  const property = await getProperty(booking.propertySlug);
  const changes: string[] = [];
  const data: { addons?: string; guests?: number } = {};

  if (parsed.data.addons) {
    const valid = new Set((property?.addons || []).map((a) => a.value));
    const clean = parsed.data.addons.filter((a) => valid.has(a));
    data.addons = JSON.stringify(clean);
    const titles = clean.map((v) => property?.addons.find((a) => a.value === v)?.title || v);
    changes.push(`Add-ons: ${titles.length ? titles.join(", ") : "none"}`);
  }
  if (typeof parsed.data.guests === "number") {
    const cap = property?.capacity.sleeps ?? 64;
    if (parsed.data.guests > cap) {
      return NextResponse.json({ error: `This home sleeps up to ${cap}.` }, { status: 400 });
    }
    data.guests = parsed.data.guests;
    changes.push(`Guests: ${parsed.data.guests}`);
  }

  if (Object.keys(data).length) {
    await prisma.booking.update({ where: { id }, data });
  }
  if (parsed.data.message) changes.push(`Message: ${parsed.data.message}`);

  // Notify the host of the change (best effort).
  if (changes.length) {
    const fresh = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
    const bd = await toBookingData(fresh!, fresh!.user);
    const mail = guestChangeAdminEmail(bd, changes.join("\n"));
    const adminTo = process.env.EMAIL_ADMIN;
    if (adminTo) await sendEmail({ to: adminTo, subject: mail.subject, html: mail.html });
  }

  return NextResponse.json({ ok: true });
}
