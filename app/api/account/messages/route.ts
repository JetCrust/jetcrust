import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { mostRecentBooking, notifyOtherParty, touchSeen, serializeMessages } from "@/lib/threads";

// The signed-in guest's continuous conversation, across all their bookings.
const sendSchema = z.object({ body: z.string().min(1).max(4000) });

async function me() {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id || null;
}

export async function GET() {
  const uid = await me();
  if (!uid) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const messages = await prisma.message.findMany({ where: { userId: uid }, orderBy: { createdAt: "asc" } });
  await Promise.all([
    touchSeen(uid),
    prisma.message.updateMany({ where: { userId: uid, readByGuest: false }, data: { readByGuest: true } }),
  ]);
  return NextResponse.json({ messages: serializeMessages(messages) });
}

export async function POST(req: Request) {
  const uid = await me();
  if (!uid) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const booking = await mostRecentBooking(uid, null);
  if (!booking) return NextResponse.json({ error: "Make a booking request first, or email contact@jetcrust.com." }, { status: 400 });

  const body = parsed.data.body.trim();
  await prisma.message.create({ data: { bookingId: booking.id, userId: uid, sender: "GUEST", body, readByGuest: true, readByAdmin: false } });
  await touchSeen(uid);
  const guest = await prisma.user.findUnique({ where: { id: uid } });
  const emailed = guest ? await notifyOtherParty({ isAdmin: false, guest, propertySlug: booking.propertySlug, bookingId: booking.id, preview: body }) : false;
  return NextResponse.json({ ok: true, emailed });
}

export async function PATCH() {
  const uid = await me();
  if (!uid) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  await Promise.all([
    touchSeen(uid),
    prisma.message.updateMany({ where: { userId: uid, readByGuest: false }, data: { readByGuest: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
