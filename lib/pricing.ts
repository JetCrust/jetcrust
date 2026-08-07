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

// How an add-on is charged. "day"/"night" bill the same count as nights; "each"
// lets the guest choose how many (sessions, hours, people…), within min/max.
export type AddonUnit = "night" | "day" | "stay" | "each";

// What the guest selected: add-on value → quantity (0 or missing = not selected).
export type AddonSelection = Record<string, number>;

export type RateLine = { kind: "base" | "weekend" | "season"; label: string; nights: number; rate: number; total: number };
export type AddonLine = { value: string; title: string; unit: AddonUnit; unitPrice: number; qty: number; total: number; qtyNoun?: string };
export type DiscountLine = { label: string; pct: number; amount: number };

export type Quote = {
  nights: number;
  minNights: number;
  valid: boolean;
  currency: string;
  rateLines: RateLine[];
  stayTotal: number;        // stay before discounts
  discountLines: DiscountLine[];
  discountTotal: number;
  addonLines: AddonLine[];
  addonsTotal: number;
  total: number;
  amountCents: number;
  avgNightly: number;       // discounted stay ÷ nights
  hasWeekend: boolean;
  hasSeason: boolean;
  demandApplied: boolean;
};

const RATE_LABEL: Record<RateLine["kind"], string> = {
  base: "Weeknight",
  weekend: "Weekend night",
  season: "Seasonal night",
};

export function unitLabel(unit: AddonUnit, qtyNoun?: string): string {
  if (unit === "each") return qtyNoun ? `per ${qtyNoun}` : "each";
  return unit === "stay" ? "per stay" : unit === "day" ? "per day" : "per night";
}

// Accept either a plain list of values (each qty 1) or a value→qty map.
function toSelection(sel: string[] | AddonSelection): AddonSelection {
  if (Array.isArray(sel)) { const m: AddonSelection = {}; for (const v of sel) m[v] = 1; return m; }
  return sel || {};
}

// Read a stored booking.addons JSON (old string[] or new [{value,qty}]) into a map.
export function parseAddonSelection(json: string | null | undefined): AddonSelection {
  const m: AddonSelection = {};
  try {
    const arr = JSON.parse(json || "[]");
    if (Array.isArray(arr)) {
      for (const it of arr) {
        if (typeof it === "string") m[it] = 1;
        else if (it && typeof it === "object" && it.value) m[String(it.value)] = Math.max(1, Math.round(Number(it.qty) || 1));
      }
    }
  } catch { /* leave empty */ }
  return m;
}

// Price the selected add-ons for a stay of `nights` nights.
export function priceAddons(p: Property, selected: string[] | AddonSelection, nights: number): AddonLine[] {
  const sel = toSelection(selected);
  if (nights <= 0) return [];
  const lines: AddonLine[] = [];
  for (const a of p.addons || []) {
    const chosen = sel[a.value];
    if (!chosen || chosen < 1) continue;
    const unitPrice = Number(a.price_eur) || 0;
    if (!unitPrice) continue;
    const unit = (a.unit as AddonUnit) || "stay";
    let qty: number;
    if (unit === "each") {
      const min = Math.max(1, Number(a.min_qty) || 1);
      const max = Math.max(min, Number(a.max_qty) || 99);
      qty = Math.min(max, Math.max(min, Math.round(chosen)));
    } else if (unit === "stay") qty = 1;
    else qty = nights;
    lines.push({ value: a.value, title: a.title, unit, unitPrice, qty, total: unitPrice * qty, qtyNoun: a.qty_noun });
  }
  return lines;
}

export function quote(
  p: Property,
  checkIn: string,
  checkOut: string,
  occupancyRatio = 0,
  selectedAddons: string[] | AddonSelection = [],
  now?: Date,
): Quote {
  const nights = nightsBetween(checkIn, checkOut);
  const minNights = p.pricing.min_nights || 1;
  const currency = p.pricing.currency || "eur";
  const empty: Quote = {
    nights: 0, minNights, valid: false, currency,
    rateLines: [], stayTotal: 0, discountLines: [], discountTotal: 0, addonLines: [], addonsTotal: 0,
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

  // Discounts on the stay (never on add-ons): length-of-stay, then last-minute.
  const discountLines: DiscountLine[] = [];
  const los = p.pricing.los_discounts;
  if (los) {
    if (nights >= 28 && los.monthly_pct > 0) discountLines.push({ label: "Monthly stay discount", pct: los.monthly_pct, amount: Math.round(stayTotal * los.monthly_pct / 100) });
    else if (nights >= 7 && los.weekly_pct > 0) discountLines.push({ label: "Weekly stay discount", pct: los.weekly_pct, amount: Math.round(stayTotal * los.weekly_pct / 100) });
  }
  const lm = p.pricing.lastminute;
  if (lm && lm.pct > 0 && now) {
    const leadDays = Math.ceil((new Date(checkIn + "T00:00:00Z").getTime() - now.getTime()) / 86400000);
    if (leadDays >= 0 && leadDays <= lm.days) discountLines.push({ label: "Last-minute", pct: lm.pct, amount: Math.round(stayTotal * lm.pct / 100) });
  }
  let discountTotal = discountLines.reduce((s, l) => s + l.amount, 0);
  const cap = Math.round(stayTotal * 0.5); // never discount a stay by more than half
  if (discountTotal > cap) discountTotal = cap;
  const discountedStay = stayTotal - discountTotal;

  const addonLines = priceAddons(p, selectedAddons, nights);
  const addonsTotal = addonLines.reduce((s, l) => s + l.total, 0);
  const total = discountedStay + addonsTotal;

  return {
    nights,
    minNights,
    valid: nights >= minNights,
    currency,
    rateLines: [...groups.values()],
    stayTotal,
    discountLines,
    discountTotal,
    addonLines,
    addonsTotal,
    total,
    amountCents: Math.round(total * 100),
    avgNightly: Math.round(discountedStay / nights),
    hasWeekend,
    hasSeason,
    demandApplied,
  };
}
