"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

type Prop = { slug: string; name: string };

const PRESETS = [
  { label: "This month", months: 0 },
  { label: "Last month", months: -1 },
  { label: "This year", year: true },
];

export default function FinanceFilters({
  start, end, property, properties, exportHref,
}: {
  start: string; end: string; property: string; properties: Prop[]; exportHref: string;
}) {
  const router = useRouter();
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const [p, setP] = useState(property);

  const apply = (ns = s, ne = e, np = p) => {
    router.push(`/admin/finance?start=${ns}&end=${ne}&property=${np}`);
  };

  const preset = (def: { months?: number; year?: boolean }) => {
    const now = new Date();
    let start: Date, endD: Date;
    if (def.year) {
      start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
      endD = new Date(Date.UTC(now.getUTCFullYear(), 11, 31));
    } else {
      const m = now.getUTCMonth() + (def.months || 0);
      start = new Date(Date.UTC(now.getUTCFullYear(), m, 1));
      endD = new Date(Date.UTC(now.getUTCFullYear(), m + 1, 0));
    }
    const ns = start.toISOString().slice(0, 10);
    const ne = endD.toISOString().slice(0, 10);
    setS(ns); setE(ne); apply(ns, ne, p);
  };

  return (
    <div className="panel" style={{ marginBottom: 0 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", alignItems: "flex-end" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          From
          <input type="date" value={s} onChange={(ev) => setS(ev.target.value)} style={inp} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          To
          <input type="date" value={e} onChange={(ev) => setE(ev.target.value)} style={inp} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem", color: "var(--ink-soft)" }}>
          Property
          <select value={p} onChange={(ev) => { setP(ev.target.value); apply(s, e, ev.target.value); }} style={inp}>
            <option value="all">All properties</option>
            {properties.map((pr) => <option key={pr.slug} value={pr.slug}>{pr.name}</option>)}
          </select>
        </label>
        <button className="btn btn--dark" onClick={() => apply()}>Apply</button>
        <a className="btn btn--ghost" href={exportHref}>Export CSV</a>
      </div>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.9rem" }}>
        {PRESETS.map((pr) => (
          <button key={pr.label} className="chip" onClick={() => preset(pr)}>{pr.label}</button>
        ))}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  padding: "0.55rem 0.7rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)",
  background: "#fff", color: "var(--ink)", fontSize: "0.9rem",
};
