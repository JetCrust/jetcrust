"use client";
import { useState } from "react";

type Prop = { slug: string; name: string; base: number; weekend: number };
type Fee = { key: string; label: string; pct: number; mode: "deduct" | "addon" };

const money = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

// list price needed so the host nets `target`:
//  deduct: the channel takes commission out of what the guest pays (Booking, VRBO,
//          Airbnb host-only fee) → list = target / (1 − fee).
//  addon:  the channel adds a guest fee on top of your price (Airbnb guest-fee
//          model) → you list `target`; the guest simply pays more.
function listFor(target: number, f: Fee): { list: number; guestPays: number } {
  if (f.mode === "addon") return { list: target, guestPays: Math.round(target * (1 + f.pct / 100)) };
  const list = f.pct >= 100 ? target : Math.round(target / (1 - f.pct / 100));
  return { list, guestPays: list };
}

export default function ChannelRates({ properties }: { properties: Prop[] }) {
  const [fees, setFees] = useState<Fee[]>([
    { key: "AIRBNB", label: "Airbnb", pct: 15, mode: "deduct" },
    { key: "BOOKING", label: "Booking.com", pct: 15, mode: "deduct" },
    { key: "VRBO", label: "VRBO", pct: 8, mode: "deduct" },
  ]);
  const [useWeekend, setUseWeekend] = useState(false);
  const [targets, setTargets] = useState<Record<string, number>>(
    Object.fromEntries(properties.map((p) => [p.slug, p.base]))
  );

  const setFee = (i: number, patch: Partial<Fee>) => setFees((s) => s.map((f, j) => (j === i ? { ...f, ...patch } : f)));
  const targetOf = (p: Prop) => targets[p.slug] ?? (useWeekend ? p.weekend : p.base);

  return (
    <div>
      <div className="panel" style={{ marginBottom: "1.4rem" }}>
        <div className="panel__head"><h3>Channel fees</h3></div>
        <p className="panel__hint" style={{ marginTop: 0 }}>
          Set each channel&rsquo;s fee and how it&rsquo;s charged. <strong>Deducted</strong> means the channel takes commission out of your payout (Booking, VRBO, and Airbnb&rsquo;s host-only fee): list higher to net your target. <strong>Added on top</strong> means the channel charges the guest a fee above your price (Airbnb&rsquo;s guest-fee model): list your target as-is.
        </p>
        <div className="ef">
          {fees.map((f, i) => (
            <div key={f.key} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <div style={{ flex: 1 }}><label>{f.label} fee %</label><input type="number" value={f.pct} onChange={(e) => setFee(i, { pct: Number(e.target.value) || 0 })} /></div>
              <div><label>Charged</label>
                <select value={f.mode} onChange={(e) => setFee(i, { mode: e.target.value as Fee["mode"] })}>
                  <option value="deduct">Deducted</option>
                  <option value="addon">Added on top</option>
                </select>
              </div>
            </div>
          ))}
        </div>
        <label className="addon-check" style={{ marginTop: "0.8rem" }}>
          <input type="checkbox" checked={useWeekend} onChange={(e) => setUseWeekend(e.target.checked)} />
          <span>Base the target on the weekend rate instead of the weeknight rate</span>
        </label>
      </div>

      <div className="panel">
        <div className="panel__head"><h3>What to list on each channel</h3></div>
        <p className="panel__hint" style={{ marginTop: 0 }}>Enter the nightly payout you want to keep, per home. We show the price to list so you net it after fees (and what the guest ends up paying).</p>
        <div style={{ overflowX: "auto" }}>
          <table className="ledger">
            <thead>
              <tr>
                <th>Property</th><th>Net you want / night</th>
                {fees.map((f) => <th key={f.key}>{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.slug}>
                  <td>{p.name}</td>
                  <td><input type="number" value={targetOf(p)} onChange={(e) => setTargets((s) => ({ ...s, [p.slug]: Number(e.target.value) || 0 }))} style={{ width: 110 }} /></td>
                  {fees.map((f) => {
                    const r = listFor(targetOf(p), f);
                    return (
                      <td key={f.key}>
                        <strong>{money(r.list)}</strong>
                        {r.guestPays !== r.list && <div style={{ fontSize: "0.75rem", color: "var(--stone)" }}>guest pays {money(r.guestPays)}</div>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel__hint" style={{ marginBottom: 0, marginTop: "0.8rem" }}>
          Tip: Airbnb runs two fee models. If your listing shows a guest service fee added at checkout, set Airbnb to <strong>Added on top</strong>. If Airbnb deducts a single host fee from your payout, use <strong>Deducted</strong>. This is a calculator; enter the figures into each channel yourself.
        </p>
      </div>
    </div>
  );
}
