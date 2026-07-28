"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Addon = { title: string; value: string; text: string };

export default function BookingManage({
  bookingId,
  catalog,
  currentAddons,
  guests,
  maxGuests,
}: {
  bookingId: string;
  catalog: Addon[];
  currentAddons: string[];
  guests: number;
  maxGuests: number;
}) {
  const router = useRouter();
  const [addons, setAddons] = useState<string[]>(currentAddons);
  const [g, setG] = useState(guests);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setMsg(null);
    setErr(null);
    const res = await fetch(`/api/bookings/${bookingId}/manage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addons, guests: g, message: message || undefined }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setErr(d.error || "Could not save."); setBusy(false); return; }
    setMsg("Saved. We have let the host know.");
    setMessage("");
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="ef" style={{ marginTop: "1.5rem" }}>
      <div className="full">
        <label>Add to your stay</label>
        <div className="addon-checks">
          {catalog.map((a) => (
            <label className="addon-check" key={a.value}>
              <input
                type="checkbox"
                checked={addons.includes(a.value)}
                onChange={(e) => setAddons((p) => (e.target.checked ? [...p, a.value] : p.filter((v) => v !== a.value)))}
              />
              {a.title}
            </label>
          ))}
        </div>
      </div>
      <div>
        <label>Guests</label>
        <input type="number" min={1} max={maxGuests} value={g} onChange={(e) => setG(Number(e.target.value))} />
      </div>
      <div className="full">
        <label>Request a change or add a note</label>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Different dates, a special request, anything at all" />
      </div>
      {err && <p className="full" style={{ color: "#a3412e", margin: 0, fontSize: "0.9rem" }}>{err}</p>}
      {msg && <p className="full" style={{ color: "var(--brass)", margin: 0, fontSize: "0.9rem" }}>{msg}</p>}
      <div className="full">
        <button className="btn btn--brass" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save changes"}</button>
        <p className="note" style={{ marginTop: "0.7rem", color: "var(--stone)", fontSize: "0.8rem" }}>
          Add-ons and guest numbers update straight away and we notify the host. Date changes are handled personally.
        </p>
      </div>
    </div>
  );
}
