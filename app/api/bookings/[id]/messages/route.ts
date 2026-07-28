import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { sendEmail } from "@/lib/email";
import { newMessageEmail } from "@/lib/emails";
import { staffScope, canAccessProperty } from "@/lib/access";

const sendSchema = z.object({ body: z.string().min(1).max(4000) });
const PRESENCE_MS = 2 * 60 * 1000;

async function context(id: string) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return { error: "Please sign in.", status: 401 as const };
  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
  if (!booking) return { error: "Not found.", status: 404 as const };
  const scope = await staffScope();
  const isStaff = !!scope && canAccessProperty(scope, booking.propertySlug);
  if (!isStaff && booking.userId !== u.id) return { error: "Not authorized.", status: 403 as const };
  return { booking, isAdmin: isStaff, userId: u.id };
}

const touchSeen = (userId: string) => prisma.user.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => {});

// Poll the thread (also marks read + updates presence).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const messages = await prisma.message.findMany({ where: { bookingId: id }, orderBy: { createdAt: "asc" } });
  await Promise.all([
    touchSeen(ctx.userId),
    prisma.message.updateMany({ where: { bookingId: id, ...(ctx.isAdmin ? { readByAdmin: false } : { readByGuest: false }) }, data: ctx.isAdmin ? { readByAdmin: true } : { readByGuest: true } }),
  ]);
  return NextResponse.json({ messages: messages.map((m) => ({ id: m.id, sender: m.sender, body: m.body, createdAt: m.createdAt.toISOString() })) });
}

// Send a message.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { booking, isAdmin, userId } = ctx;

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const sender = isAdmin ? "ADMIN" : "GUEST";
  await prisma.message.create({ data: { bookingId: id, sender, body: parsed.data.body.trim(), readByAdmin: isAdmin, readByGuest: !isAdmin } });
  await touchSeen(userId);

  // Only email the other party if they don't appear to be online right now.
  const since = new Date(Date.now() - PRESENCE_MS);
  let recipientOnline = false;
  let to = "";
  if (isAdmin) {
    // to the guest
    to = booking.user.email;
    recipientOnline = !!booking.user.lastSeenAt && booking.user.lastSeenAt > since;
  } else {
    // to staff who cover this property
    to = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM || "";
    const activeStaff = await prisma.user.count({
      where: {
        lastSeenAt: { gt: since },
        OR: [{ role: "ADMIN" }, { role: "MANAGER", managedSlugs: { has: booking.propertySlug } }],
      },
    });
    recipientOnline = activeStaff > 0;
  }

  if (to && !recipientOnline) {
    try {
      const property = await getProperty(booking.propertySlug);
      const mail = newMessageEmail({
        toGuest: isAdmin,
        guestName: booking.user.name || booking.user.email.split("@")[0],
        propertyName: property?.name || booking.propertySlug,
        preview: parsed.data.body.trim().slice(0, 140),
        bookingId: id,
      });
      await sendEmail({ to, subject: mail.subject, html: mail.html });
    } catch { /* email is best-effort */ }
  }

  return NextResponse.json({ ok: true, emailed: !recipientOnline });
}

// Mark read + presence.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  await Promise.all([
    touchSeen(ctx.userId),
    prisma.message.updateMany({ where: { bookingId: id, ...(ctx.isAdmin ? { readByAdmin: false } : { readByGuest: false }) }, data: ctx.isAdmin ? { readByAdmin: true } : { readByGuest: true } }),
  ]);
  return NextResponse.json({ ok: true });
}
