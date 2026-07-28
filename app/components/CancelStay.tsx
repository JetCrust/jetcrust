"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;

export default function CancelStay({ bookingId, refundableCents, label }: {
  bookingId: string; refundableCents: number; label: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(d.error || "Could not cancel."); return; }
    router.refresh();
  }

  return (
    <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
      <h3 style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>Cancel this stay</h3>
      <p className="panel__hint" style={{ marginTop: 0 }}>{label}</p>
      <ul className="kv" style={{ marginBottom: "1rem" }}>
        <li><span>Refund if you cancel now</span><span style={{ fontWeight: 600 }}>{money(refundableCents)}</span></li>
      </ul>
      {confirming ? (
        <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn--dark" disabled={busy} onClick={cancel}>{busy ? "Cancelling…" : `Confirm cancellation (${money(refundableCents)} back)`}</button>
          <button className="textlink" style={{ background: "none", border: "none", cursor: "pointer" }} onClick={() => setConfirming(false)}>Keep my booking</button>
        </div>
      ) : (
        <button className="btn btn--ghost" onClick={() => { setError(null); setConfirming(true); }}>Cancel this stay</button>
      )}
      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem", marginTop: "0.6rem", marginBottom: 0 }}>{error}</p>}
      <p className="note" style={{ margin: "0.7rem 0 0", color: "var(--stone)", fontSize: "0.78rem" }}>Refunds are issued to your original card and clear in 5 to 10 days. Your security deposit hold, if any, is released.</p>
    </div>
  );
}
