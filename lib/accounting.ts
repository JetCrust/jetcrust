import { prisma } from "./prisma";
import type { Booking, Expense } from "@prisma/client";

// One line item on a booking's extras ledger (bar bottles, late checkout, a
// breakage the guest agreed to pay, etc.). Stored as JSON on Booking.extras.
export type Extra = {
  id: string;
  desc: string;
  amountCents: number;
  at: string;             // ISO added-at
  settled: boolean;
  settledVia?: "card" | "cash" | "deposit"; // how it was collected
  settledAt?: string;
};

export function parseExtras(json: string | null | undefined): Extra[] {
  if (!json) return [];
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as Extra[]) : [];
  } catch {
    return [];
  }
}

// Extras that count as income: charged to the card or taken in cash. Extras
// marked "deposit" are itemisation of a security-deposit capture, which is
// already counted under deposit income — so they are NOT double-counted here.
export function extrasIncomeCents(extras: Extra[]): number {
  return extras
    .filter((e) => e.settled && (e.settledVia === "card" || e.settledVia === "cash"))
    .reduce((s, e) => s + e.amountCents, 0);
}

// What one approved booking contributes to the P&L.
export function bookingIncome(b: Booking) {
  const extras = parseExtras(b.extras);
  const stay = b.amountCents;
  const extrasIncome = extrasIncomeCents(extras);
  const deposit = b.securityCapturedCents;
  const refunds = b.refundedCents;
  const gross = stay + extrasIncome + deposit;
  return {
    stayCents: stay,
    extrasCents: extrasIncome,
    depositCents: deposit,
    refundsCents: refunds,
    grossCents: gross,
    netCents: gross - refunds,
  };
}

const COMMISSION = "COMMISSION";

export type PLTotals = {
  bookings: number;
  stayCents: number;
  extrasCents: number;
  depositCents: number;
  otaCents: number;         // OTA (Airbnb/Booking/VRBO) net payouts logged by hand
  grossCents: number;
  refundsCents: number;
  netIncomeCents: number;   // gross − refunds
  costsCents: number;       // non-commission expenses
  commissionCents: number;  // commission expenses
  expensesCents: number;    // costs + commission
  plCents: number;          // net income − costs − commission
};

export type PLByProperty = PLTotals & { propertySlug: string; name: string };

export type PLReport = {
  start: string;
  end: string;
  totals: PLTotals;
  byProperty: PLByProperty[];
};

function emptyTotals(): PLTotals {
  return {
    bookings: 0, stayCents: 0, extrasCents: 0, depositCents: 0, otaCents: 0, grossCents: 0,
    refundsCents: 0, netIncomeCents: 0, costsCents: 0, commissionCents: 0,
    expensesCents: 0, plCents: 0,
  };
}

function addBooking(t: PLTotals, b: Booking) {
  const inc = bookingIncome(b);
  t.bookings += 1;
  t.stayCents += inc.stayCents;
  t.extrasCents += inc.extrasCents;
  t.depositCents += inc.depositCents;
  t.grossCents += inc.grossCents;
  t.refundsCents += inc.refundsCents;
  t.netIncomeCents += inc.netCents;
}

function addExpense(t: PLTotals, e: Expense) {
  if (e.category === COMMISSION) t.commissionCents += e.amountCents;
  else t.costsCents += e.amountCents;
}

// An OTA reservation's net payout counts as income (recognised on check-in).
function addOta(t: PLTotals, o: { netCents: number }) {
  t.bookings += 1;
  t.otaCents += o.netCents;
  t.grossCents += o.netCents;
  t.netIncomeCents += o.netCents;
}

function finalize(t: PLTotals) {
  t.expensesCents = t.costsCents + t.commissionCents;
  t.plCents = t.netIncomeCents - t.expensesCents;
  return t;
}

// Build the P&L for a date range, optionally scoped to one property.
// Booking revenue is recognised on the arrival (check-in) date; expenses on
// their own date. Only APPROVED bookings count as income.
export async function buildPL(start: Date, end: Date, propertySlug?: string): Promise<PLReport> {
  const bookings = await prisma.booking.findMany({
    where: {
      status: "APPROVED",
      checkIn: { gte: start, lte: end },
      ...(propertySlug ? { propertySlug } : {}),
    },
  });
  const expenses = await prisma.expense.findMany({
    where: {
      date: { gte: start, lte: end },
      ...(propertySlug ? { propertySlug } : {}),
    },
  });
  const otaBookings = await prisma.otaBooking.findMany({
    where: {
      checkIn: { gte: start, lte: end },
      ...(propertySlug ? { propertySlug } : {}),
    },
  });
  const props = await prisma.property.findMany({ select: { slug: true, name: true } });
  const nameOf = new Map(props.map((p) => [p.slug, p.name]));

  const totals = emptyTotals();
  const groups = new Map<string, PLTotals>();
  const groupFor = (slug: string) => {
    let g = groups.get(slug);
    if (!g) { g = emptyTotals(); groups.set(slug, g); }
    return g;
  };

  for (const b of bookings) {
    addBooking(totals, b);
    addBooking(groupFor(b.propertySlug), b);
  }
  for (const e of expenses) {
    addExpense(totals, e);
    addExpense(groupFor(e.propertySlug || "—"), e);
  }
  for (const o of otaBookings) {
    addOta(totals, o);
    addOta(groupFor(o.propertySlug), o);
  }

  const byProperty: PLByProperty[] = [...groups.entries()]
    .map(([slug, t]) => ({ propertySlug: slug, name: nameOf.get(slug) || (slug === "—" ? "Unattributed" : slug), ...finalize(t) }))
    .sort((a, b) => b.plCents - a.plCents);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
    totals: finalize(totals),
    byProperty,
  };
}
