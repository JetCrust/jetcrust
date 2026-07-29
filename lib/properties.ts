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
};

import type { Guidebook } from "./guidebook";

export type Property = {
  slug: string;
  name: string;
  status: string;
  order: number;
  location: string;
  img_key: string;
  hero_image: string;
  tagline: string;
  seo: { title: string; description: string };
  pricing: Pricing;
  capacity: { sleeps: number; max_adults: number; max_children: number; bedrooms: number; bathrooms: number };
  hours: { check_in: string; check_out: string };
  timezone: string; // IANA tz of the property (e.g. Europe/Bucharest), for on-site events
  guest_info: { house_rules: string; checkin_instructions: string; wifi: string; guidebook: string };
  guidebook: Guidebook;
  hero_stats: { n: string; label: string }[];
  aside_facts: { label: string; value: string }[];
  story_heading: string;
  story: string[];
  features: { title: string; image: string; text: string }[];
  gallery: { max: number; images: { file: string; caption: string }[] };
  videos: { provider: string; id: string; title: string }[];
  amenities: { category: string; items: string[] }[];
  setting: { heading: string; lead: string; map_image: string; proximity: { value: string; text: string }[] };
  addons: { icon: string; title: string; text: string; value: string; price_eur?: number; unit?: "night" | "day" | "stay" }[];
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
    order: p.order ?? 99,
    location: p.location || "",
    img_key: p.img_key || "",
    hero_image: p.hero_image || "",
    tagline: p.tagline || "",
    seo: { title: p.seo?.title || "", description: p.seo?.description || "" },
    pricing: {
      base_nightly_eur: pricing.base_nightly_eur || 0,
      weekend_nightly_eur: pricing.weekend_nightly_eur,
      currency: pricing.currency || "eur",
      min_nights: pricing.min_nights || 1,
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
