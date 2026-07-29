"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { uploadPhoto } from "./photoUpload";

/* Minimal shapes for the fields the editor touches. The full object is passed
   through untouched, so advanced fields (features, amenities, etc.) are preserved. */
type Addon = { icon?: string; title: string; value: string; text?: string; price_eur?: number; unit?: string };
type Seasonal = { name: string; from: string; to: string; nightly_eur: number };
type PropObj = {
  slug: string;
  name: string;
  status: string;
  order: number;
  location: string;
  img_key: string;
  hero_image: string;
  tagline: string;
  cross_sell?: string;
  seo: { title: string; description: string };
  pricing: {
    base_nightly_eur: number;
    weekend_nightly_eur?: number;
    currency: string;
    min_nights: number;
    deposit_eur?: number;
    charge_now_pct?: number;
    balance_days_before?: number;
    dynamic?: { enabled: boolean; floor_eur: number; ceiling_eur: number; occupancy?: { enabled: boolean; window_days: number; max_uplift_pct: number } };
    seasonal?: Seasonal[];
    los_discounts?: { weekly_pct: number; monthly_pct: number };
    lastminute?: { days: number; pct: number };
  };
  capacity: { sleeps: number; max_adults: number; max_children: number; bedrooms: number; bathrooms: number };
  hours: { check_in: string; check_out: string };
  timezone?: string;
  guest_info?: { house_rules: string; checkin_instructions: string; wifi: string; guidebook: string };
  google_review_url?: string;
  costs?: { monthly_overhead_eur: number; cleaning_per_stay_eur: number; variable_per_night_eur: number };
  story_heading?: string;
  story?: string[];
  gallery?: { max: number; images: { file: string; caption: string }[] };
  card?: { image: string; desc: string; tags: string[] };
  ical_urls?: string[];
  [key: string]: unknown;
};

const UNITS = ["night", "day", "stay"];

