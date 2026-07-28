import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

// A guest cancels their own request (or a confirmed booking) — releases the card hold
// if it is still only authorized. Refunds on captured bookings are handled by the host.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (booking.userId !== userId) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (booking.status !== "REQUESTED") {
    return NextResponse.json({ error: "Only pending requests can be cancelled here. Please contact us for confirmed stays." }, { status: 409 });
  }

  if (booking.stripePaymentIntentId) {
    await stripe.paymentIntents.cancel(booking.stripePaymentIntentId).catch(() => {});
  }
  await prisma.booking.update({ where: { id }, data: { status: "CANCELLED" } });
  return NextResponse.json({ ok: true });
}
