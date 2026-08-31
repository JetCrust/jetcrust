"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Manually add an Airbnb/Booking/VRBO stay. Feeds from those channels rarely carry
// the guest's name, so real reservations can't always be told apart from calendar
// blocks automatically. This lets the host add the real ones by hand for check-in/out.
export default function AddOtaStay({ properties }: { properties: { slug: string; name: string }[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [f, setF] = useState({
    propertySlug: properties[0]?.slug || "",
    channel: "Airbnb",
    guestName: "",
    checkIn: "",
    checkOut: "",
    guests: "2",
  });

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setF({ ...f, [k]: e.target.value });

  async function submit() {
    setErr(null);
    if (!f.propertySlug || !f.checkIn || !f.checkOut) { setErr("Pick a property and both dates."); return; }
    setBusy(true);
    const res = await fetch("/api/admin/ota-stay", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        propertySlug: f.propertySlug, channel: f.channel, guestName: f.guestName,
        checkIn: f.checkIn, checkOut: f.checkOut, guests: Number(f.guests) || 2,
      }),
    });
    if (res.ok) { const d = await res.json(); router.push(`/admin/bookings/${d.id}`); router.refresh(); return; }
    const d = await res.json().catch(() => ({}));
    setErr(d.error || "Could not add the stay."); setBusy(false);
  }

  if (!open) {
    return (
      <button className="btn btn--ghost" onClick={() => setOpen(true)}>+ Add OTA stay</button>
    );
  }

  const field: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.3rem", fontSize: "0.85rem" };
  const input: React.CSSProperties = { padding: "0.5rem 0.6rem", borderRadius: 8, border: "1px solid #d5dde6", font: "inherit" };

  return (
    <div className="panel" style={{ marginBottom: "1.6rem" }}>
      <div className="panel__head">
        <h3>Add an OTA stay</h3>
        <button className="btn btn--ghost" onClick={() => setOpen(false)} style={{ padding: "0.2rem 0.6rem" }}>Close</button>
      </div>
      <p className="panel__hint">For real Airbnb / Booking / VRBO reservations that the calendar feed can&rsquo;t label. No payment is taken here.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "0.9rem" }}>
        <label style={field}>Property
          <select value={f.propertySlug} onChange={set("propertySlug")} style={input}>
            {properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
        </label>
        <label style={field}>Channel
          <select value={f.channel} onChange={set("channel")} style={input}>
            <option>Airbnb</option><option>Booking.com</option><option>VRBO</option><option>Other</option>
          </select>
        </label>
        <label style={field}>Guest name (optional)
          <input value={f.guestName} onChange={set("guestName")} placeholder="e.g. Maria" style={input} />
        </label>
        <label style={field}>Check-in
          <input type="date" value={f.checkIn} onChange={set("checkIn")} style={input} />
        </label>
        <label style={field}>Check-out
          <input type="date" value={f.checkOut} onChange={set("checkOut")} style={input} />
        </label>
        <label style={field}>Guests
          <input type="number" min={1} max={64} value={f.guests} onChange={set("guests")} style={input} />
        </label>
      </div>
      {err && <p style={{ color: "#a3412e", fontSize: "0.85rem", marginTop: "0.8rem" }}>{err}</p>}
      <div style={{ marginTop: "1rem" }}>
        <button className="btn btn--primary" disabled={busy} onClick={submit}>{busy ? "Adding…" : "Add stay"}</button>
      </div>
    </div>
  );
}
