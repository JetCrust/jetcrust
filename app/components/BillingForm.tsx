"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Billing = {
  billingName: string;
  billingLine1: string;
  billingLine2: string;
  billingCity: string;
  billingPostcode: string;
  billingCountry: string;
};

export default function BillingForm({ initial }: { initial: Billing }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof Billing, v: string) => { setF((s) => ({ ...s, [k]: v })); setSaved(false); };

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/account/billing", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(f),
    });
    setBusy(false);
    if (!res.ok) { setError("Could not save. Please try again."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="ef" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="full"><label>Name on the bill</label><input value={f.billingName} onChange={(e) => set("billingName", e.target.value)} placeholder="Cardholder or company name" /></div>
      <div className="full"><label>Address line 1</label><input value={f.billingLine1} onChange={(e) => set("billingLine1", e.target.value)} /></div>
      <div className="full"><label>Address line 2</label><input value={f.billingLine2} onChange={(e) => set("billingLine2", e.target.value)} placeholder="Optional" /></div>
      <div><label>City</label><input value={f.billingCity} onChange={(e) => set("billingCity", e.target.value)} /></div>
      <div><label>Postcode</label><input value={f.billingPostcode} onChange={(e) => set("billingPostcode", e.target.value)} /></div>
      <div className="full"><label>Country</label><input value={f.billingCountry} onChange={(e) => set("billingCountry", e.target.value)} placeholder="e.g. Romania" /></div>
      <div className="full" style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn--brass" disabled={busy}>{busy ? "Saving…" : "Save billing address"}</button>
        {saved && <span style={{ fontSize: "0.85rem", color: "var(--forest)" }}>Saved.</span>}
        {error && <span style={{ fontSize: "0.85rem", color: "#a3412e" }}>{error}</span>}
      </div>
    </form>
  );
}
