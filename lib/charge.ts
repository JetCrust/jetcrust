import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { toBookingData } from "./booking-data";
import { balanceChargedEmail } from "./emails";

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
