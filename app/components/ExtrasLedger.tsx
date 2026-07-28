"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Extra = {
  id: string; desc: string; amountCents: number; at: string;
  settled: boolean; settledVia?: string; settledAt?: string;
};

const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const viaLabel: Record<string, string> = { card: "charged to card", cash: "paid in cash", deposit: "from deposit" };

export default function ExtrasLedger({
  bookingId, extras, hasCard,
}: {
  bookingId: string; extras: Extra[]; hasCard: boolean;
}) {
  const router = useRouter();
  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function post(body: object, key: string) {
    setBusy(key); setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}/extras`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Action failed."); return false; }
    router.refresh();
    return true;
  }

  async function add() {
    const cents = Math.round(Number(amount) * 100);
    if (!desc.trim() || !cents || cents <= 0) { setError("Add a description and amount."); return; }
    if (await post({ action: "add", desc: desc.trim(), amountCents: cents }, "add")) { setDesc(""); setAmount(""); }
  }

  const outstanding = extras.filter((e) => !e.settled).reduce((s, e) => s + e.amountCents, 0);

  return (
    <div>
      {extras.length === 0 ? (
        <p style={{ color: "var(--stone)", margin: "0 0 1rem" }}>No extras yet. Add bar bills, late checkout, services or agreed breakages below.</p>
      ) : (
        <ul className="kv" style={{ marginBottom: "1rem" }}>
          {extras.map((e) => (
            <li key={e.id} style={{ alignItems: "flex-start" }}>
              <span>
                {e.desc}
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--stone)" }}>
                  {e.settled ? `Settled · ${viaLabel[e.settledVia || ""] || e.settledVia}` : "Unsettled"}
                </span>
              </span>
              <span style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "0.3rem" }}>
                <strong>{money(e.amountCents)}</strong>
                {!e.settled && (
                  <span style={{ display: "flex", gap: "0.3rem" }}>
                    {hasCard && <button className="chip" disabled={!!busy} onClick={() => post({ action: "settle", extraId: e.id, via: "card" }, e.id + "card")}>Charge card</button>}
                    <button className="chip" disabled={!!busy} onClick={() => post({ action: "settle", extraId: e.id, via: "cash" }, e.id + "cash")}>Cash</button>
                    <button className="chip" disabled={!!busy} onClick={() => post({ action: "settle", extraId: e.id, via: "deposit" }, e.id + "dep")}>From deposit</button>
                    <button className="chip" disabled={!!busy} onClick={() => post({ action: "remove", extraId: e.id }, e.id + "rm")}>Remove</button>
                  </span>
                )}
              </span>
            </li>
          ))}
          {outstanding > 0 && <li style={{ fontWeight: 600 }}><span>Outstanding</span><span>{money(outstanding)}</span></li>}
        </ul>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <input placeholder="e.g. Wine — 2 bottles" value={desc} onChange={(e) => setDesc(e.target.value)}
          style={{ ...inp, flex: 1, minWidth: 160 }} />
        <input type="number" min={0} step="0.01" placeholder="€" value={amount} onChange={(e) => setAmount(e.target.value)}
          style={{ ...inp, width: 100 }} />
        <button className="btn btn--ghost" disabled={busy === "add"} onClick={add}>{busy === "add" ? "Adding…" : "Add extra"}</button>
      </div>
      {!hasCard && <p className="panel__hint" style={{ marginTop: "0.6rem", marginBottom: 0 }}>No saved card on file — settle as cash or from the deposit.</p>}
      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem", marginTop: "0.6rem", marginBottom: 0 }}>{error}</p>}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "0.55rem 0.7rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
  background: "#fff", color: "var(--ink)", fontSize: "0.9rem",
};