export default function PropertyEditor({ initial, isNew }: { initial: PropObj; isNew: boolean }) {
  const router = useRouter();
  const [o, setO] = useState<PropObj>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [raw, setRaw] = useState<string>("");
  const [rawErr, setRawErr] = useState<string | null>(null);

  // Immutable-ish update helpers for nested paths.
  const set = (patch: Partial<PropObj>) => setO((s) => ({ ...s, ...patch }));
  const setPricing = (patch: Partial<PropObj["pricing"]>) => setO((s) => ({ ...s, pricing: { ...s.pricing, ...patch } }));
  const setDynamic = (patch: Partial<NonNullable<PropObj["pricing"]["dynamic"]>>) =>
    setO((s) => ({ ...s, pricing: { ...s.pricing, dynamic: { enabled: false, floor_eur: 0, ceiling_eur: 0, occupancy: { enabled: false, window_days: 30, max_uplift_pct: 0 }, ...s.pricing.dynamic, ...patch } } }));
  const setOcc = (patch: Partial<{ enabled: boolean; window_days: number; max_uplift_pct: number }>) =>
    setDynamic({ occupancy: { enabled: false, window_days: 30, max_uplift_pct: 0, ...o.pricing.dynamic?.occupancy, ...patch } });
  const setCapacity = (patch: Partial<PropObj["capacity"]>) => setO((s) => ({ ...s, capacity: { ...s.capacity, ...patch } }));
  const setHours = (patch: Partial<PropObj["hours"]>) => setO((s) => ({ ...s, hours: { ...s.hours, ...patch } }));
  const setGuestInfo = (patch: Partial<NonNullable<PropObj["guest_info"]>>) =>
    setO((s) => ({ ...s, guest_info: { house_rules: "", checkin_instructions: "", wifi: "", guidebook: "", ...s.guest_info, ...patch } }));
  const setCosts = (patch: Partial<NonNullable<PropObj["costs"]>>) =>
    setO((s) => ({ ...s, costs: { monthly_overhead_eur: 0, cleaning_per_stay_eur: 0, variable_per_night_eur: 0, ...s.costs, ...patch } }));

  const galFileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  async function uploadGallery(list: FileList | null) {
    if (!list?.length) return;
    setUploading(true);
    const added: string[] = [];
    for (const f of Array.from(list)) {
      const url = await uploadPhoto(f);
      if (url) added.push(`${url} | `);
    }
    setUploading(false);
    if (added.length) {
      const cur = (o.gallery?.images || []).map((g) => `${g.file} | ${g.caption}`).join("\n");
      setGalleryText((cur ? cur + "\n" : "") + added.join("\n"));
    }
    if (galFileRef.current) galFileRef.current.value = "";
  }
  const setSeo = (patch: Partial<PropObj["seo"]>) => setO((s) => ({ ...s, seo: { ...s.seo, ...patch } }));
  const setCard = (patch: Partial<NonNullable<PropObj["card"]>>) => setO((s) => ({ ...s, card: { image: "", desc: "", tags: [], ...s.card, ...patch } }));

  const num = (v: string) => (v === "" ? 0 : Number(v));

  // Add-ons
  const addons = o.addons as Addon[] | undefined;
  const setAddon = (i: number, patch: Partial<Addon>) =>
    setO((s) => ({ ...s, addons: (s.addons as Addon[]).map((a, j) => (j === i ? { ...a, ...patch } : a)) }));
  const addAddon = () => setO((s) => ({ ...s, addons: [...((s.addons as Addon[]) || []), { title: "", value: "", text: "", price_eur: 0, unit: "stay", icon: "✦" }] }));
  const removeAddon = (i: number) => setO((s) => ({ ...s, addons: (s.addons as Addon[]).filter((_, j) => j !== i) }));

  // Seasonal rates
  const seasonal = o.pricing.seasonal || [];
  const setSeason = (i: number, patch: Partial<Seasonal>) =>
    setPricing({ seasonal: seasonal.map((sn, j) => (j === i ? { ...sn, ...patch } : sn)) });
  const addSeason = () => setPricing({ seasonal: [...seasonal, { name: "", from: "12-20", to: "01-05", nightly_eur: 0 }] });
  const removeSeason = (i: number) => setPricing({ seasonal: seasonal.filter((_, j) => j !== i) });

  // Gallery as "file | caption" lines
  const galleryText = (o.gallery?.images || []).map((g) => `${g.file} | ${g.caption}`).join("\n");
  const setGalleryText = (t: string) => {
    const images = t.split("\n").map((l) => l.split("|")).filter((p) => p[0]?.trim()).map((p) => ({ file: p[0].trim(), caption: (p[1] || "").trim() }));
    setO((s) => ({ ...s, gallery: { max: s.gallery?.max || 12, images } }));
  };

  async function save(status?: "live" | "draft") {
    setBusy(true);
    setError(null);
    const payload = { ...o, status: status || o.status };
    const res = isNew
      ? await fetch("/api/admin/properties", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: payload }) })
      : await fetch(`/api/admin/properties/${o.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: payload }) });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Could not save."); setBusy(false); return; }
    router.push("/admin/properties");
    router.refresh();
  }

  async function duplicate() {
    if (isNew) return;
    setBusy(true);
    const res = await fetch(`/api/admin/properties/${o.slug}/duplicate`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok && d.slug) router.push(`/admin/properties/${d.slug}/edit`);
  }

  async function remove() {
    if (isNew || !confirm(`Delete ${o.name}? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/properties/${o.slug}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Could not delete."); setBusy(false); return; }
    router.push("/admin/properties");
    router.refresh();
  }

  function applyRaw() {
    try {
      const parsed = JSON.parse(raw);
      setO(parsed);
      setRawErr(null);
    } catch {
      setRawErr("That is not valid JSON.");
    }
  }

  return (
    <div className="stack">
      {/* Basics */}
      <div className="panel">
        <div className="panel__head"><h3>Basics</h3></div>
        <div className="ef">
          <div><label>Name</label><input value={o.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label>Location</label><input value={o.location} onChange={(e) => set({ location: e.target.value })} placeholder="Bran · Transylvania" /></div>
          <div>
            <label>Status</label>
            <select value={o.status} onChange={(e) => set({ status: e.target.value })}>
              <option value="draft">Draft (hidden)</option>
              <option value="live">Live (public)</option>
            </select>
          </div>
          <div><label>Order</label><input type="number" value={o.order} onChange={(e) => set({ order: num(e.target.value) })} /></div>
          <div className="full"><label>Tagline</label><input value={o.tagline} onChange={(e) => set({ tagline: e.target.value })} /></div>
          {!isNew && <div><label>Web address</label><input value={`/${o.slug}`} readOnly /></div>}
          <div><label>Photo folder key</label><input value={o.img_key} onChange={(e) => set({ img_key: e.target.value })} placeholder="e.g. castelaria" /></div>
        </div>
        {isNew && <p className="panel__hint" style={{ marginBottom: 0 }}>The web address is created from the name when you save, and cannot change afterwards.</p>}
      </div>

      {/* SEO */}
      <div className="panel">
        <div className="panel__head"><h3>Search & sharing</h3></div>
        <div className="ef">
          <div className="full"><label>SEO title</label><input value={o.seo.title} onChange={(e) => setSeo({ title: e.target.value })} /></div>
          <div className="full"><label>SEO description</label><textarea value={o.seo.description} onChange={(e) => setSeo({ description: e.target.value })} /></div>
        </div>
      </div>

      {/* Pricing */}
      <div className="panel">
        <div className="panel__head"><h3>Pricing</h3></div>
        <div className="ef">
          <div><label>Base nightly (€)</label><input type="number" value={o.pricing.base_nightly_eur} onChange={(e) => setPricing({ base_nightly_eur: num(e.target.value) })} /></div>
          <div><label>Weekend nightly (€)</label><input type="number" value={o.pricing.weekend_nightly_eur || 0} onChange={(e) => setPricing({ weekend_nightly_eur: num(e.target.value) })} /></div>
          <div><label>Minimum nights</label><input type="number" value={o.pricing.min_nights} onChange={(e) => setPricing({ min_nights: num(e.target.value) })} /></div>
          <div><label>Security deposit (€)</label><input type="number" value={o.pricing.deposit_eur || 0} onChange={(e) => setPricing({ deposit_eur: num(e.target.value) })} /></div>
          <div><label>Charge at approval (%)</label><input type="number" min={1} max={100} value={o.pricing.charge_now_pct || 100} onChange={(e) => setPricing({ charge_now_pct: num(e.target.value) })} /></div>
          <div><label>Balance due (days before arrival)</label><input type="number" value={o.pricing.balance_days_before ?? 30} onChange={(e) => setPricing({ balance_days_before: num(e.target.value) })} /></div>
        </div>
        <p className="panel__hint" style={{ marginBottom: 0 }}>Charge at approval: 100% takes the full stay when you approve. A lower figure (e.g. 50%) charges that share now and auto-charges the rest the set number of days before arrival. You can still change the amount on each booking when you approve it.</p>

        <p className="panel__hint" style={{ marginTop: "1.2rem", marginBottom: "0.4rem" }}>Seasonal / holiday rates</p>
        {seasonal.map((sn, i) => (
          <div className="ef" key={i} style={{ marginBottom: "0.6rem" }}>
            <div><label>Name</label><input value={sn.name} onChange={(e) => setSeason(i, { name: e.target.value })} placeholder="Festive season" /></div>
            <div><label>From (MM-DD)</label><input value={sn.from} onChange={(e) => setSeason(i, { from: e.target.value })} placeholder="12-20" /></div>
            <div><label>To (MM-DD)</label><input value={sn.to} onChange={(e) => setSeason(i, { to: e.target.value })} placeholder="01-05" /></div>
            <div><label>Nightly (€)</label><input type="number" value={sn.nightly_eur} onChange={(e) => setSeason(i, { nightly_eur: num(e.target.value) })} /></div>
            <div className="full"><button type="button" className="textlink" style={{ background: "none", border: 0, cursor: "pointer", color: "#a3412e" }} onClick={() => removeSeason(i)}>Remove this season</button></div>
          </div>
        ))}
        <button type="button" className="btn btn--ghost" onClick={addSeason} style={{ marginTop: "0.4rem" }}>Add a seasonal rate</button>

        <p className="panel__hint" style={{ marginTop: "1.4rem", marginBottom: "0.4rem" }}>Length-of-stay discounts (off the stay, before add-ons)</p>
        <div className="ef">
          <div><label>Weekly (7+ nights) %</label><input type="number" value={o.pricing.los_discounts?.weekly_pct || 0} onChange={(e) => setPricing({ los_discounts: { weekly_pct: num(e.target.value), monthly_pct: o.pricing.los_discounts?.monthly_pct || 0 } })} placeholder="e.g. 5" /></div>
          <div><label>Monthly (28+ nights) %</label><input type="number" value={o.pricing.los_discounts?.monthly_pct || 0} onChange={(e) => setPricing({ los_discounts: { weekly_pct: o.pricing.los_discounts?.weekly_pct || 0, monthly_pct: num(e.target.value) } })} placeholder="e.g. 10" /></div>
        </div>

        <p className="panel__hint" style={{ marginTop: "1.2rem", marginBottom: "0.4rem" }}>Last-minute discount (fills near, unsold dates)</p>
        <div className="ef">
          <div><label>Within (days of arrival)</label><input type="number" value={o.pricing.lastminute?.days || 0} onChange={(e) => setPricing({ lastminute: { days: num(e.target.value), pct: o.pricing.lastminute?.pct || 0 } })} placeholder="e.g. 7" /></div>
          <div><label>Discount %</label><input type="number" value={o.pricing.lastminute?.pct || 0} onChange={(e) => setPricing({ lastminute: { days: o.pricing.lastminute?.days || 0, pct: num(e.target.value) } })} placeholder="e.g. 15" /></div>
        </div>

        <p className="panel__hint" style={{ marginTop: "1.4rem", marginBottom: "0.4rem" }}>Demand pricing (same price for everyone, rises as the calendar fills)</p>
        <div className="ef">
          <div className="full">
            <label className="addon-check">
              <input type="checkbox" checked={!!o.pricing.dynamic?.enabled} onChange={(e) => setDynamic({ enabled: e.target.checked })} />
              <span>Turn on demand pricing for this home</span>
            </label>
          </div>
          {o.pricing.dynamic?.enabled && (
            <>
              <div><label>Floor (€)</label><input type="number" value={o.pricing.dynamic?.floor_eur || 0} onChange={(e) => setDynamic({ floor_eur: num(e.target.value) })} /></div>
              <div><label>Ceiling (€)</label><input type="number" value={o.pricing.dynamic?.ceiling_eur || 0} onChange={(e) => setDynamic({ ceiling_eur: num(e.target.value) })} /></div>
              <div><label>Window (days)</label><input type="number" value={o.pricing.dynamic?.occupancy?.window_days || 30} onChange={(e) => setOcc({ enabled: true, window_days: num(e.target.value) })} /></div>
              <div><label>Max uplift (%)</label><input type="number" value={o.pricing.dynamic?.occupancy?.max_uplift_pct || 0} onChange={(e) => setOcc({ enabled: true, max_uplift_pct: num(e.target.value) })} /></div>
            </>
          )}
        </div>
      </div>

      {/* Capacity */}
      <div className="panel">
        <div className="panel__head"><h3>Capacity & hours</h3></div>
        <div className="ef">
          <div><label>Sleeps</label><input type="number" value={o.capacity.sleeps} onChange={(e) => setCapacity({ sleeps: num(e.target.value) })} /></div>
          <div><label>Max adults</label><input type="number" value={o.capacity.max_adults} onChange={(e) => setCapacity({ max_adults: num(e.target.value) })} /></div>
          <div><label>Max children</label><input type="number" value={o.capacity.max_children} onChange={(e) => setCapacity({ max_children: num(e.target.value) })} /></div>
          <div><label>Bedrooms</label><input type="number" value={o.capacity.bedrooms} onChange={(e) => setCapacity({ bedrooms: num(e.target.value) })} /></div>
          <div><label>Bathrooms</label><input type="number" value={o.capacity.bathrooms} onChange={(e) => setCapacity({ bathrooms: num(e.target.value) })} /></div>
          <div><label>Check-in</label><input value={o.hours.check_in} onChange={(e) => setHours({ check_in: e.target.value })} /></div>
          <div><label>Check-out</label><input value={o.hours.check_out} onChange={(e) => setHours({ check_out: e.target.value })} /></div>
          <div>
            <label>Timezone</label>
            <select value={o.timezone || "Europe/Bucharest"} onChange={(e) => set({ timezone: e.target.value })}>
              {["Europe/Bucharest", "Europe/London", "Europe/Paris", "America/New_York", "America/Los_Angeles", "America/Chicago", "Asia/Dubai", "Asia/Singapore"].map((tz) => <option key={tz} value={tz}>{tz.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>
        <p className="panel__hint" style={{ marginBottom: 0 }}>Check-in/out and arrival times show in this timezone (the property’s local time), wherever you are viewing from.</p>
      </div>

      {/* Guest info & guidebook */}
      <div className="panel">
        <div className="panel__head"><h3>Guest info & guidebook</h3></div>
        {!isNew && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap", background: "var(--cream-2, #f6f2ea)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm, 10px)", padding: "0.9rem 1.1rem", marginBottom: "1rem" }}>
            <div>
              <strong>Digital guidebook</strong>
              <p className="panel__hint" style={{ margin: "0.15rem 0 0" }}>The full mobile guidebook guests see — sections, rooms, Wi-Fi, local picks, videos.</p>
            </div>
            <a className="btn btn--dark" style={{ flex: "0 0 auto" }} href={`/admin/properties/${o.slug}/guidebook`}>Edit guidebook →</a>
          </div>
        )}
        <p className="panel__hint">The fields below are a simple fallback shown in the booking when the guidebook is empty. Leave blank to hide a section.</p>
        <div className="ef">
          <div className="full"><label>House rules</label><textarea value={o.guest_info?.house_rules || ""} onChange={(e) => setGuestInfo({ house_rules: e.target.value })} placeholder="Quiet hours, no smoking indoors, pets, events…" style={{ minHeight: 90 }} /></div>
          <div className="full"><label>Check-in instructions</label><textarea value={o.guest_info?.checkin_instructions || ""} onChange={(e) => setGuestInfo({ checkin_instructions: e.target.value })} placeholder="Directions, gate/lockbox code guidance, parking, who to call on arrival…" style={{ minHeight: 90 }} /></div>
          <div className="full"><label>WiFi & access</label><textarea value={o.guest_info?.wifi || ""} onChange={(e) => setGuestInfo({ wifi: e.target.value })} placeholder="Network name + password, smart-home notes…" style={{ minHeight: 60 }} /></div>
          <div className="full"><label>Digital guidebook (recommendations)</label><textarea value={o.guest_info?.guidebook || ""} onChange={(e) => setGuestInfo({ guidebook: e.target.value })} placeholder="Restaurants, sights, transport, appliance tips, emergency contacts…" style={{ minHeight: 120 }} /></div>
          <div className="full"><label>Google review link</label><input value={o.google_review_url || ""} onChange={(e) => set({ google_review_url: e.target.value })} placeholder="https://g.page/r/…/review  (from Google Business → Ask for reviews)" /><p className="panel__hint" style={{ margin: "0.25rem 0 0" }}>After a guest leaves us feedback, we invite them to share it on Google using this link.</p></div>
        </div>
      </div>

      {/* Costs & overhead */}
      <div className="panel">
        <div className="panel__head"><h3>Costs & overhead</h3></div>
        <p className="panel__hint">What this home costs you, so the P&amp;L shows true profit and your prices stay above cost. These feed Finance automatically.</p>
        <div className="ef">
          <div><label>Fixed overhead (€ / month)</label><input type="number" value={o.costs?.monthly_overhead_eur || 0} onChange={(e) => setCosts({ monthly_overhead_eur: num(e.target.value) })} placeholder="mortgage, insurance, base utilities, staff" /></div>
          <div><label>Cleaning (€ / stay)</label><input type="number" value={o.costs?.cleaning_per_stay_eur || 0} onChange={(e) => setCosts({ cleaning_per_stay_eur: num(e.target.value) })} /></div>
          <div><label>Running cost (€ / night)</label><input type="number" value={o.costs?.variable_per_night_eur || 0} onChange={(e) => setCosts({ variable_per_night_eur: num(e.target.value) })} placeholder="heating, pool/jacuzzi, utilities" /></div>
        </div>
        <p className="panel__hint" style={{ marginBottom: 0 }}>
          Break-even guide: every occupied night costs about <strong>€{(o.costs?.variable_per_night_eur || 0).toLocaleString("en-US")}</strong> to run
          (plus €{(o.costs?.cleaning_per_stay_eur || 0).toLocaleString("en-US")} cleaning per stay), on top of €{(o.costs?.monthly_overhead_eur || 0).toLocaleString("en-US")}/month you pay regardless. Keep your nightly floor comfortably above the running cost.
        </p>
      </div>

      {/* Add-ons */}
      <div className="panel">
        <div className="panel__head"><h3>Add-ons</h3></div>
        {(addons || []).map((a, i) => (
          <div className="ef" key={i} style={{ marginBottom: "0.8rem", paddingBottom: "0.8rem", borderBottom: "1px solid var(--line)" }}>
            <div><label>Title</label><input value={a.title} onChange={(e) => setAddon(i, { title: e.target.value })} /></div>
            <div><label>Key</label><input value={a.value} onChange={(e) => setAddon(i, { value: e.target.value })} placeholder="chef" /></div>
            <div><label>Price (€)</label><input type="number" value={a.price_eur || 0} onChange={(e) => setAddon(i, { price_eur: num(e.target.value) })} /></div>
            <div>
              <label>Charged</label>
              <select value={a.unit || "stay"} onChange={(e) => setAddon(i, { unit: e.target.value })}>
                {UNITS.map((u) => <option key={u} value={u}>per {u}</option>)}
              </select>
            </div>
            <div className="full"><label>Description</label><input value={a.text || ""} onChange={(e) => setAddon(i, { text: e.target.value })} /></div>
            <div className="full"><button type="button" className="textlink" style={{ background: "none", border: 0, cursor: "pointer", color: "#a3412e" }} onClick={() => removeAddon(i)}>Remove this add-on</button></div>
          </div>
        ))}
        <button type="button" className="btn btn--ghost" onClick={addAddon}>Add an add-on</button>
      </div>

      {/* Card, gallery & story */}
      <div className="panel">
        <div className="panel__head"><h3>Listing card, photos & story</h3></div>
        <div className="ef">
          <div><label>Card image (file name)</label><input value={o.card?.image || ""} onChange={(e) => setCard({ image: e.target.value })} placeholder="castelaria-aerial" /></div>
          <div><label>Hero image (file name)</label><input value={o.hero_image} onChange={(e) => set({ hero_image: e.target.value })} /></div>
          <div className="full"><label>Card description</label><textarea value={o.card?.desc || ""} onChange={(e) => setCard({ desc: e.target.value })} /></div>
          <div className="full"><label>Card tags (comma separated)</label><input value={(o.card?.tags || []).join(", ")} onChange={(e) => setCard({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} /></div>
          <div className="full">
            <label>Gallery images (one per line: file | caption)</label>
            <textarea value={galleryText} onChange={(e) => setGalleryText(e.target.value)} placeholder="castelaria-01 | The great hall" style={{ minHeight: 120 }} />
            <input ref={galFileRef} type="file" accept="image/*" multiple hidden onChange={(e) => uploadGallery(e.target.files)} />
            <button type="button" className="btn btn--ghost" style={{ marginTop: "0.5rem" }} disabled={uploading} onClick={() => galFileRef.current?.click()}>{uploading ? "Uploading…" : "＋ Upload photos"}</button>
          </div>
          <div className="full"><label>Story heading</label><input value={o.story_heading || ""} onChange={(e) => set({ story_heading: e.target.value })} /></div>
          <div className="full"><label>Story (one paragraph per line)</label><textarea value={(o.story || []).join("\n")} onChange={(e) => set({ story: e.target.value.split("\n").filter((l) => l.trim()) })} style={{ minHeight: 120 }} /></div>
        </div>
        <p className="panel__hint" style={{ marginBottom: 0 }}>Upload photos above (compressed on the device, stored on your hosting) or reference existing file names. Uploaded photos appear as full links in the list; add a caption after the “|”.</p>
      </div>

      {/* Calendar import */}
      <div className="panel">
        <div className="panel__head"><h3>Calendar import</h3></div>
        <p className="panel__hint">Paste the iCal (.ics) links from Airbnb, Booking.com, VRBO or a concierge, one per line. We pull these in every few hours (and on demand) to block those dates here.</p>
        <div className="ef">
          <div className="full">
            <textarea
              value={(o.ical_urls || []).join("\n")}
              onChange={(e) => setO((s) => ({ ...s, ical_urls: e.target.value.split("\n").map((l) => l.trim()).filter(Boolean) }))}
              placeholder="https://www.airbnb.com/calendar/ical/....ics&#10;https://ical.booking.com/v1/export?...&#10;"
              style={{ minHeight: 100 }}
            />
          </div>
        </div>
        {!isNew && (
          <p className="panel__hint" style={{ marginBottom: 0 }}>
            Your outgoing feed (give this to the channels so they see your booked dates): <code>/api/ical/{o.slug}</code>
          </p>
        )}
      </div>

      {/* Advanced */}
      <details className="panel" style={{ padding: "1.2rem 1.6rem" }}>
        <summary style={{ cursor: "pointer", fontFamily: "var(--serif)", fontSize: "1.1rem" }}>Advanced (full data)</summary>
        <p className="panel__hint" style={{ marginTop: "0.8rem" }}>For power edits (amenities, features, videos, map). Load the current data, edit, then apply.</p>
        <div className="ef">
          <div className="full" style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
            <button type="button" className="btn btn--ghost" onClick={() => { setRaw(JSON.stringify(o, null, 2)); setRawErr(null); }}>Load current data</button>
            <button type="button" className="btn btn--ghost" onClick={applyRaw} disabled={!raw}>Apply JSON</button>
          </div>
          {raw && <div className="full"><textarea value={raw} onChange={(e) => setRaw(e.target.value)} style={{ minHeight: 260, fontFamily: "monospace", fontSize: "0.8rem" }} /></div>}
          {rawErr && <p className="full" style={{ color: "#a3412e", fontSize: "0.85rem", margin: 0 }}>{rawErr}</p>}
        </div>
      </details>

      {error && <p style={{ color: "#a3412e", fontSize: "0.9rem" }}>{error}</p>}

      {/* Actions */}
      <div className="panel" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", alignItems: "center" }}>
        <button type="button" className="btn btn--brass" disabled={busy} onClick={() => save()}>{busy ? "Saving…" : isNew ? "Create property" : "Save changes"}</button>
        <button type="button" className="btn btn--ghost" disabled={busy} onClick={() => save(o.status === "live" ? "draft" : "live")}>
          {o.status === "live" ? "Save as draft" : "Save & publish"}
        </button>
        {!isNew && <button type="button" className="btn btn--ghost" disabled={busy} onClick={duplicate}>Duplicate</button>}
        {!isNew && <button type="button" className="textlink" style={{ marginLeft: "auto", background: "none", border: 0, cursor: "pointer", color: "#a3412e" }} disabled={busy} onClick={remove}>Delete</button>}
      </div>
    </div>
  );
}
