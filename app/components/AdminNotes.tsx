"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Internal host notes on a booking. Saved separately from the guest's own note.
export default function AdminNotes({ bookingId, initial }: { bookingId: string; initial: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== initial;

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch(`/api/admin/bookings/${bookingId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ adminNotes: value }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not save the note.");
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <div className="ef" style={{ gridTemplateColumns: "1fr" }}>
      <div className="full">
        <textarea
          value={value}
          onChange={(e) => { setValue(e.target.value); setSaved(false); }}
          placeholder="Arrival time, gate code, special requests, follow-ups…"
        />
      </div>
      <div className="full" style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="btn btn--brass" disabled={busy || !dirty} onClick={save}>
          {busy ? "Saving…" : "Save note"}
        </button>
        {saved && <span style={{ fontSize: "0.85rem", color: "var(--forest)" }}>Saved.</span>}
        {error && <span style={{ fontSize: "0.85rem", color: "#a3412e" }}>{error}</span>}
      </div>
    </div>
  );
}
