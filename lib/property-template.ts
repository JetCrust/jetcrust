// A blank property object for creating a home from scratch. Same shape the app
// already uses. The admin editor fills these in; photos are added once live.
export function blankProperty() {
  return {
    slug: "",
    name: "",
    status: "draft",
    order: 99,
    location: "",
    img_key: "",
    hero_image: "",
    tagline: "",
    seo: { title: "", description: "" },
    pricing: {
      base_nightly_eur: 0,
      weekend_nightly_eur: 0,
      currency: "eur",
      min_nights: 2,
      deposit_eur: 0,
      dynamic: {
        enabled: false,
        floor_eur: 0,
        ceiling_eur: 0,
        occupancy: { enabled: false, window_days: 30, max_uplift_pct: 0 },
      },
      seasonal: [] as { name: string; from: string; to: string; nightly_eur: number }[],
      los_discounts: { weekly_pct: 0, monthly_pct: 0 },
      // Near-term deals, both off until you switch them on per property.
      lastminute: { enabled: false, days: 30, pct: 20, floor_eur: 0, taper: true },
      orphan: { enabled: false, max_gap_nights: 2, pct: 30, window_days: 45, floor_eur: 0 },
    },
    capacity: { sleeps: 2, max_adults: 2, max_children: 0, bedrooms: 1, bathrooms: 1 },
    hours: { check_in: "16:00", check_out: "11:00" },
    hero_stats: [] as { n: string; label: string }[],
    aside_facts: [] as { label: string; value: string }[],
    story_heading: "",
    story: [] as string[],
    features: [] as { title: string; image: string; text: string }[],
    gallery: { max: 12, images: [] as { file: string; caption: string }[] },
    videos: [] as { provider: string; id: string; title: string }[],
    amenities: [] as { category: string; items: string[] }[],
    setting: { heading: "", lead: "", map_image: "", proximity: [] as { value: string; text: string }[] },
    addons: [] as { icon: string; title: string; text: string; value: string; price_eur?: number; unit?: string }[],
    card: { image: "", desc: "", tags: [] as string[] },
    cross_sell: "",
  };
}
