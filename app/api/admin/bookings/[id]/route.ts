import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { toBookingData } from "@/lib/booking-data";
import { bookingApprovedEmail, bookingDeclinedEmail } from "@/lib/emails";
import { getProperty } from "@/lib/properties";
import { splitForApproval, DEFAULT_BALANCE_DAYS } from "@/lib/policy";
import { collectAtApproval } from "@/lib/charge";

// Host approves (charges the chosen amount + blocks the calendar) or declines (releases the hold).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; chargeNowPct?: number };
  const { action } = body;

  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "REQUESTED") {
    return NextResponse.json({ error: `Booking is already ${booking.status.toLowerCase()}.` }, { status: 409 });
  }

  if (action === "approve") {
    const property = await getProperty(booking.propertySlug);
    const balanceDays = Number(property?.pricing?.balance_days_before) || DEFAULT_BALANCE_DAYS;
    // How much to charge now: the admin's choice, else the property default, else 100%.
    const pct = Number.isFinite(body.chargeNowPct)
      ? Math.min(100, Math.max(1, Number(body.chargeNowPct)))
      : Number(property?.pricing?.charge_now_pct) || 100;

    const plan = splitForApproval(booking.amountCents, booking.checkIn, new Date(), pct, balanceDays);

    try {
      const { paymentMethodId, collected } = await collectAtApproval(booking, plan.depositCents);
      const balanceCents = Math.max(0, booking.amountCents - collected);
      const DAY = 86400000;
      const now = new Date();
      const due = new Date(booking.checkIn.getTime() - balanceDays * DAY);
      const balanceDueAt = balanceCents > 0 ? (due < now ? now : due) : null;

      await prisma.$transaction([
        prisma.booking.update({
          where: { id },
          data: {
            status: "APPROVED",
            approvedAt: new Date(),
            stripePaymentMethodId: paymentMethodId,
            depositCents: collected,
            balanceCents,
            balanceDueAt,
            // Record the security deposit for this stay; it's held automatically near check-in.
            securityCents: Math.round((Number(property?.pricing?.deposit_eur) || 0) * 100),
          },
        }),
        prisma.availabilityBlock.create({
          data: { propertySlug: booking.propertySlug, start: booking.checkIn, end: booking.checkOut, source: "BOOKING", note: `Booking ${id}` },
        }),
      ]);
      const data = await toBookingData({ ...booking, depositCents: collected, balanceCents, balanceDueAt }, booking.user);
      const mail = bookingApprovedEmail(data);
      await sendEmail({ to: booking.user.email, subject: mail.subject, html: mail.html });
      return NextResponse.json({ ok: true, status: "APPROVED", collectedCents: collected, balanceCents });
    } catch (e) {
      console.error("Approval charge failed:", e);
      return NextResponse.json({ error: `Could not charge the card. (${e instanceof Error ? e.message : "Unknown error"})` }, { status: 500 });
    }
  }

  if (action === "decline") {
    if (booking.stripePaymentIntentId) {
      await stripe.paymentIntents.cancel(booking.stripePaymentIntentId).catch(() => {});
    }
    await prisma.booking.update({ where: { id }, data: { status: "DECLINED" } });
    const data = await toBookingData(booking, booking.user);
    const mail = bookingDeclinedEmail(data);
    await sendEmail({ to: booking.user.email, subject: mail.subject, html: mail.html });
    return NextResponse.json({ ok: true, status: "DECLINED" });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

// Remove a booking — ONLY OTA reservations (channel != DIRECT), so a real direct
// booking with a payment can never be deleted here. Cleans up its stay reports too.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ ok: true });
  if (booking.channel === "DIRECT") {
    return NextResponse.json({ error: "Direct bookings can't be removed here." }, { status: 400 });
  }
  await prisma.stayReport.deleteMany({ where: { bookingId: id } }).catch(() => {});
  await prisma.message.deleteMany({ where: { bookingId: id } }).catch(() => {});
  await prisma.booking.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
