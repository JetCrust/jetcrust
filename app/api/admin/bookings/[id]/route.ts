import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { toBookingData } from "@/lib/booking-data";
import { bookingApprovedEmail, bookingDeclinedEmail } from "@/lib/emails";

// Host approves (captures the held card + blocks the calendar) or declines (releases the hold).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };

  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (booking.status !== "REQUESTED") {
    return NextResponse.json({ error: `Booking is already ${booking.status.toLowerCase()}.` }, { status: 409 });
  }

  if (action === "approve") {
    let paymentMethodId: string | null = booking.stripePaymentMethodId;
    if (booking.stripePaymentIntentId) {
      const captured = await stripe.paymentIntents.capture(booking.stripePaymentIntentId);
      paymentMethodId =
        typeof captured.payment_method === "string"
          ? captured.payment_method
          : captured.payment_method?.id ?? paymentMethodId;
    }
    await prisma.$transaction([
      prisma.booking.update({
        where: { id },
        data: { status: "APPROVED", approvedAt: new Date(), stripePaymentMethodId: paymentMethodId },
      }),
      prisma.availabilityBlock.create({
        data: { propertySlug: booking.propertySlug, start: booking.checkIn, end: booking.checkOut, source: "BOOKING", note: `Booking ${id}` },
      }),
    ]);
    const data = await toBookingData(booking, booking.user);
    const mail = bookingApprovedEmail(data);
    await sendEmail({ to: booking.user.email, subject: mail.subject, html: mail.html });
    return NextResponse.json({ ok: true, status: "APPROVED" });
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
