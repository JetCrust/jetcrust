import { prisma } from "./prisma";
import type { Booking, Expense } from "@prisma/client";
import { getProperties } from "./properties";

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

// Estimated Stripe processing fee on direct (on-site) card revenue. Configurable
// (EEA cards default ~1.5% + €0.25; set higher for a mostly-international guest
// mix). OTA payouts are already net, so they carry no Stripe fee.
const STRIPE_FEE_PCT = Number(process.env.STRIPE_FEE_PCT) || 1.5;
const STRIPE_FEE_FIXED_CENTS = process.env.STRIPE_FEE_FIXED_CENTS != null ? Number(process.env.STRIPE_FEE_FIXED_CENTS) : 25;

function cardExtrasCents(extras: Extra[]): number {
  return extras.filter((e) => e.settled && e.settledVia === "card").reduce((s, e) => s + e.amountCents, 0);
}

// What one booking cost you in Stripe fees: a percentage of everything actually
// charged to the card (the stay, card-settled extras, a captured deposit), plus
// a fixed fee per booking. Returns 0 when nothing was charged to a card.
export function stripeFeeForBooking(b: Booking): number {
  const base = b.amountCents + cardExtrasCents(parseExtras(b.extras)) + b.securityCapturedCents;
  if (base <= 0) return 0;
  return Math.round((base * STRIPE_FEE_PCT) / 100) + STRIPE_FEE_FIXED_CENTS;
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
  overheadCents: number;    // fixed per-property monthly overhead, prorated to the range
  variableCents: number;    // per-stay + per-night running costs (cleaning, heating…)
  costsCents: number;       // all non-commission costs (logged expenses + overhead + variable)
  commissionCents: number;  // commission expenses
  stripeFeesCents: number;  // estimated Stripe processing fees on direct card revenue
  expensesCents: number;    // costs + commission + stripe fees
  plCents: number;          // net income − costs − commission − stripe fees
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
    refundsCents: 0, netIncomeCents: 0, overheadCents: 0, variableCents: 0, costsCents: 0, commissionCents: 0,
    stripeFeesCents: 0, expensesCents: 0, plCents: 0,
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
  t.stripeFeesCents += stripeFeeForBooking(b);
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

const DAY = 86400000;
const nightsOf = (a: Date, b: Date) => Math.max(0, Math.round((b.getTime() - a.getTime()) / DAY));

// Per-booking profitability (contribution): revenue minus the two costs that
// belong to this specific stay — the Stripe fee and the variable running/cleaning
// cost. Fixed monthly overhead is NOT allocated here (it's time-based, not per
// booking), so this is the booking's contribution margin.
export type BookingProfit = {
  revenueCents: number;      // net income (stay + card extras + captured deposit − refunds)
  stripeFeeCents: number;
  variableCents: number;     // cleaning + per-night running cost
  netCents: number;          // contribution after fee + variable
  marginPct: number;         // net ÷ revenue
  nights: number;
  avgNightlyCents: number;   // stay ÷ nights
};

export function bookingProfit(
  b: Booking,
  costs?: { cleaning_per_stay_eur: number; variable_per_night_eur: number } | null,
): BookingProfit {
  const inc = bookingIncome(b);
  const stripeFeeCents = stripeFeeForBooking(b);
  const nights = nightsOf(b.checkIn, b.checkOut);
  const variableCents = costs ? Math.round((costs.cleaning_per_stay_eur + costs.variable_per_night_eur * nights) * 100) : 0;
  const netCents = inc.netCents - stripeFeeCents - variableCents;
  return {
    revenueCents: inc.netCents,
    stripeFeeCents,
    variableCents,
    netCents,
    marginPct: inc.netCents > 0 ? Math.round((netCents / inc.netCents) * 100) : 0,
    nights,
    avgNightlyCents: nights > 0 ? Math.round(b.amountCents / nights) : b.amountCents,
  };
}

function addOverhead(t: PLTotals, cents: number) { t.overheadCents += cents; t.costsCents += cents; }
function addVariable(t: PLTotals, cents: number) { t.variableCents += cents; t.costsCents += cents; }

function finalize(t: PLTotals) {
  t.expensesCents = t.costsCents + t.commissionCents + t.stripeFeesCents;
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
      channel: "DIRECT", // OTA reservations carry no on-site revenue; their payout is logged separately
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
  const props = await getProperties(true);
  const nameOf = new Map(props.map((p) => [p.slug, p.name]));
  const costOf = new Map(props.map((p) => [p.slug, p.costs]));

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

  // Variable running costs per stay (cleaning once + a per-night amount for
  // utilities/heating), for both direct and OTA bookings.
  const variableFor = (slug: string, ci: Date, co: Date) => {
    const c = costOf.get(slug);
    if (!c) return 0;
    return Math.round((c.cleaning_per_stay_eur + c.variable_per_night_eur * nightsOf(ci, co)) * 100);
  };
  for (const b of bookings) {
    const v = variableFor(b.propertySlug, b.checkIn, b.checkOut);
    if (v) { addVariable(totals, v); addVariable(groupFor(b.propertySlug), v); }
  }
  for (const o of otaBookings) {
    const v = variableFor(o.propertySlug, o.checkIn, o.checkOut);
    if (v) { addVariable(totals, v); addVariable(groupFor(o.propertySlug), v); }
  }

  // Fixed monthly overhead you pay regardless (mortgage, insurance, base
  // utilities, staff), prorated across the report's date span, for live homes.
  const rangeDays = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY) + 1);
  const monthFactor = rangeDays / 30.44; // average days per month
  for (const p of props) {
    if (p.status !== "live") continue;
    if (propertySlug && p.slug !== propertySlug) continue;
    const overhead = Math.round((p.costs.monthly_overhead_eur || 0) * 100 * monthFactor);
    if (overhead) { addOverhead(totals, overhead); addOverhead(groupFor(p.slug), overhead); }
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
