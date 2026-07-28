import type { Property } from "./properties";

export function nightsBetween(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn + "T00:00:00Z");
  const b = new Date(checkOut + "T00:00:00Z");
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function mmdd(d: Date): string {
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

// Handles ranges that wrap the year end (e.g. 12-20 to 01-05).
function inRange(md: string, from: string, to: string): boolean {
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

// The nightly rate for a single date: holiday/seasonal override, else weekend rate, else base.
export function nightlyBase(p: Property, date: Date): { rate: number; kind: "base" | "weekend" | "season"; label?: string } {
  const md = mmdd(date);
  for (const s of p.pricing.seasonal || []) {
    if (inRange(md, s.from, s.to)) return { rate: s.nightly_eur, kind: "season", label: s.name };
  }
  const dow = date.getUTCDay(); // 0 Sun ... 6 Sat
  if ((dow === 5 || dow === 6) && p.pricing.weekend_nightly_eur) {
    return { rate: p.pricing.weekend_nightly_eur, kind: "weekend" };
  }
  return { rate: p.pricing.base_nightly_eur, kind: "base" };
}

// Occupancy-based auto-adjust, clamped to the property's floor and ceiling.
export function applyDynamic(rate: number, p: Property, occupancyRatio: number): number {
  const dyn = p.pricing.dynamic;
  if (!dyn?.enabled) return rate;
  let price = rate;
  if (dyn.occupancy?.enabled) {
    price = rate * (1 + (Math.max(0, Math.min(1, occupancyRatio)) * (dyn.occupancy.max_uplift_pct || 0)) / 100);
  }
  if (dyn.ceiling_eur) price = Math.min(price, dyn.ceiling_eur);
  if (dyn.floor_eur) price = Math.max(price, dyn.floor_eur);
  return Math.round(price);
}

// How an add-on is charged. "day" bills the same count as nights; the wording
// just reflects how the service is sold (a chef per night, an ATV per day).
export type AddonUnit = "night" | "day" | "stay";

export type RateLine = { kind: "base" | "weekend" | "season"; label: string; nights: number; rate: number; total: number };
export type AddonLine = { value: string; title: string; unit: AddonUnit; unitPrice: number; qty: number; total: number };

export type Quote = {
  nights: number;
  minNights: number;
  valid: boolean;
  currency: string;
  rateLines: RateLine[];
  stayTotal: number;
  addonLines: AddonLine[];
  addonsTotal: number;
  total: number;
  amountCents: number;
  avgNightly: number;
  hasWeekend: boolean;
  hasSeason: boolean;
  demandApplied: boolean;
};

const RATE_LABEL: Record<RateLine["kind"], string> = {
  base: "Weeknight",
  weekend: "Weekend night",
  season: "Seasonal night",
};

export function unitLabel(unit: AddonUnit): string {
  return unit === "stay" ? "per stay" : unit === "day" ? "per day" : "per night";
}

// Price the selected add-ons for a stay of `nights` nights.
export function priceAddons(p: Property, selected: string[], nights: number): AddonLine[] {
  if (!selected.length || nights <= 0) return [];
  const lines: AddonLine[] = [];
  for (const a of p.addons || []) {
    if (!selected.includes(a.value)) continue;
    const unitPrice = Number(a.price_eur) || 0;
    if (!unitPrice) continue;
    const unit = (a.unit as AddonUnit) || "stay";
    const qty = unit === "stay" ? 1 : nights;
    lines.push({ value: a.value, title: a.title, unit, unitPrice, qty, total: unitPrice * qty });
  }
  return lines;
}

export function quote(
  p: Property,
  checkIn: string,
  checkOut: string,
  occupancyRatio = 0,
  selectedAddons: string[] = [],
): Quote {
  const nights = nightsBetween(checkIn, checkOut);
  const minNights = p.pricing.min_nights || 1;
  const currency = p.pricing.currency || "eur";
  const empty: Quote = {
    nights: 0, minNights, valid: false, currency,
    rateLines: [], stayTotal: 0, addonLines: [], addonsTotal: 0,
    total: 0, amountCents: 0, avgNightly: 0,
    hasWeekend: false, hasSeason: false, demandApplied: false,
  };
  if (nights <= 0) return empty;

  const start = new Date(checkIn + "T00:00:00Z");
  let stayTotal = 0;
  let hasWeekend = false;
  let hasSeason = false;
  let demandApplied = false;

  // Group nights that share the same kind + final rate, so the guest sees
  // "2 x Weekend night @ EUR 2,300" instead of a wall of dates.
  const groups = new Map<string, RateLine>();
  for (let i = 0; i < nights; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    const b = nightlyBase(p, d);
    if (b.kind === "weekend") hasWeekend = true;
    if (b.kind === "season") hasSeason = true;
    const rate = applyDynamic(b.rate, p, occupancyRatio);
    if (rate !== b.rate) demandApplied = true;
    stayTotal += rate;

    const label = b.kind === "season" ? b.label || RATE_LABEL.season : RATE_LABEL[b.kind];
    const key = `${b.kind}|${label}|${rate}`;
    const line = groups.get(key);
    if (line) {
      line.nights += 1;
      line.total += rate;
    } else {
      groups.set(key, { kind: b.kind, label, nights: 1, rate, total: rate });
    }
  }

  const addonLines = priceAddons(p, selectedAddons, nights);
  const addonsTotal = addonLines.reduce((s, l) => s + l.total, 0);
  const total = stayTotal + addonsTotal;

  return {
    nights,
    minNights,
    valid: nights >= minNights,
    currency,
    rateLines: [...groups.values()],
    stayTotal,
    addonLines,
    addonsTotal,
    total,
    amountCents: Math.round(total * 100),
    avgNightly: Math.round(stayTotal / nights),
    hasWeekend,
    hasSeason,
    demandApplied,
  };
}
