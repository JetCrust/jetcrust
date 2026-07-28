"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

export default function RefundControl({
  bookingId, totalCents, refundedCents,
}: {
  bookingId: string; totalCents: number; refundedCents: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  const remaining = totalCents - refundedCents;

  async function refund() {
    const cents = Math.round(Number(amount) * 100);
    if (!cents || cents <= 0) { setError("Enter an amount to refund."); return; }
    setBusy(true); setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}/refund`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amountCents: cents }),
    });
    setBusy(false); setConfirm(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Refund failed."); return; }
    setAmount("");
    router.refresh();
  }

  return (
    <div>
      <ul className="kv" style={{ marginBottom: "1rem" }}>
        <li><span>Stay total</span><span>{money(totalCents)}</span></li>
        {refundedCents > 0 && <li><span>Already refunded</span><span>−{money(refundedCents)}</span></li>}
        <li><span>Refundable now</span><span>{money(Math.max(0, remaining))}</span></li>
      </ul>
      {remaining <= 0 ? (
        <p className="panel__hint" style={{ margin: 0 }}>Fully refunded.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>Refund €</span>
          <input type="number" min={1} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0"
            style={{ width: 110, padding: "0.5rem 0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }} />
          <button className="chip" onClick={() => setAmount(String((remaining / 100).toFixed(2)))}>Full</button>
          {confirm ? (
            <>
              <button className="btn btn--dark" disabled={busy} onClick={refund}>{busy ? "Refunding…" : "Confirm refund"}</button>
              <button className="chip" onClick={() => setConfirm(false)}>Cancel</button>
            </>
          ) : (
            <button className="btn btn--ghost" onClick={() => { setError(null); const c = Math.round(Number(amount) * 100); if (!c || c <= 0) { setError("Enter an amount to refund."); return; } setConfirm(true); }}>Refund to guest</button>
          )}
        </div>
      )}
      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem", marginTop: "0.6rem", marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
