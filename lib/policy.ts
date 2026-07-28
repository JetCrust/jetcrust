// Deposit / split-payment policy. Each property sets how much to charge at
// approval (charge_now_pct) and how many days before arrival the remainder is
// auto-charged (balance_days_before). The admin can override the percentage at
// approval time. Env values are fallbacks when a property doesn't set its own.
export const DEFAULT_CHARGE_NOW_PCT = clampNum(process.env.DEPOSIT_PERCENT, 100, 1, 100);
export const DEFAULT_BALANCE_DAYS = clampNum(process.env.BALANCE_DUE_DAYS, 30, 0, 365);

function clampNum(v: string | number | undefined, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

const DAY = 86400000;

export type DepositPlan = {
  split: boolean;
  depositCents: number; // charged/held now
  balanceCents: number; // charged later
  balanceDueAt: Date | null;
};

// Work out the split for a total, given the property's charge-now percentage and
// how many days before arrival the balance is due. If the stay is already within
// that window (or the percentage is 100), everything is taken now.
export function depositPlan(
  totalCents: number,
  checkIn: Date,
  now: Date,
  chargeNowPct = DEFAULT_CHARGE_NOW_PCT,
  balanceDaysBefore = DEFAULT_BALANCE_DAYS,
): DepositPlan {
  const pct = clampNum(chargeNowPct, DEFAULT_CHARGE_NOW_PCT, 1, 100);
  const leadDays = Math.floor((checkIn.getTime() - now.getTime()) / DAY);
  if (pct >= 100 || leadDays <= balanceDaysBefore) {
    return { split: false, depositCents: totalCents, balanceCents: 0, balanceDueAt: null };
  }
  const depositCents = Math.round((totalCents * pct) / 100);
  const balanceCents = totalCents - depositCents;
  const balanceDueAt = new Date(checkIn.getTime() - balanceDaysBefore * DAY);
  return { split: true, depositCents, balanceCents, balanceDueAt };
}

// Same split maths, but for an explicit "charge now" percentage chosen by the
// admin at approval (always splits the remainder to the balance, due before arrival).
export function splitForApproval(
  totalCents: number,
  checkIn: Date,
  now: Date,
  chargeNowPct: number,
  balanceDaysBefore = DEFAULT_BALANCE_DAYS,
): DepositPlan {
  const pct = clampNum(chargeNowPct, 100, 1, 100);
  const depositCents = Math.round((totalCents * pct) / 100);
  const balanceCents = totalCents - depositCents;
  if (balanceCents <= 0) return { split: false, depositCents: totalCents, balanceCents: 0, balanceDueAt: null };
  // Never in the past: if the stay is within the window, charge the balance at the next run.
  const due = new Date(checkIn.getTime() - balanceDaysBefore * DAY);
  return { split: true, depositCents, balanceCents, balanceDueAt: due < now ? now : due };
}
