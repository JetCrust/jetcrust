import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { toBookingData } from "./booking-data";
import { balanceChargedEmail } from "./emails";

type BookingLike = {
  id: string;
  currency: string;
  propertySlug: string;
  stripeCustomerId: string | null;
  stripePaymentIntentId: string | null;
  stripePaymentMethodId: string | null;
};

// Charge exactly `chargeNowCents` at approval. The card hold may be smaller or
// larger than that: capture what we can from the hold, and charge any shortfall
// off-session using the saved card. Returns the saved payment method + what was
// actually collected.
export async function collectAtApproval(booking: BookingLike, chargeNowCents: number) {
  let paymentMethodId = booking.stripePaymentMethodId;
  let collected = 0;

  // No hold on file: charge the whole amount off-session (needs a saved card).
  if (!booking.stripePaymentIntentId) {
    if (chargeNowCents > 0 && booking.stripeCustomerId && paymentMethodId) {
      const pi = await stripe.paymentIntents.create({
        amount: chargeNowCents, currency: booking.currency, customer: booking.stripeCustomerId,
        payment_method: paymentMethodId, off_session: true, confirm: true,
        metadata: { bookingId: booking.id, kind: "approval" },
      });
      if (pi.status === "succeeded") collected = chargeNowCents;
    }
    return { paymentMethodId, collected };
  }

  const intent = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
  const authorized = intent.amount;
  paymentMethodId =
    (typeof intent.payment_method === "string" ? intent.payment_method : intent.payment_method?.id) ?? paymentMethodId;

  if (chargeNowCents <= 0) {
    // Nothing to charge now: release the hold.
    await stripe.paymentIntents.cancel(booking.stripePaymentIntentId).catch(() => {});
    return { paymentMethodId, collected: 0 };
  }

  if (chargeNowCents <= authorized) {
    // Capture just what we need; the rest of the hold is released automatically.
    await stripe.paymentIntents.capture(booking.stripePaymentIntentId, { amount_to_capture: chargeNowCents });
    collected = chargeNowCents;
  } else {
    // Capture the whole hold, then charge the shortfall off-session.
    await stripe.paymentIntents.capture(booking.stripePaymentIntentId);
    collected = authorized;
    const shortfall = chargeNowCents - authorized;
    if (shortfall > 0 && booking.stripeCustomerId && paymentMethodId) {
      try {
        const pi = await stripe.paymentIntents.create({
          amount: shortfall, currency: booking.currency, customer: booking.stripeCustomerId,
          payment_method: paymentMethodId, off_session: true, confirm: true,
          metadata: { bookingId: booking.id, kind: "approval-topup" },
        });
        if (pi.status === "succeeded") collected += shortfall;
      } catch {
        // Top-up failed (declined / needs auth). We still captured the hold; the
        // rest can be taken as a balance later.
      }
    }
  }
  return { paymentMethodId, collected };
}

// Charge the remaining balance for an approved booking, off-session, using the saved card.
export async function chargeBookingBalance(bookingId: string) {
  const b = await prisma.booking.findUnique({ where: { id: bookingId }, include: { user: true } });
  if (!b) return { error: "Not found." };
  if (b.status !== "APPROVED") return { error: "Booking is not approved." };
  if (b.balanceCents <= 0 || b.balancePaidAt) return { error: "No balance due." };
  if (!b.stripeCustomerId || !b.stripePaymentMethodId) return { error: "No saved card on file." };

  try {
    const pi = await stripe.paymentIntents.create({
      amount: b.balanceCents,
      currency: b.currency,
      customer: b.stripeCustomerId,
      payment_method: b.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      metadata: { bookingId: b.id, kind: "balance" },
      description: `Jet Crust balance: ${b.propertySlug} ${b.id}`,
    });
    if (pi.status === "succeeded") {
      await prisma.booking.update({ where: { id: b.id }, data: { balancePaidAt: new Date() } });
      const data = await toBookingData(b, b.user);
      const m = balanceChargedEmail(data);
      await sendEmail({ to: b.user.email, subject: m.subject, html: m.html });
      return { ok: true, status: pi.status };
    }
    return { error: `Payment ${pi.status}. The card may need action.`, status: pi.status };
  } catch (e) {
    // Off-session charges can fail (card declined / needs authentication).
    return { error: (e as Error).message };
  }
}

// Charge every balance that is due (used by the scheduled job and the admin "charge all due" action).
export async function chargeDueBalances(now: Date) {
  const due = await prisma.booking.findMany({
    where: { status: "APPROVED", balanceCents: { gt: 0 }, balancePaidAt: null, balanceDueAt: { lte: now } },
  });
  const results: { bookingId: string; ok: boolean; error?: string }[] = [];
  for (const b of due) {
    const r = await chargeBookingBalance(b.id);
    results.push({ bookingId: b.id, ok: !!r.ok, error: r.error });
  }
  return results;
}
