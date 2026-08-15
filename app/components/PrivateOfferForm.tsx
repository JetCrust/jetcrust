"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Prop = { slug: string; name: string };
type Offer = { id: string; propertySlug: string; checkIn: string; checkOut: string; priceCents: number; status: string; note: string | null };

const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;

export default function PrivateOfferForm({ email, properties, offers }: { email: string; properties: Prop[]; offers: Offer[] }) {
  const router = useRouter();
  const [slug, setSlug] = useState(properties[0]?.slug || "");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [price, setPrice] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const name = (s: string) => properties.find((p) => p.slug === s)?.name || s;

  async function create() {
    setError(null);
    const priceEur = parseFloat(price);
    if (!checkIn || !checkOut || !priceEur) { setError("Add dates and a price."); return; }
    setBusy(true);
    const res = await fetch("/api/admin/offers", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, propertySlug: slug, checkIn, checkOut, priceEur, note: note || undefined }),
    });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Could not create."); return; }
    setCheckIn(""); setCheckOut(""); setPrice(""); setNote(""); setOk(true);
    router.refresh();
  }
  async function voidOffer(id: string) {
    if (!confirm("Void this private rate?")) return;
    await fetch(`/api/admin/offers?id=${id}`, { method: "DELETE" });
    router.refresh();
  }

  const active = offers.filter((o) => o.status === "active");
  return (
    <div>
      <p className="panel__hint" style={{ marginTop: 0 }}>
        Set a private total for <strong>{email}</strong> on exact dates (e.g. to match a Booking.com price). When they book those dates signed in, they see this rate as a &ldquo;Private rate&rdquo; line, no coupon code. One-time.
      </p>
      {active.length > 0 && (
        <ul className="kv" style={{ marginBottom: "1rem" }}>
          {active.map((o) => (
            <li key={o.id}>
              <span>{name(o.propertySlug)} · {o.checkIn.slice(0, 10)} → {o.checkOut.slice(0, 10)}</span>
              <span>{money(o.priceCents)} <button className="chip" style={{ marginLeft: 6 }} onClick={() => voidOffer(o.id)}>void</button></span>
            </li>
          ))}
        </ul>
      )}
      <div className="cal-form" style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
        <label>Property<select value={slug} onChange={(e) => setSlug(e.target.value)}>{properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
        <label>Total price (€)<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="9846" /></label>
        <label>Check in<input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></label>
        <label>Check out<input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></label>
        <label style={{ gridColumn: "1 / -1" }}>Note (internal)<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Match Booking.com Genius rate" /></label>
      </div>
      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem" }}>{error}</p>}
      {ok && !error && <p style={{ color: "var(--forest, #253026)", fontSize: "0.85rem" }}>Private rate saved. They&rsquo;ll see it when they select those exact dates while signed in.</p>}
      <button className="btn btn--dark" disabled={busy} onClick={create} style={{ marginTop: "0.4rem" }}>{busy ? "Saving…" : "Add private rate"}</button>
    </div>
  );
}
