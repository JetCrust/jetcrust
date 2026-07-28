import { stripe } from "./stripe";
import { prisma } from "./prisma";

const DAY = 86400000;
export const HOLD_LEAD_DAYS = 2; // place the hold this many days before check-in
export const RELEASE_AFTER_DAYS = 1; // auto-release this many days after checkout

type Result = { ok?: boolean; error?: string; already?: boolean; capturedCents?: number };

// Place the security-deposit hold for a booking (off-session, on the saved card).
export async function placeSecurityHold(bookingId: string): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  if (b.status !== "APPROVED") return { error: "Booking is not approved." };
  if (b.securityCents <= 0) return { error: "No security deposit is set for this home." };
  if (b.securityStatus === "held") return { ok: true, already: true };
  if (b.securityStatus === "captured") return { error: "Deposit already captured." };
  if (!b.stripeCustomerId || !b.stripePaymentMethodId) return { error: "No saved card on file." };

  try {
    const pi = await stripe.paymentIntents.create({
      amount: b.securityCents,
      currency: b.currency,
      capture_method: "manual",
      customer: b.stripeCustomerId,
      payment_method: b.stripePaymentMethodId,
      off_session: true,
      confirm: true,
      payment_method_types: ["card"],
      metadata: { bookingId: b.id, kind: "security" },
      description: `Jet Crust security deposit: ${b.propertySlug} ${b.id}`,
    });
    if (pi.status === "requires_capture") {
      await prisma.booking.update({
        where: { id: b.id },
        data: { securityHoldId: pi.id, securityStatus: "held", securityHeldAt: new Date(), securityResolvedAt: null },
      });
      return { ok: true };
    }
    return { error: `Could not hold the deposit (status: ${pi.status}).` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Release (cancel) the hold — clean checkout, nothing charged.
export async function releaseSecurityHold(bookingId: string): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  if (b.securityStatus !== "held" || !b.securityHoldId) return { error: "No active hold to release." };
  try {
    await stripe.paymentIntents.cancel(b.securityHoldId);
  } catch {
    // May already be expired/canceled on Stripe's side; treat as released.
  }
  await prisma.booking.update({ where: { id: b.id }, data: { securityStatus: "released", securityResolvedAt: new Date() } });
  return { ok: true };
}

// Capture part or all of the hold for damage/extras (partial capture releases the rest).
export async function captureSecurityHold(bookingId: string, amountCents: number): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  if (b.securityStatus !== "held" || !b.securityHoldId) return { error: "No active hold to charge." };
  const amt = Math.min(Math.max(1, Math.round(amountCents)), b.securityCents);
  try {
    await stripe.paymentIntents.capture(b.securityHoldId, { amount_to_capture: amt });
    await prisma.booking.update({
      where: { id: b.id },
      data: { securityStatus: "captured", securityCapturedCents: amt, securityResolvedAt: new Date() },
    });
    return { ok: true, capturedCents: amt };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Scheduled job: place holds for imminent check-ins and release holds after checkout.
export async function runSecurityDeposits(now: Date) {
  const held: { id: string; ok: boolean; error?: string }[] = [];
  const released: { id: string; ok: boolean; error?: string }[] = [];

  const toHold = await prisma.booking.findMany({
    where: {
      status: "APPROVED",
      securityCents: { gt: 0 },
      securityStatus: "none",
      checkIn: { lte: new Date(now.getTime() + HOLD_LEAD_DAYS * DAY), gte: now },
    },
  });
  for (const b of toHold) {
    const r = await placeSecurityHold(b.id);
    held.push({ id: b.id, ok: !!r.ok, error: r.error });
  }

  const toRelease = await prisma.booking.findMany({
    where: { status: "APPROVED", securityStatus: "held", checkOut: { lte: new Date(now.getTime() - RELEASE_AFTER_DAYS * DAY) } },
  });
  for (const b of toRelease) {
    const r = await releaseSecurityHold(b.id);
    released.push({ id: b.id, ok: !!r.ok, error: r.error });
  }

  return { held, released };
}
