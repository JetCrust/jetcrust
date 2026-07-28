import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { cancellationRefund } from "@/lib/policy";
import { removeBookingBlock } from "@/lib/calendar-blocks";

// A guest cancels their own booking. Pending requests just release the card hold.
// Confirmed stays refund per the cancellation policy, release the security-deposit
// hold, and free the dates.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (booking.userId !== userId) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  if (booking.status === "REQUESTED") {
    if (booking.stripePaymentIntentId) await stripe.paymentIntents.cancel(booking.stripePaymentIntentId).catch(() => {});
    await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } });
    return NextResponse.json({ ok: true, refundedCents: 0 });
  }

  if (booking.status !== "APPROVED") {
    return NextResponse.json({ error: "This booking can no longer be cancelled." }, { status: 409 });
  }

  const { refundableCents } = cancellationRefund(booking, new Date());

  // Refund the refundable portion against the captured stay payment.
  if (refundableCents > 0 && booking.stripePaymentIntentId) {
    try {
      await stripe.refunds.create({ payment_intent: booking.stripePaymentIntentId, amount: refundableCents });
    } catch (e) {
      return NextResponse.json({ error: `Could not process the refund: ${(e as Error).message}` }, { status: 400 });
    }
  }
  // Release the security-deposit hold if one is active.
  if (booking.securityStatus === "held" && booking.securityHoldId) {
    await stripe.paymentIntents.cancel(booking.securityHoldId).catch(() => {});
  }

  await prisma.booking.update({
    where: { id },
    data: {
      status: "CANCELLED",
      refundedCents: { increment: refundableCents },
      securityStatus: booking.securityStatus === "held" ? "released" : booking.securityStatus,
    },
  });
  await removeBookingBlock(id);

  return NextResponse.json({ ok: true, refundedCents: refundableCents });
}
