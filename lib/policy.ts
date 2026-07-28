// Deposit / split-payment policy. Configurable via env; sensible defaults.
// If a stay is far enough out, take a deposit now and the balance closer to arrival.
export const DEPOSIT_PERCENT = clampNum(process.env.DEPOSIT_PERCENT, 50, 1, 100);
export const BALANCE_DUE_DAYS = clampNum(process.env.BALANCE_DUE_DAYS, 30, 0, 365); // balance due this many days before check-in
export const SPLIT_MIN_LEAD_DAYS = clampNum(process.env.SPLIT_MIN_LEAD_DAYS, 45, 0, 3650); // only split if check-in is at least this far out

function clampNum(v: string | undefined, def: number, min: number, max: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

const DAY = 86400000;

export type DepositPlan = {
  split: boolean;
  depositCents: number;
  balanceCents: number;
  balanceDueAt: Date | null;
};

// now is passed in (never call Date.now indirectly in a way that breaks tests).
export function depositPlan(totalCents: number, checkIn: Date, now: Date): DepositPlan {
  const leadDays = Math.floor((checkIn.getTime() - now.getTime()) / DAY);
  if (DEPOSIT_PERCENT >= 100 || leadDays < SPLIT_MIN_LEAD_DAYS) {
    return { split: false, depositCents: totalCents, balanceCents: 0, balanceDueAt: null };
  }
  const depositCents = Math.round((totalCents * DEPOSIT_PERCENT) / 100);
  const balanceCents = totalCents - depositCents;
  const balanceDueAt = new Date(checkIn.getTime() - BALANCE_DUE_DAYS * DAY);
  return { split: true, depositCents, balanceCents, balanceDueAt };
}
