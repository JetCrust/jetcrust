"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

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
    dynamic?: { enabled: boolean; floor_eur: number; ceiling_eur: number; occupancy?: { enabled: boolean; window_days: number; max_uplift_pct: number } };
    seasonal?: Seasonal[];
  };
  capacity: { sleeps: number; max_adults: number; max_children: number; bedrooms: number; bathrooms: number };
  hours: { check_in: string; check_out: string };
  story_heading?: string;
  story?: string[];
  gallery?: { max: number; images: { file: string; caption: string }[] };
  card?: { image: string; desc: string; tags: string[] };
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
        </div>

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
        </div>
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
          <div className="full"><label>Gallery images (one per line: file | caption)</label><textarea value={galleryText} onChange={(e) => setGalleryText(e.target.value)} placeholder="castelaria-01 | The great hall" style={{ minHeight: 120 }} /></div>
          <div className="full"><label>Story heading</label><input value={o.story_heading || ""} onChange={(e) => set({ story_heading: e.target.value })} /></div>
          <div className="full"><label>Story (one paragraph per line)</label><textarea value={(o.story || []).join("\n")} onChange={(e) => set({ story: e.target.value.split("\n").filter((l) => l.trim()) })} style={{ minHeight: 120 }} /></div>
        </div>
        <p className="panel__hint" style={{ marginBottom: 0 }}>Photos are referenced by file name for now. Once you are live on hosting, you will upload them here directly.</p>
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
