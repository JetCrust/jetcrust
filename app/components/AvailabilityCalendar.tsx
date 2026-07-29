"use client";
import { useMemo, useState } from "react";

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// Visual availability picker: booked nights greyed and unselectable, click a
// check-in then a check-out (range can't cross a booked night). Calls onSelect
// with (checkIn, checkOut) as YYYY-MM-DD, or ("","") when cleared.
export default function AvailabilityCalendar({ blocked, months = 2, minNights = 1, value, onSelect }: {
  blocked: string[];
  months?: number;
  minNights?: number;
  value?: { checkIn: string; checkOut: string };
  onSelect: (checkIn: string, checkOut: string) => void;
}) {
  const blockedSet = useMemo(() => new Set(blocked), [blocked]);
  const now = new Date();
  const todayIso = iso(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())));
  const [anchor, setAnchor] = useState(() => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)));
  const [start, setStart] = useState<string>(value?.checkIn || "");
  const [end, setEnd] = useState<string>(value?.checkOut || "");

  const rangeHasBlockedNight = (a: string, b: string) => {
    let d = new Date(a + "T00:00:00Z");
    const e = new Date(b + "T00:00:00Z");
    while (d < e) { if (blockedSet.has(iso(d))) return true; d = new Date(d.getTime() + DAY); }
    return false;
  };

  function click(dayIso: string) {
    if (dayIso < todayIso || blockedSet.has(dayIso)) return; // can't start on a past/booked night
    if (!start || (start && end)) { setStart(dayIso); setEnd(""); onSelect("", ""); return; }
    if (dayIso <= start) { setStart(dayIso); setEnd(""); onSelect("", ""); return; }
    if (rangeHasBlockedNight(start, dayIso)) { setStart(dayIso); setEnd(""); onSelect("", ""); return; }
    setEnd(dayIso); onSelect(start, dayIso);
  }

  const nights = start && end ? Math.round((new Date(end + "T00:00:00Z").getTime() - new Date(start + "T00:00:00Z").getTime()) / DAY) : 0;

  function Month({ offset }: { offset: number }) {
    const m = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + offset, 1));
    const y = m.getUTCFullYear(), mo = m.getUTCMonth();
    const lead = (new Date(Date.UTC(y, mo, 1)).getUTCDay() + 6) % 7; // Monday-first
    const total = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
    const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => iso(new Date(Date.UTC(y, mo, i + 1))))];
    return (
      <div style={{ flex: "1 1 260px" }}>
        <div style={{ textAlign: "center", fontFamily: "var(--serif)", fontSize: "1.05rem", marginBottom: "0.6rem" }}>{MONTHS[mo]} {y}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, fontSize: "0.66rem", color: "var(--stone,#8a8375)", textAlign: "center", marginBottom: 4 }}>
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, textAlign: "center", fontSize: "0.82rem" }}>
          {cells.map((c, i) => {
            if (!c) return <div key={i} />;
            const day = Number(c.slice(8));
            const past = c < todayIso, isBlocked = blockedSet.has(c);
            const isStart = c === start, isEnd = c === end;
            const between = start && end && c > start && c < end;
            const disabled = past || isBlocked;
            let bg = "#fff", color = "inherit", border = "1px solid var(--line,#ece7dc)", deco = "none", cursor = "pointer";
            if (isBlocked) { bg = "var(--line,#e7e2d8)"; color = "#a49c8b"; deco = "line-through"; border = "none"; cursor = "not-allowed"; }
            else if (past) { color = "#c9c3b6"; border = "none"; cursor = "default"; }
            else if (isStart || isEnd) { bg = "var(--brass,#9a7b3f)"; color = "#fff"; border = "none"; }
            else if (between) { bg = "rgba(154,123,63,0.16)"; border = "none"; }
            return (
              <button key={i} type="button" onClick={() => !disabled && click(c)} disabled={disabled} aria-label={c}
                style={{ padding: "0.45rem 0", borderRadius: 7, background: bg, color, border, textDecoration: deco, cursor, font: "inherit" }}>
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const canBack = anchor > new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.6rem" }}>
        <button type="button" className="btn btn--ghost" style={{ padding: "0.3rem 0.7rem" }} disabled={!canBack} onClick={() => setAnchor(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - 1, 1)))}>‹</button>
        <div style={{ display: "flex", gap: "1rem", fontSize: "0.72rem", color: "var(--stone,#8a8375)" }}>
          <span><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: "#fff", border: "1px solid #cfc8b8", verticalAlign: -1 }} /> Open</span>
          <span><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: "var(--line,#e7e2d8)", verticalAlign: -1 }} /> Booked</span>
          <span><span style={{ display: "inline-block", width: 11, height: 11, borderRadius: 3, background: "var(--brass,#9a7b3f)", verticalAlign: -1 }} /> Your dates</span>
        </div>
        <button type="button" className="btn btn--ghost" style={{ padding: "0.3rem 0.7rem" }} onClick={() => setAnchor(new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1)))}>›</button>
      </div>
      <div style={{ display: "flex", gap: "1.6rem", flexWrap: "wrap" }}>
        {Array.from({ length: months }, (_, i) => <Month key={i} offset={i} />)}
      </div>
      <p className="panel__hint" style={{ margin: "0.7rem 0 0", textAlign: "center" }}>
        {!start ? "Pick your arrival date." : !end ? "Now pick your departure date." : `${nights} night${nights === 1 ? "" : "s"} selected${nights < minNights ? ` · minimum ${minNights}` : ""}.`}
      </p>
    </div>
  );
}
