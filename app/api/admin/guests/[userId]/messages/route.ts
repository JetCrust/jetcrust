import { NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { staffScope } from "@/lib/access";
import { mostRecentBooking, notifyOtherParty, touchSeen, serializeMessages } from "@/lib/threads";

// A guest's continuous conversation, from the staff side. Super admins see the
// whole thread; managers see only messages tied to bookings at their properties.
const sendSchema = z.object({ body: z.string().min(1).max(4000) });

async function ctx(guestId: string) {
  const scope = await staffScope();
  if (!scope) return { error: "Not authorized.", status: 403 as const };
  const slugs = scope.slugs; // null = super admin (all properties)
  if (slugs) {
    const shared = await prisma.booking.count({ where: { userId: guestId, propertySlug: { in: slugs } } });
    if (!shared) return { error: "Not authorized.", status: 403 as const };
  }
  return { staffId: scope.userId, slugs };
}

// Which of this guest's messages the viewer may see.
async function messageWhere(guestId: string, slugs: string[] | null): Promise<Prisma.MessageWhereInput> {
  if (!slugs) return { userId: guestId };
  const bookings = await prisma.booking.findMany({ where: { userId: guestId, propertySlug: { in: slugs } }, select: { id: true } });
  return { userId: guestId, bookingId: { in: bookings.map((b) => b.id) } };
}

export async function GET(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const c = await ctx(userId);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const where = await messageWhere(userId, c.slugs);
  const messages = await prisma.message.findMany({ where, orderBy: { createdAt: "asc" } });
  await Promise.all([
    touchSeen(c.staffId),
    prisma.message.updateMany({ where: { ...where, readByAdmin: false }, data: { readByAdmin: true } }),
  ]);
  return NextResponse.json({ messages: serializeMessages(messages) });
}

export async function POST(req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const c = await ctx(userId);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const booking = await mostRecentBooking(userId, c.slugs);
  if (!booking) return NextResponse.json({ error: "This guest has no booking you can message on." }, { status: 400 });

  const body = parsed.data.body.trim();
  await prisma.message.create({ data: { bookingId: booking.id, userId, sender: "ADMIN", body, readByAdmin: true, readByGuest: false } });
  await touchSeen(c.staffId);
  const guest = await prisma.user.findUnique({ where: { id: userId } });
  const emailed = guest ? await notifyOtherParty({ isAdmin: true, guest, propertySlug: booking.propertySlug, bookingId: booking.id, preview: body }) : false;
  return NextResponse.json({ ok: true, emailed });
}

export async function PATCH(_req: Request, { params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  const c = await ctx(userId);
  if ("error" in c) return NextResponse.json({ error: c.error }, { status: c.status });
  const where = await messageWhere(userId, c.slugs);
  await Promise.all([
    touchSeen(c.staffId),
    prisma.message.updateMany({ where: { ...where, readByAdmin: false }, data: { readByAdmin: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
