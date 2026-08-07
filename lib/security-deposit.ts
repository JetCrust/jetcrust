import { stripe } from "./stripe";
import { prisma } from "./prisma";
import { getProperty } from "./properties";

const DAY = 86400000;
export const HOLD_LEAD_DAYS = 2;    // for SHORT stays: place the hold this many days before check-OUT
export const CHARGE_LEAD_DAYS = 2;  // for LONG stays: charge the deposit this many days before check-IN
export const RELEASE_AFTER_DAYS = 2; // auto-release / refund this many days after a clean check-out

// A card authorization only lasts ~7 days, so a hold can't cover a long stay.
// Stays longer than this are secured by an actual CHARGE (refunded after a clean
// check-out); shorter stays use a hold that is never charged unless there's damage.
function clampInt(v: string | undefined, d: number, lo: number, hi: number) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, Math.round(n))) : d;
}
export const CHARGE_OVER_NIGHTS = clampInt(process.env.SECURITY_CHARGE_OVER_NIGHTS, 7, 1, 60);

function nightsOf(ci: Date, co: Date) { return Math.max(1, Math.round((co.getTime() - ci.getTime()) / DAY)); }
// True when the stay is too long for a card hold to survive to check-out.
export function depositIsCharge(ci: Date, co: Date) { return nightsOf(ci, co) > CHARGE_OVER_NIGHTS; }

type Booking = NonNullable<Awaited<ReturnType<typeof prisma.booking.findUnique>>>;
type Result = { ok?: boolean; error?: string; already?: boolean; capturedCents?: number; refundedCents?: number; mode?: "hold" | "charge" };

// Shared guard: the deposit must be set, approved, on a saved card, and not already resolved.
async function loadForSecure(bookingId: string): Promise<{ b?: Booking; error?: string; already?: boolean }> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  if (b.status !== "APPROVED") return { error: "Booking is not approved." };
  if (b.securityCents <= 0) return { error: "No security deposit is set for this home." };
  if (b.securityStatus === "held" || b.securityStatus === "charged") return { already: true };
  if (b.securityStatus === "captured") return { error: "Deposit already captured." };
  if (!b.stripeCustomerId || !b.stripePaymentMethodId) return { error: "No saved card on file." };
  return { b };
}

