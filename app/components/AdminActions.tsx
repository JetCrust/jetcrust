"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `€${Math.round(c / 100).toLocaleString("en-US")}`;

export default function AdminActions({
  bookingId,
  totalCents,
  defaultPct,
  balanceDays,
}: {
  bookingId: string;
  totalCents: number;
  defaultPct: number;
  balanceDays: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pct, setPct] = useState<number>(defaultPct);

  const chargeNow = Math.round((totalCents * pct) / 100);
  const balance = totalCents - chargeNow;

  async function act(action: "approve" | "decline") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(action === "approve" ? { action, chargeNowPct: pct } : { action }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Action failed.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <p className="panel__hint" style={{ marginTop: 0, marginBottom: "0.5rem" }}>How much to charge now:</p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.8rem" }}>
        {[20, 50, 100].map((p) => (
          <button
            key={p}
            type="button"
            className={`btn ${pct === p ? "btn--brass" : "btn--ghost"}`}
            style={{ padding: "0.45rem 1rem" }}
            onClick={() => setPct(p)}
          >
            {p}%
          </button>
        ))}
        <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.85rem", color: "var(--ink-soft)" }}>
          or
          <input
            type="number"
            min={1}
            max={100}
            value={pct}
            onChange={(e) => setPct(Math.min(100, Math.max(1, Number(e.target.value) || 0)))}
            style={{ width: 70, padding: "0.4rem 0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}
          />
          %
        </label>
      </div>

      <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: "0 0 0.9rem" }}>
        Charge now: <strong>{money(chargeNow)}</strong>
        {balance > 0 ? <> · balance <strong>{money(balance)}</strong> auto-charged ~{balanceDays} days before arrival</> : <> · nothing left to charge later</>}
      </p>

      <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
        <button className="btn btn--brass" style={{ padding: "0.6rem 1.2rem" }} disabled={!!busy} onClick={() => act("approve")}>
          {busy === "approve" ? "Charging…" : `Approve & charge ${money(chargeNow)}`}
        </button>
        <button className="btn btn--ghost" style={{ padding: "0.6rem 1.2rem" }} disabled={!!busy} onClick={() => act("decline")}>
          {busy === "decline" ? "Releasing…" : "Decline"}
        </button>
        {error && <span style={{ color: "#a3412e", fontSize: "0.85rem" }}>{error}</span>}
      </div>
    </div>
  );
}
