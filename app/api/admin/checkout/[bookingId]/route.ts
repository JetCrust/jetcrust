import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { parseExtras, type Extra } from "@/lib/accounting";
import { sendEmail } from "@/lib/email";
import { checkoutReportEmail } from "@/lib/emails";

const schema = z.object({
  photos: z.array(z.object({ url: z.string().min(1), at: z.string() })).default([]),
  items: z.array(z.object({ desc: z.string().min(1).max(120), amountCents: z.number().int().nonnegative() })).default([]),
  depositStatus: z.enum(["pending", "refund", "partial", "claim"]).default("pending"),
  depositNote: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
  staffName: z.string().max(120).optional(),
  signature: z.string().optional(), // data URL
  complete: z.boolean().optional(),
});

// Save (draft) or complete the check-out report for a booking. On completion we
// append the charges to the booking's extras ledger and email the guest.
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { bookingId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again." }, { status: 400 });
  const d = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { user: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  if (d.complete) {
    if (d.photos.length === 0) return NextResponse.json({ error: "At least one condition photo is required." }, { status: 400 });
    if (!d.signature) return NextResponse.json({ error: "A signature is required to complete." }, { status: 400 });
  }

  const additionalCents = d.items.reduce((s, it) => s + it.amountCents, 0);
  const existing = await prisma.stayReport.findFirst({ where: { bookingId, kind: "CHECKOUT" }, orderBy: { createdAt: "desc" } });

  const data = {
    bookingId,
    kind: "CHECKOUT" as const,
    photos: JSON.stringify(d.photos),
    items: JSON.stringify(d.items),
    additionalCents,
    depositStatus: d.depositStatus,
    depositNote: d.depositNote || null,
    notes: d.notes || null,
    staffName: d.staffName || null,
    guestName: booking.guestName || booking.user.name || booking.user.email,
    signature: d.signature || null,
    completedAt: d.complete ? new Date() : existing?.completedAt ?? null,
  };

  const report = existing
    ? await prisma.stayReport.update({ where: { id: existing.id }, data })
    : await prisma.stayReport.create({ data });

  if (d.complete) {
    // Push the charges onto the booking's extras ledger (unsettled) so the team
    // can collect them from the card or the security deposit.
    if (d.items.length && !existing?.completedAt) {
      const extras = parseExtras(booking.extras);
      for (const it of d.items) {
        if (it.amountCents > 0) {
          const e: Extra = { id: crypto.randomUUID(), desc: `Check-out: ${it.desc}`, amountCents: it.amountCents, at: new Date().toISOString(), settled: false };
          extras.push(e);
        }
      }
      await prisma.booking.update({ where: { id: bookingId }, data: { extras: JSON.stringify(extras) } });
    }
    // Email the guest their signed summary.
    const property = await getProperty(booking.propertySlug);
    const mail = checkoutReportEmail({
      guestName: booking.guestName || booking.user.name || booking.user.email,
      propertyName: property?.name || booking.propertySlug,
      checkOut: booking.checkOut,
      items: d.items,
      additionalCents,
      depositStatus: d.depositStatus,
      photos: d.photos.length,
    });
    // OTA guests have no real email on file (placeholder), so only email direct guests.
    if (booking.channel === "DIRECT") await sendEmail({ to: booking.user.email, subject: mail.subject, html: mail.html }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: report.id, completed: !!report.completedAt });
}