// Place the security-deposit HOLD (off-session, on the saved card) — short stays.
export async function placeSecurityHold(bookingId: string): Promise<Result> {
  const g = await loadForSecure(bookingId);
  if (g.already) return { ok: true, already: true, mode: "hold" };
  if (g.error || !g.b) return { error: g.error };
  const b = g.b;
  try {
    const pi = await stripe.paymentIntents.create({
      amount: b.securityCents,
      currency: b.currency,
      capture_method: "manual",
      customer: b.stripeCustomerId!,
      payment_method: b.stripePaymentMethodId!,
      off_session: true,
      confirm: true,
      payment_method_types: ["card"],
      metadata: { bookingId: b.id, kind: "security" },
      description: `Jet Crust security deposit (hold): ${b.propertySlug} ${b.id}`,
    });
    if (pi.status === "requires_capture") {
      await prisma.booking.update({
        where: { id: b.id },
        data: { securityHoldId: pi.id, securityStatus: "held", securityHeldAt: new Date(), securityResolvedAt: null },
      });
      return { ok: true, mode: "hold" };
    }
    return { error: `Could not hold the deposit (status: ${pi.status}).` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// CHARGE the security deposit (off-session, immediate capture) — long stays.
// The money is taken and later refunded after a clean check-out.
export async function chargeSecurityDeposit(bookingId: string): Promise<Result> {
  const g = await loadForSecure(bookingId);
  if (g.already) return { ok: true, already: true, mode: "charge" };
  if (g.error || !g.b) return { error: g.error };
  const b = g.b;
  try {
    const pi = await stripe.paymentIntents.create({
      amount: b.securityCents,
      currency: b.currency,
      capture_method: "automatic",
      customer: b.stripeCustomerId!,
      payment_method: b.stripePaymentMethodId!,
      off_session: true,
      confirm: true,
      payment_method_types: ["card"],
      metadata: { bookingId: b.id, kind: "security" },
      description: `Jet Crust security deposit (charge, refundable): ${b.propertySlug} ${b.id}`,
    });
    if (pi.status === "succeeded") {
      await prisma.booking.update({
        where: { id: b.id },
        data: { securityHoldId: pi.id, securityStatus: "charged", securityHeldAt: new Date(), securityResolvedAt: null },
      });
      return { ok: true, mode: "charge" };
    }
    return { error: `Could not charge the deposit (status: ${pi.status}).` };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// Attach the home's configured deposit to a booking that was approved before the
// deposit was set (so it snapshotted €0). Sets the amount only; the hold/charge
// still happens on schedule (or via "Place hold now").
export async function setBookingDeposit(bookingId: string): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  if (b.securityStatus !== "none") return { error: "The deposit is already active or resolved for this booking." };
  const prop = await getProperty(b.propertySlug);
  const cents = Math.round((Number(prop?.pricing?.deposit_eur) || 0) * 100);
  if (cents <= 0) return { error: "No deposit is configured for this home. Add one in Properties & pricing first." };
  await prisma.booking.update({ where: { id: b.id }, data: { securityCents: cents } });
  return { ok: true, capturedCents: cents };
}

// Secure the deposit the right way for the stay length: hold (short) or charge (long).
export async function secureDeposit(bookingId: string): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  return depositIsCharge(b.checkIn, b.checkOut) ? chargeSecurityDeposit(bookingId) : placeSecurityHold(bookingId);
}

// Clean check-out — release the hold (cancel) or refund the charge (full).
export async function releaseSecurityHold(bookingId: string): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  if (b.securityStatus === "held" && b.securityHoldId) {
    try { await stripe.paymentIntents.cancel(b.securityHoldId); } catch { /* may already be expired/canceled */ }
    await prisma.booking.update({ where: { id: b.id }, data: { securityStatus: "released", securityResolvedAt: new Date() } });
    return { ok: true };
  }
  if (b.securityStatus === "charged" && b.securityHoldId) {
    try {
      await stripe.refunds.create({ payment_intent: b.securityHoldId });
    } catch (e) {
      return { error: (e as Error).message };
    }
    await prisma.booking.update({ where: { id: b.id }, data: { securityStatus: "released", securityResolvedAt: new Date() } });
    return { ok: true, refundedCents: b.securityCents };
  }
  return { error: "No active hold or charge to release." };
}

// Keep part/all of the deposit for damage or extras.
//  - held:    capture that amount (releases the rest automatically).
//  - charged: the full amount is already taken — refund the part we are NOT keeping.
export async function captureSecurityHold(bookingId: string, amountCents: number): Promise<Result> {
  const b = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!b) return { error: "Booking not found." };
  const amt = Math.min(Math.max(1, Math.round(amountCents)), b.securityCents);

  if (b.securityStatus === "held" && b.securityHoldId) {
    try {
      await stripe.paymentIntents.capture(b.securityHoldId, { amount_to_capture: amt });
    } catch (e) {
      return { error: (e as Error).message };
    }
    await prisma.booking.update({
      where: { id: b.id },
      data: { securityStatus: "captured", securityCapturedCents: amt, securityResolvedAt: new Date() },
    });
    return { ok: true, capturedCents: amt };
  }

  if (b.securityStatus === "charged" && b.securityHoldId) {
    const refund = b.securityCents - amt;
    if (refund > 0) {
      try { await stripe.refunds.create({ payment_intent: b.securityHoldId, amount: refund }); } catch (e) { return { error: (e as Error).message }; }
    }
    await prisma.booking.update({
      where: { id: b.id },
      data: { securityStatus: "captured", securityCapturedCents: amt, securityResolvedAt: new Date() },
    });
    return { ok: true, capturedCents: amt, refundedCents: refund > 0 ? refund : 0 };
  }

  return { error: "No active hold or charge to charge." };
}

// Scheduled job: secure imminent deposits (hold or charge by length) and
// release/refund them after a clean check-out.
export async function runSecurityDeposits(now: Date) {
  const held: { id: string; ok: boolean; error?: string; mode?: string }[] = [];
  const released: { id: string; ok: boolean; error?: string }[] = [];

  // Approved bookings that still need their deposit secured, whose stay isn't over.
  const upcoming = await prisma.booking.findMany({
    where: {
      status: "APPROVED",
      securityCents: { gt: 0 },
      securityStatus: "none",
      checkOut: { gte: now, lte: new Date(now.getTime() + 400 * DAY) },
    },
  });
  for (const b of upcoming) {
    if (depositIsCharge(b.checkIn, b.checkOut)) {
      // Long stay: charge shortly before (or from) check-in, so it's secured for the whole stay.
      if (b.checkIn.getTime() <= now.getTime() + CHARGE_LEAD_DAYS * DAY) {
        const r = await chargeSecurityDeposit(b.id);
        held.push({ id: b.id, ok: !!r.ok, error: r.error, mode: "charge" });
      }
    } else {
      // Short stay: hold shortly before check-out, so it's valid right when damage is assessed.
      if (b.checkOut.getTime() <= now.getTime() + HOLD_LEAD_DAYS * DAY) {
        const r = await placeSecurityHold(b.id);
        held.push({ id: b.id, ok: !!r.ok, error: r.error, mode: "hold" });
      }
    }
  }

  // Resolve after a clean check-out (both holds and charges).
  const toResolve = await prisma.booking.findMany({
    where: { status: "APPROVED", securityStatus: { in: ["held", "charged"] }, checkOut: { lte: new Date(now.getTime() - RELEASE_AFTER_DAYS * DAY) } },
  });
  for (const b of toResolve) {
    // Don't auto-resolve if the checkout report recorded additional charges — leave
    // that one for the host to capture or resolve by hand.
    const report = await prisma.stayReport.findFirst({ where: { bookingId: b.id, kind: "CHECKOUT", completedAt: { not: null } }, orderBy: { createdAt: "desc" } });
    if (report && report.additionalCents > 0) continue;
    const r = await releaseSecurityHold(b.id);
    released.push({ id: b.id, ok: !!r.ok, error: r.error });
  }

  return { held, released };
}
