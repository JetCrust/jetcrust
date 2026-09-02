import fs from "node:fs";
import path from "node:path";

// Property CONTENT source of truth = the data/*.json files (shared with the static site).
export type Pricing = {
  base_nightly_eur: number;
  weekend_nightly_eur?: number;
  currency: string;
  min_nights: number;
  deposit_eur?: number;         // refundable security/damage deposit (Stage 2)
  charge_now_pct?: number;      // % of the stay charged at approval (default)
  balance_days_before?: number; // days before arrival the remainder auto-charges
  dynamic?: {
    enabled: boolean;
    floor_eur: number;
    ceiling_eur: number;
    occupancy?: { enabled: boolean; window_days: number; max_uplift_pct: number };
  };
  seasonal?: { name: string; from: string; to: string; nightly_eur: number }[];
  los_discounts?: { weekly_pct: number; monthly_pct: number };   // 7+ / 28+ nights
  // Near-term "fill the valley" rate. Manual switch for a whole property; the
  // discount only ever touches non-holiday nights inside the window, is clamped
  // to floor_eur, and (with taper) deepens the emptier the window is.
  lastminute?: { enabled?: boolean; days: number; pct: number; floor_eur?: number; taper?: boolean };
  // Automatic filler for stranded 1-2 night holes wedged between two bookings.
  // Those nights are dead weight empty, so they can take a deeper cut, quietly.
  orphan?: { enabled?: boolean; max_gap_nights?: number; pct?: number; window_days?: number; floor_eur?: number };
};

import type { Guidebook } from "./guidebook";

export type Property = {
  slug: string;
  name: string;
  status: string;
  tier: string; // "estate" (flagship) | "residence" (city apartment tier)
  order: number;
  location: string;
  address?: string;   // full arrival address, shown to the guest after confirmation
  coords?: string;    // "lat,lng" for precise map pins (optional)
  img_key: string;
  hero_image: string;
  tagline: string;
  seo: { title: string; description: string };
  pricing: Pricing;
  capacity: { sleeps: number; max_adults: number; max_children: number; bedrooms: number; bathrooms: number };
  hours: { check_in: string; check_out: string };
  timezone: string; // IANA tz of the property (e.g. Europe/Bucharest), for on-site events
  guest_info: { house_rules: string; checkin_instructions: string; wifi: string; guidebook: string };
  google_review_url: string; // public Google review link for this property's listing
  costs: { monthly_overhead_eur: number; cleaning_per_stay_eur: number; variable_per_night_eur: number };
  guidebook: Guidebook;
  hero_stats: { n: string; label: string }[];
  aside_facts: { label: string; value: string }[];
  story_heading: string;
  story: string[];
  features: { title: string; image: string; text: string }[];
  gallery: { max: number; images: { file: string; caption: string; area?: string }[] };
  videos: { provider: string; id: string; title: string }[];
  amenities: { category: string; items: string[] }[];
  setting: { heading: string; lead: string; map_image: string; proximity: { value: string; text: string }[] };
  addons: { icon: string; title: string; text: string; value: string; price_eur?: number; unit?: "night" | "day" | "stay" | "each"; min_qty?: number; max_qty?: number; qty_noun?: string }[];
  card: { image: string; desc: string; tags: string[] };
  cross_sell: string;
  [key: string]: unknown;
};

import { prisma } from "./prisma";

// Fill in any missing fields so an incomplete property (e.g. a fresh draft)
// never crashes a page that maps over its arrays.
function normalize(p: Partial<Property>): Property {
  const pricing = (p.pricing || {}) as Property["pricing"];
  const dynamic = pricing.dynamic;
  return {
    // Keep any extra/unknown fields, but the normalised fields below always win.
    ...p,
    slug: p.slug || "",
    name: p.name || "",
    status: p.status || "draft",
    tier: p.tier === "residence" ? "residence" : "estate",
    order: p.order ?? 99,
    location: p.location || "",
    address: p.address || "",
    coords: p.coords || "",
    img_key: p.img_key || "",
    hero_image: p.hero_image || "",
    tagline: p.tagline || "",
    seo: { title: p.seo?.title || "", description: p.seo?.description || "" },
    pricing: {
      base_nightly_eur: pricing.base_nightly_eur || 0,
      weekend_nightly_eur: pricing.weekend_nightly_eur,
      currency: pricing.currency || "eur",
      min_nights: pricing.min_nights || 1,
      deposit_eur: pricing.deposit_eur,
      charge_now_pct: pricing.charge_now_pct,
      balance_days_before: pricing.balance_days_before,
      dynamic: dynamic
        ? {
            enabled: !!dynamic.enabled,
            floor_eur: dynamic.floor_eur || 0,
            ceiling_eur: dynamic.ceiling_eur || 0,
            occupancy: dynamic.occupancy
              ? {
                  enabled: !!dynamic.occupancy.enabled,
                  window_days: dynamic.occupancy.window_days || 30,
                  max_uplift_pct: dynamic.occupancy.max_uplift_pct || 0,
                }
              : undefined,
          }
        : undefined,
      seasonal: pricing.seasonal || [],
      los_discounts: pricing.los_discounts
        ? { weekly_pct: pricing.los_discounts.weekly_pct || 0, monthly_pct: pricing.los_discounts.monthly_pct || 0 }
        : undefined,
      lastminute: pricing.lastminute
        ? { days: pricing.lastminute.days || 0, pct: pricing.lastminute.pct || 0 }
        : undefined,
    },
    capacity: {
      sleeps: p.capacity?.sleeps || 1,
      max_adults: p.capacity?.max_adults || 1,
      max_children: p.capacity?.max_children || 0,
      bedrooms: p.capacity?.bedrooms || 1,
      bathrooms: p.capacity?.bathrooms || 1,
    },
    hours: { check_in: p.hours?.check_in || "16:00", check_out: p.hours?.check_out || "11:00" },
    timezone: p.timezone || "Europe/Bucharest",
    guest_info: {
      house_rules: p.guest_info?.house_rules || "",
      checkin_instructions: p.guest_info?.checkin_instructions || "",
      wifi: p.guest_info?.wifi || "",
      guidebook: p.guest_info?.guidebook || "",
    },
    google_review_url: p.google_review_url || "",
    costs: {
      monthly_overhead_eur: p.costs?.monthly_overhead_eur || 0,
      cleaning_per_stay_eur: p.costs?.cleaning_per_stay_eur || 0,
      variable_per_night_eur: p.costs?.variable_per_night_eur || 0,
    },
    guidebook: {
      enabled: !!p.guidebook?.enabled,
      intro: p.guidebook?.intro || "",
      sections: Array.isArray(p.guidebook?.sections) ? p.guidebook!.sections : [],
    },
    hero_stats: p.hero_stats || [],
    aside_facts: p.aside_facts || [],
    story_heading: p.story_heading || "",
    story: p.story || [],
    features: p.features || [],
    gallery: { max: p.gallery?.max || 12, images: p.gallery?.images || [] },
    videos: p.videos || [],
    amenities: p.amenities || [],
    setting: {
      heading: p.setting?.heading || "",
      lead: p.setting?.lead || "",
      map_image: p.setting?.map_image || "",
      proximity: p.setting?.proximity || [],
    },
    addons: p.addons || [],
    card: { image: p.card?.image || "", desc: p.card?.desc || "", tags: p.card?.tags || [] },
    cross_sell: p.cross_sell || "",
  } as Property;
}

