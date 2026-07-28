"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;

const STATUS: Record<string, string> = {
  none: "Not held yet",
  held: "Held",
  released: "Released",
  captured: "Charged",
  expired: "Expired",
};

export default function SecurityDeposit({
  bookingId,
  cents,
  status,
  capturedCents,
}: {
  bookingId: string;
  cents: number;
  status: string;
  capturedCents: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [captureEur, setCaptureEur] = useState<string>("");

  async function act(action: "hold" | "release" | "capture") {
    setBusy(action);
    setError(null);
    const body: { action: string; amountCents?: number } = { action };
    if (action === "capture") {
      const amt = Math.round(Number(captureEur) * 100);
      if (!amt || amt <= 0) { setError("Enter an amount to charge."); setBusy(null); return; }
      body.amountCents = amt;
    }
    const res = await fetch(`/api/admin/bookings/${bookingId}/deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Action failed.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  if (cents <= 0) {
    return <p style={{ margin: 0, color: "var(--stone)" }}>No security deposit is set for this home. Add one in Properties &amp; pricing.</p>;
  }

  return (
    <div>
      <ul className="kv" style={{ marginBottom: "1rem" }}>
        <li><span>Amount</span><span>{money(cents)}</span></li>
        <li><span>Status</span><span>{STATUS[status] || status}{status === "captured" && capturedCents > 0 ? ` · ${money(capturedCents)}` : ""}</span></li>
      </ul>

      {status === "none" && (
        <>
          <p className="panel__hint">It holds automatically ~2 days before check-in. You can also place it now.</p>
          <button className="btn btn--ghost" disabled={!!busy} onClick={() => act("hold")}>{busy === "hold" ? "Holding…" : "Place hold now"}</button>
        </>
      )}

      {status === "held" && (
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn btn--ghost" disabled={!!busy} onClick={() => act("release")}>{busy === "release" ? "Releasing…" : "Release (clean checkout)"}</button>
          <span style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>or charge €</span>
            <input type="number" min={1} value={captureEur} onChange={(e) => setCaptureEur(e.target.value)} placeholder="0"
              style={{ width: 90, padding: "0.5rem 0.6rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }} />
            <button className="btn btn--brass" disabled={!!busy} onClick={() => act("capture")}>{busy === "capture" ? "Charging…" : "Charge for damage"}</button>
          </span>
        </div>
      )}

      {(status === "released" || status === "captured" || status === "expired") && (
        <p className="panel__hint" style={{ marginBottom: 0 }}>
          {status === "released" && "Released back to the guest, nothing charged."}
          {status === "captured" && `Charged ${money(capturedCents)} for damage/extras; the rest was released.`}
          {status === "expired" && "The hold expired on Stripe's side. Place a new hold if needed."}
        </p>
      )}

      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem", marginTop: "0.6rem", marginBottom: 0 }}>{error}</p>}
    </div>
  );
}
