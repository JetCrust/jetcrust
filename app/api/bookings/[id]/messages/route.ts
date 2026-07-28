import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { sendEmail } from "@/lib/email";
import { newMessageEmail } from "@/lib/emails";

const sendSchema = z.object({ body: z.string().min(1).max(4000) });

async function context(id: string) {
  const session = await auth();
  const u = session?.user as { id?: string; role?: string } | undefined;
  if (!u?.id) return { error: "Please sign in.", status: 401 as const };
  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
  if (!booking) return { error: "Not found.", status: 404 as const };
  const isAdmin = u.role === "ADMIN";
  if (!isAdmin && booking.userId !== u.id) return { error: "Not authorized.", status: 403 as const };
  return { booking, isAdmin };
}

// Send a message on a booking (guest or host).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { booking, isAdmin } = ctx;

  const parsed = sendSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Write a message first." }, { status: 400 });

  const sender = isAdmin ? "ADMIN" : "GUEST";
  await prisma.message.create({
    data: { bookingId: id, sender, body: parsed.data.body.trim(), readByAdmin: isAdmin, readByGuest: !isAdmin },
  });

  // Notify the other party by email.
  try {
    const property = await getProperty(booking.propertySlug);
    const mail = newMessageEmail({
      toGuest: isAdmin,
      guestName: booking.user.name || booking.user.email.split("@")[0],
      propertyName: property?.name || booking.propertySlug,
      preview: parsed.data.body.trim().slice(0, 140),
      bookingId: id,
    });
    const to = isAdmin ? booking.user.email : (process.env.EMAIL_ADMIN || process.env.EMAIL_FROM || "");
    if (to) await sendEmail({ to, subject: mail.subject, html: mail.html });
  } catch { /* email is best-effort */ }

  return NextResponse.json({ ok: true });
}

// Mark the thread read for the current viewer.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await context(id);
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const field = ctx.isAdmin ? { readByAdmin: true } : { readByGuest: true };
  await prisma.message.updateMany({ where: { bookingId: id, ...(ctx.isAdmin ? { readByAdmin: false } : { readByGuest: false }) }, data: field });
  return NextResponse.json({ ok: true });
}
