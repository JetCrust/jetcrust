"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ReportsFilters({ start, end, exportHref }: { start: string; end: string; exportHref: string }) {
  const router = useRouter();
  const [s, setS] = useState(start);
  const [e, setE] = useState(end);
  const apply = (ns = s, ne = e) => router.push(`/admin/reports?start=${ns}&end=${ne}`);

  const preset = (kind: "mtd" | "ytd" | "last12" | "lastYear") => {
    const now = new Date();
    const y = now.getUTCFullYear();
    let ns: string, ne: string;
    if (kind === "mtd") { ns = new Date(Date.UTC(y, now.getUTCMonth(), 1)).toISOString().slice(0, 10); ne = new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); }
    else if (kind === "ytd") { ns = `${y}-01-01`; ne = new Date(Date.UTC(y, 11, 31)).toISOString().slice(0, 10); }
    else if (kind === "lastYear") { ns = `${y - 1}-01-01`; ne = `${y - 1}-12-31`; }
    else { const d = new Date(Date.UTC(y, now.getUTCMonth() - 11, 1)); ns = d.toISOString().slice(0, 10); ne = new Date(Date.UTC(y, now.getUTCMonth() + 1, 0)).toISOString().slice(0, 10); }
    setS(ns); setE(ne); apply(ns, ne);
  };

  return (
    <div className="panel" style={{ marginBottom: "1.4rem" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.9rem", alignItems: "flex-end" }}>
        <label style={lbl}>From<input type="date" value={s} onChange={(e) => setS(e.target.value)} style={inp} /></label>
        <label style={lbl}>To<input type="date" value={e} onChange={(e) => setE(e.target.value)} style={inp} /></label>
        <button className="btn btn--dark" onClick={() => apply()}>Apply</button>
        <a className="btn btn--ghost" href={exportHref}>Export CSV</a>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginLeft: "auto" }}>
          <button className="chip" onClick={() => preset("mtd")}>This month</button>
          <button className="chip" onClick={() => preset("ytd")}>This year</button>
          <button className="chip" onClick={() => preset("last12")}>Last 12 mo</button>
          <button className="chip" onClick={() => preset("lastYear")}>Last year</button>
        </div>
      </div>
    </div>
  );
}
const lbl: React.CSSProperties = { display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.8rem", color: "var(--ink-soft)" };
const inp: React.CSSProperties = { padding: "0.55rem 0.7rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", background: "#fff", color: "var(--ink)", fontSize: "0.9rem" };