// Properties are stored in the database (managed from the admin). The `data`
// column holds the full property object, normalised so no field is ever missing.
function parse(row: { data: string }): Property {
  return normalize(JSON.parse(row.data) as Partial<Property>);
}

// Live properties, ordered. Pass includeDrafts for the admin.
export async function getProperties(includeDrafts = false): Promise<Property[]> {
  const rows = await prisma.property.findMany({
    where: includeDrafts ? undefined : { status: "live" },
    orderBy: [{ order: "asc" }, { name: "asc" }],
  });
  return rows.map(parse);
}

export async function getProperty(slug: string): Promise<Property | null> {
  const row = await prisma.property.findUnique({ where: { slug } });
  return row ? parse(row) : null;
}

// Resolve the best available web image for a photo basename (prefers per-property folder).
export function imageUrl(imgKey: string, base: string, width = 1400): string {
  if (/^(https?:\/\/|\/)/.test(base)) return base; // uploaded photo (full URL or proxy path)
  const dirs = [
    { dir: `assets/img/${imgKey}`, fsdir: path.join(process.cwd(), "public", "assets", "img", imgKey) },
    { dir: `assets/img`, fsdir: path.join(process.cwd(), "public", "assets", "img") },
  ];
  for (const { dir, fsdir } of dirs) {
    const widths = [800, 1400, 2000].filter((w) => fs.existsSync(path.join(fsdir, `${base}-${w}.webp`)));
    if (widths.length) {
      const pick = Math.max(...widths.filter((w) => w <= width).concat([Math.min(...widths)]));
      return `/${dir}/${base}-${pick}.webp`;
    }
    if (fs.existsSync(path.join(fsdir, `${base}.jpg`))) return `/${dir}/${base}.jpg`;
  }
  return `/assets/img/${imgKey}/${base}.jpg`;
}

// Format a timestamp in a specific timezone (for on-site property events).
// Deterministic (fixed tz) so it is safe to render on the server.
export function fmtInTz(d: Date, tz: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }): string {
  try {
    return new Date(d).toLocaleString("en-GB", { ...opts, timeZone: tz });
  } catch {
    return new Date(d).toLocaleString("en-GB", opts);
  }
}

export function priceLabel(p: Property): string {
  return `From €${p.pricing.base_nightly_eur.toLocaleString("en-US")} / night`;
}

// Build a responsive srcset (existing widths only), plus a jpg fallback src.
export function imageSet(imgKey: string, base: string): { src: string; srcSet?: string } {
  if (/^(https?:\/\/|\/)/.test(base)) return { src: base }; // uploaded photo (full URL or proxy path)
  const dirs = [
    { dir: `assets/img/${imgKey}`, fsdir: path.join(process.cwd(), "public", "assets", "img", imgKey) },
    { dir: `assets/img`, fsdir: path.join(process.cwd(), "public", "assets", "img") },
  ];
  for (const { dir, fsdir } of dirs) {
    const widths = [800, 1400].filter((w) => fs.existsSync(path.join(fsdir, `${base}-${w}.webp`)));
    if (widths.length || fs.existsSync(path.join(fsdir, `${base}.jpg`))) {
      const srcSet = widths.map((w) => `/${dir}/${base}-${w}.webp ${w}w`).join(", ") || undefined;
      return { src: `/${dir}/${base}.jpg`, srcSet };
    }
  }
  return { src: `/assets/img/${imgKey}/${base}.jpg` };
}
