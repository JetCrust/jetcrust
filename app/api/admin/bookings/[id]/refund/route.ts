import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

const schema = z.object({ amountCents: z.number().int().positive() });

// Refund part or all of the stay payment to the guest. Refunds against the
// primary (deposit) PaymentIntent and records the total on the booking so the
// P&L nets it out. The security deposit is refunded separately, on its own hold.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });

  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  if (!b.stripePaymentIntentId) return NextResponse.json({ error: "No captured payment to refund." }, { status: 400 });

  const remaining = b.amountCents - b.refundedCents;
  if (remaining <= 0) return NextResponse.json({ error: "Nothing left to refund." }, { status: 400 });
  const amt = Math.min(parsed.data.amountCents, remaining);

  try {
    await stripe.refunds.create({ payment_intent: b.stripePaymentIntentId, amount: amt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { refundedCents: { increment: amt } },
  });
  return NextResponse.json({ ok: true, refundedCents: updated.refundedCents });
}
