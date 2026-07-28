"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

type Prop = { slug: string; name: string };
type Expense = {
  id: string; propertySlug: string | null; category: string;
  description: string; amountCents: number; date: string;
};

const CATEGORIES = ["CLEANING", "MAINTENANCE", "SUPPLIES", "COMMISSION", "UTILITIES", "OTHER"];
const catLabel = (c: string) => c.charAt(0) + c.slice(1).toLowerCase();
const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function ExpenseManager({
  properties, start, end, property,
}: {
  properties: Prop[]; start: string; end: string; property: string;
}) {
  const router = useRouter();
  const [items, setItems] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [desc, setDesc] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("CLEANING");
  const [prop, setProp] = useState(property !== "all" ? property : (properties[0]?.slug || ""));
  const [date, setDate] = useState(end);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/expenses?start=${start}&end=${end}&property=${property}`);
    const d = await res.json().catch(() => ({ expenses: [] }));
    setItems(d.expenses || []);
    setLoading(false);
  }, [start, end, property]);

  useEffect(() => { load(); }, [load]);

  async function add() {
    const cents = Math.round(Number(amount) * 100);
    if (!desc.trim() || !cents || cents <= 0) { setError("Add a description and amount."); return; }
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: desc.trim(), amountCents: cents, category, propertySlug: prop || null, date: `${date}T12:00:00` }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Could not add."); return; }
    setDesc(""); setAmount("");
    await load();
    router.refresh(); // refresh the P&L totals
  }

  async function remove(id: string) {
    await fetch(`/api/admin/expenses?id=${id}`, { method: "DELETE" });
    await load();
    router.refresh();
  }

  const total = items.reduce((s, e) => s + e.amountCents, 0);

  return (
    <div className="panel">
      <div className="panel__head"><h3>Costs &amp; commissions</h3></div>
      <p className="panel__hint">Log cleaning, maintenance, supplies and OTA commissions. They feed the P&amp;L above for the selected range.</p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", alignItems: "flex-end", margin: "0.5rem 0 1.2rem" }}>
        <input placeholder="Description" value={desc} onChange={(e) => setDesc(e.target.value)} style={{ ...inp, minWidth: 180, flex: 1 }} />
        <input type="number" min={0} step="0.01" placeholder="€ amount" value={amount} onChange={(e) => setAmount(e.target.value)} style={{ ...inp, width: 120 }} />
        <select value={category} onChange={(e) => setCategory(e.target.value)} style={inp}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{catLabel(c)}</option>)}
        </select>
        <select value={prop} onChange={(e) => setProp(e.target.value)} style={inp}>
          <option value="">Portfolio-wide</option>
          {properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
        </select>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inp} />
        <button className="btn btn--dark" disabled={busy} onClick={add}>{busy ? "Adding…" : "Add cost"}</button>
      </div>
      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem", marginTop: 0 }}>{error}</p>}

      {loading ? (
        <p style={{ color: "var(--stone)" }}>Loading…</p>
      ) : items.length === 0 ? (
        <p style={{ color: "var(--stone)", margin: 0 }}>No costs logged in this range.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="ledger">
            <thead><tr><th>Date</th><th>Category</th><th>Property</th><th>Description</th><th>Amount</th><th></th></tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.date).toLocaleDateString("en-GB")}</td>
                  <td>{catLabel(e.category)}</td>
                  <td>{properties.find((p) => p.slug === e.propertySlug)?.name || (e.propertySlug ? e.propertySlug : "Portfolio")}</td>
                  <td>{e.description}</td>
                  <td>{money(e.amountCents)}</td>
                  <td><button onClick={() => remove(e.id)} style={{ background: "none", border: "none", color: "var(--stone)", cursor: "pointer", fontSize: "0.85rem", textDecoration: "underline" }}>remove</button></td>
                </tr>
              ))}
              <tr style={{ fontWeight: 600 }}><td colSpan={4}>Total</td><td>{money(total)}</td><td></td></tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "0.55rem 0.7rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
  background: "#fff", color: "var(--ink)", fontSize: "0.9rem",
};
