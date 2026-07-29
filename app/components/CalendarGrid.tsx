"use client";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type CalItem = {
  kind: "booking" | "block";
  id: string;
  propertySlug: string;
  start: string;   // YYYY-MM-DD (check-in)
  end: string;     // YYYY-MM-DD (check-out, exclusive)
  status: "confirmed" | "pending" | "blocked";
  label: string;
  guests?: number;
  amountCents?: number;
  source?: string; // blocks: MANUAL | ICAL
  meta?: { channel?: string; link?: string; code?: string; phoneLast4?: string; summary?: string } | null;
};
type Prop = { slug: string; name: string };

const DAY = 86400000;
const utc = (s: string) => new Date(`${s}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (s: string, n: number) => iso(new Date(utc(s).getTime() + n * DAY));
const diffDays = (a: string, bMs: number) => Math.round((utc(a).getTime() - bMs) / DAY);
const money = (c: number) => `€${(c / 100).toLocaleString("en-US")}`;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WD = ["S", "M", "T", "W", "T", "F", "S"];

type Drag = { id: string; mode: "move" | "resize"; startX: number; startIdx: number; endIdx: number; delta: number } | null;

export default function CalendarGrid({ monthKey, properties, items, prices, currencySymbol = "€" }: { monthKey: string; properties: Prop[]; items: CalItem[]; prices?: Record<string, number[]>; currencySymbol?: string }) {
  const router = useRouter();
  const [y, mo] = monthKey.split("-").map(Number);
  const monthStartMs = Date.UTC(y, mo - 1, 1);
  const N = new Date(Date.UTC(y, mo, 0)).getUTCDate(); // days in month
  const firstWeekday = new Date(monthStartMs).getUTCDay();
  const todayIso = new Date().toISOString().slice(0, 10);

  const [propFilter, setPropFilter] = useState<string>("all");
  const [show, setShow] = useState({ confirmed: true, pending: true, blocked: true });
  const [selected, setSelected] = useState<CalItem | null>(null);
  const [modal, setModal] = useState<null | "block" | "manual">(null);
  const [drag, setDrag] = useState<Drag>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const rows = propFilter === "all" ? properties : properties.filter((p) => p.slug === propFilter);
  const singleProp = propFilter !== "all" ? properties.find((p) => p.slug === propFilter) || null : null;

  const visible = useMemo(
    () => items.filter((it) => show[it.status] && (propFilter === "all" || it.propertySlug === propFilter)),
    [items, show, propFilter]
  );

  const gotoMonth = (delta: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    router.push(`/admin/calendar?m=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };
  const gotoToday = () => {
    const d = new Date();
    router.push(`/admin/calendar?m=${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  // Lane-pack a property's items so overlaps stack instead of colliding.
  function layout(slug: string) {
    const its = visible.filter((it) => it.propertySlug === slug).map((it) => {
      const s = Math.max(0, diffDays(it.start, monthStartMs));
      const e = Math.min(N, diffDays(it.end, monthStartMs));
      return { it, s, span: Math.max(1, e - s) };
    }).sort((a, b) => a.s - b.s);
    const laneEnds: number[] = [];
    return its.map((x) => {
      let lane = laneEnds.findIndex((end) => end <= x.s);
      if (lane === -1) { lane = laneEnds.length; laneEnds.push(0); }
      laneEnds[lane] = x.s + x.span;
      return { ...x, lane };
    });
  }
  const laneCount = (slug: string) => Math.max(1, layout(slug).reduce((m, x) => Math.max(m, x.lane + 1), 1));

  const dayWidth = () => (bodyRef.current ? bodyRef.current.clientWidth / N : 0);

  function onBarDown(e: React.PointerEvent, it: CalItem, mode: "move" | "resize") {
    if (it.kind !== "booking") return; // drag applies to bookings
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setDrag({ id: it.id, mode, startX: e.clientX, startIdx: diffDays(it.start, monthStartMs), endIdx: diffDays(it.end, monthStartMs), delta: 0 });
  }
  function onMove(e: React.PointerEvent) {
    if (!drag) return;
    const w = dayWidth() || 1;
    setDrag({ ...drag, delta: Math.round((e.clientX - drag.startX) / w) });
  }
  async function onUp() {
    if (!drag) return;
    const d = drag; setDrag(null);
    if (d.delta === 0) return;
    const it = items.find((x) => x.id === d.id);
    if (!it) return;
    let newStart = it.start, newEnd = it.end;
    if (d.mode === "move") { newStart = addDays(it.start, d.delta); newEnd = addDays(it.end, d.delta); }
    else { newEnd = addDays(it.end, d.delta); if (utc(newEnd) <= utc(newStart)) newEnd = addDays(newStart, 1); }
    await patchDates(it, newStart, newEnd);
  }

  async function patchDates(it: CalItem, checkIn: string, checkOut: string, force = false) {
    const res = await fetch(`/api/admin/bookings/${it.id}/dates`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checkIn, checkOut, force }),
    });
    if (res.status === 409) {
      if (confirm("These dates overlap another stay or block. Move anyway?")) return patchDates(it, checkIn, checkOut, true);
      return;
    }
    if (!res.ok) { const e = await res.json().catch(() => ({})); alert(e.error || "Could not update the dates."); return; }
    setSelected(null);
    router.refresh();
  }

  async function removeBlock(id: string) {
    if (!confirm("Remove this block?")) return;
    await fetch(`/api/admin/blocks?id=${id}`, { method: "DELETE" });
    setSelected(null);
    router.refresh();
  }

  const barColor: Record<string, string> = { confirmed: "cal-bar--confirmed", pending: "cal-bar--pending", blocked: "cal-bar--blocked" };
  const rowH = 30, gap = 4, headH = 46;

  return (
    <div onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}>
      {/* Toolbar */}
      <div className="cal-toolbar">
        <div className="cal-nav">
          <button className="chip" onClick={() => gotoMonth(-1)} aria-label="Previous month">‹</button>
          <h2 className="cal-title">{MONTHS[mo - 1]} {y}</h2>
          <button className="chip" onClick={() => gotoMonth(1)} aria-label="Next month">›</button>
          <button className="chip" onClick={gotoToday}>Today</button>
        </div>
        <div className="cal-controls">
          <select value={propFilter} onChange={(e) => setPropFilter(e.target.value)} className="cal-select">
            <option value="all">All properties</option>
            {properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
          </select>
          <div className="cal-legend">
            {(["confirmed", "pending", "blocked"] as const).map((k) => (
              <button key={k} className={`cal-tog cal-tog--${k}${show[k] ? " is-on" : ""}`} onClick={() => setShow({ ...show, [k]: !show[k] })}>
                <span className="cal-dot" /> {k[0].toUpperCase() + k.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn btn--ghost cal-act" onClick={() => setModal("block")}>Block dates</button>
          <button className="btn btn--dark cal-act" onClick={() => setModal("manual")}>+ Manual booking</button>
          <Link href="/admin/calendar/sync" className="chip">Feeds &amp; sync</Link>
        </div>
      </div>

      {/* Calendar: per-property month grid when one property is picked, else the all-properties timeline */}
      {singleProp ? (
        <MonthCalendar
          yr={y} mon={mo} N={N} firstWeekday={firstWeekday}
          item={singleProp}
          items={visible.filter((it) => it.propertySlug === singleProp.slug)}
          prices={prices?.[singleProp.slug]}
          currencySymbol={currencySymbol}
          todayIso={todayIso}
          onSelect={setSelected}
        />
      ) : (
      <div className="cal-wrap">
        <div className="cal-grid" style={{ gridTemplateColumns: "150px 1fr", minWidth: 760 }}>
          {/* header */}
          <div className="cal-corner" />
          <div className="cal-head" style={{ height: headH }}>
            {Array.from({ length: N }, (_, i) => {
              const dateIso = `${monthKey}-${String(i + 1).padStart(2, "0")}`;
              const wd = (firstWeekday + i) % 7;
              const weekend = wd === 0 || wd === 6;
              return (
                <div key={i} className={`cal-hcell${weekend ? " is-weekend" : ""}${dateIso === todayIso ? " is-today" : ""}`}>
                  <span className="cal-wd">{WD[wd]}</span>
                  <span className="cal-dn">{i + 1}</span>
                </div>
              );
            })}
          </div>

          {/* rows */}
          {rows.map((p) => {
            const laid = layout(p.slug);
            const lanes = laneCount(p.slug);
            const h = lanes * rowH + (lanes - 1) * gap + 12;
            return (
              <div key={p.slug} className="cal-rowgroup" style={{ display: "contents" }}>
                <div className="cal-rowname" style={{ minHeight: h }}>{p.name}</div>
                <div className="cal-row" ref={p.slug === rows[0].slug ? bodyRef : undefined} style={{ minHeight: h }}>
                  {/* day gridlines */}
                  {Array.from({ length: N }, (_, i) => {
                    const wd = (firstWeekday + i) % 7;
                    const dateIso = `${monthKey}-${String(i + 1).padStart(2, "0")}`;
                    const rate = prices?.[p.slug]?.[i];
                    return (
                      <div key={i} className={`cal-cell${wd === 0 || wd === 6 ? " is-weekend" : ""}${dateIso === todayIso ? " is-today" : ""}`} style={{ left: `${(i / N) * 100}%`, width: `${(1 / N) * 100}%` }}>
                        {rate ? <span className="cal-price">{rate}</span> : null}
                      </div>
                    );
                  })}
                  {/* bars */}
                  {laid.map(({ it, s, span, lane }) => {
                    const isDragged = drag?.id === it.id;
                    const w = dayWidth();
                    const tx = isDragged && drag?.mode === "move" ? drag.delta * w : 0;
                    const extraW = isDragged && drag?.mode === "resize" ? drag.delta * w : 0;
                    return (
                      <div
                        key={it.id}
                        className={`cal-bar ${barColor[it.status]}${isDragged ? " is-dragging" : ""}`}
                        style={{
                          left: `${(s / N) * 100}%`,
                          width: `calc(${(span / N) * 100}% + ${extraW}px)`,
                          top: lane * (rowH + gap) + 6,
                          height: rowH,
                          transform: `translateX(${tx}px)`,
                        }}
                        onPointerDown={(e) => onBarDown(e, it, "move")}
                        onClick={(e) => { if (!drag) { e.stopPropagation(); setSelected(it); } }}
                        title={`${it.label} · ${it.start} → ${it.end}`}
                      >
                        <span className="cal-bar__label">{it.label}</span>
                        {it.status !== "blocked" && it.amountCents != null && <span className="cal-bar__meta">{money(it.amountCents)}</span>}
                        {it.kind === "booking" && (
                          <span className="cal-bar__handle" onPointerDown={(e) => onBarDown(e, it, "resize")} title="Drag to extend" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {rows.length === 0 && <p style={{ color: "var(--stone)", padding: "1rem" }}>No properties to show.</p>}
      </div>
      )}

      <p className="cal-hint">{singleProp
        ? "Per-property month view — the nightly rate shows in each open night; bookings appear as coloured pills you can click. Choose “All properties” above for the side-by-side timeline."
        : "All-properties timeline — the whole month at a glance with nightly rates. Pick one property above for the larger month grid. Drag a booking to move it, or its right edge to extend."}</p>

      {selected && <DetailPopover item={selected} properties={properties} onClose={() => setSelected(null)} onMove={patchDates} onRemoveBlock={removeBlock} />}
      {modal === "block" && <BlockModal properties={properties} defaultSlug={propFilter !== "all" ? propFilter : properties[0]?.slug} monthKey={monthKey} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
      {modal === "manual" && <ManualModal properties={properties} defaultSlug={propFilter !== "all" ? propFilter : properties[0]?.slug} monthKey={monthKey} onClose={() => setModal(null)} onDone={() => { setModal(null); router.refresh(); }} />}
    </div>
  );
}

/* ---- Per-property month grid (Airbnb-style: day number + nightly rate, bookings as pills) ---- */
const WD_FULL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
function MonthCalendar({ yr, mon, N, firstWeekday, items, prices, currencySymbol, todayIso, onSelect }: {
  yr: number; mon: number; N: number; firstWeekday: number;
  item: Prop; items: CalItem[]; prices?: number[]; currencySymbol: string;
  todayIso: string; onSelect: (it: CalItem) => void;
}) {
  const monthStartMs = Date.UTC(yr, mon - 1, 1);
  const p2 = (n: number) => String(n).padStart(2, "0");

  // Which item (if any) covers each day of the month.
  const cover: (CalItem | null)[] = Array.from({ length: N }, () => null);
  for (const it of items) {
    const s = diffDays(it.start, monthStartMs);
    const e = diffDays(it.end, monthStartMs);
    for (let i = Math.max(0, s); i < Math.min(N, e); i++) if (!cover[i]) cover[i] = it;
  }

  const trailing = (7 - ((firstWeekday + N) % 7)) % 7;

  return (
    <div className="mc">
      <div className="mc-wd">{WD_FULL.map((d) => <span key={d}>{d}</span>)}</div>
      <div className="mc-grid">
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`b${i}`} className="mc-cell mc-cell--blank" />)}
        {Array.from({ length: N }, (_, i) => {
          const dayNum = i + 1;
          const col = (firstWeekday + i) % 7;
          const weekend = col === 0 || col === 6;
          const isToday = `${yr}-${p2(mon)}-${p2(dayNum)}` === todayIso;
          const c = cover[i];
          const isStart = !!c && (i === 0 || cover[i - 1] !== c);
          const isEnd = !!c && (i === N - 1 || cover[i + 1] !== c);
          const showLabel = !!c && (isStart || col === 0);
          const rate = prices?.[i];
          return (
            <div key={dayNum} className={`mc-cell${weekend ? " is-weekend" : ""}`}>
              <span className={`mc-dn${isToday ? " is-today" : ""}`}>{dayNum}</span>
              {c ? (
                <div
                  className={`mc-pill mc-pill--${c.status}${isStart ? " is-start" : ""}${isEnd ? " is-end" : ""}`}
                  onClick={() => onSelect(c)}
                  title={`${c.label} · ${c.start} → ${c.end}`}
                >
                  {showLabel && <span className="mc-pill__label">{c.label}</span>}
                </div>
              ) : (
                rate ? <span className="mc-price">{currencySymbol}{rate.toLocaleString("en-US")}</span> : null
              )}
            </div>
          );
        })}
        {Array.from({ length: trailing }, (_, i) => <div key={`t${i}`} className="mc-cell mc-cell--blank" />)}
      </div>
    </div>
  );
}

/* ---- Detail popover ---- */
function DetailPopover({ item, properties, onClose, onMove, onRemoveBlock }: {
  item: CalItem; properties: Prop[];
  onClose: () => void;
  onMove: (it: CalItem, ci: string, co: string) => void;
  onRemoveBlock: (id: string) => void;
}) {
  const nights = Math.round((utc(item.end).getTime() - utc(item.start).getTime()) / DAY);
  const pname = properties.find((p) => p.slug === item.propertySlug)?.name || item.propertySlug;
  const shift = (dStart: number, dEnd: number) => onMove(item, addDays(item.start, dStart), addDays(item.end, dEnd));
  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cal-card__head">
          <span className={`pill pill--${item.status === "confirmed" ? "confirmed" : item.status === "pending" ? "awaiting-approval" : "cancelled"}`}>
            {item.status[0].toUpperCase() + item.status.slice(1)}
          </span>
          <button className="cal-x" onClick={onClose}>×</button>
        </div>
        <h3 style={{ margin: "0.2rem 0 0.1rem" }}>{item.label}</h3>
        <p style={{ margin: 0, color: "var(--stone)" }}>{pname}</p>
        <ul className="kv" style={{ margin: "1rem 0" }}>
          <li><span>Check in</span><span>{item.start}</span></li>
          <li><span>Check out</span><span>{item.end}</span></li>
          <li><span>Nights</span><span>{nights}</span></li>
          {item.guests != null && <li><span>Guests</span><span>{item.guests}</span></li>}
          {item.amountCents != null && <li><span>Value</span><span>{money(item.amountCents)}</span></li>}
        </ul>
        {item.kind === "booking" ? (
          <>
            <div className="cal-move">
              <span className="panel__hint" style={{ margin: 0 }}>Move</span>
              <button className="chip" onClick={() => shift(-1, -1)}>◀ 1 day</button>
              <button className="chip" onClick={() => shift(1, 1)}>1 day ▶</button>
              <span className="panel__hint" style={{ margin: "0 0 0 0.6rem" }}>Length</span>
              <button className="chip" onClick={() => shift(0, -1)}>− night</button>
              <button className="chip" onClick={() => shift(0, 1)}>+ night</button>
            </div>
            <Link href={`/admin/bookings/${item.id}`} className="btn btn--dark" style={{ marginTop: "1rem", width: "100%", justifyContent: "center" }}>Open full booking</Link>
          </>
        ) : (
          item.source === "MANUAL" ? (
            <button className="btn btn--ghost" style={{ width: "100%", justifyContent: "center" }} onClick={() => onRemoveBlock(item.id)}>Remove block</button>
          ) : (
            <>
              {(item.meta?.summary || item.meta?.code || item.meta?.phoneLast4) && (
                <ul className="kv" style={{ margin: "0 0 1rem" }}>
                  {item.meta?.channel && <li><span>Booked via</span><span>{item.meta.channel}</span></li>}
                  {item.meta?.summary && <li><span>Guest</span><span>{item.meta.summary}</span></li>}
                  {item.meta?.code && <li><span>Confirmation</span><span>{item.meta.code}</span></li>}
                  {item.meta?.phoneLast4 && <li><span>Phone (last 4)</span><span>••• {item.meta.phoneLast4}</span></li>}
                </ul>
              )}
              {item.meta?.link ? (
                <a href={item.meta.link} target="_blank" rel="noopener noreferrer" className="btn btn--dark" style={{ width: "100%", justifyContent: "center" }}>
                  Open reservation on {item.meta.channel || "the platform"}
                </a>
              ) : null}
              <a href="/admin/ota" className="btn btn--ghost" style={{ width: "100%", justifyContent: "center", marginTop: "0.6rem" }}>
                Log payout for accounting →
              </a>
              <p className="panel__hint" style={{ margin: "0.8rem 0 0" }}>
                {item.meta?.channel ? `Imported from ${item.meta.channel}. ` : "Imported from a connected calendar. "}
                The platform keeps the guest&rsquo;s full name, email and phone — open the reservation to see them. This block clears on the next sync.
              </p>
            </>
          )
        )}
      </div>
    </div>
  );
}

/* ---- Block modal ---- */
function BlockModal({ properties, defaultSlug, monthKey, onClose, onDone }: {
  properties: Prop[]; defaultSlug?: string; monthKey: string; onClose: () => void; onDone: () => void;
}) {
  const [slug, setSlug] = useState(defaultSlug || properties[0]?.slug || "");
  const [start, setStart] = useState(`${monthKey}-01`);
  const [end, setEnd] = useState(`${monthKey}-02`);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function save() {
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ propertySlug: slug, start, end, note }) });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setErr(e.error || "Could not block."); return; }
    onDone();
  }
  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cal-card__head"><h3 style={{ margin: 0 }}>Block dates</h3><button className="cal-x" onClick={onClose}>×</button></div>
        <p className="panel__hint">Owner stay, maintenance or a manual hold. It appears grey on the calendar.</p>
        <div className="cal-form">
          <label>Property<select value={slug} onChange={(e) => setSlug(e.target.value)}>{properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
          <label>From<input type="date" value={start} onChange={(e) => setStart(e.target.value)} /></label>
          <label>To (checkout)<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
          <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Owner stay" /></label>
        </div>
        {err && <p style={{ color: "#a3412e", fontSize: "0.85rem" }}>{err}</p>}
        <button className="btn btn--dark" style={{ width: "100%", justifyContent: "center", marginTop: "0.6rem" }} disabled={busy} onClick={save}>{busy ? "Saving…" : "Block these dates"}</button>
      </div>
    </div>
  );
}

/* ---- Manual booking modal ---- */
function ManualModal({ properties, defaultSlug, monthKey, onClose, onDone }: {
  properties: Prop[]; defaultSlug?: string; monthKey: string; onClose: () => void; onDone: () => void;
}) {
  const [slug, setSlug] = useState(defaultSlug || properties[0]?.slug || "");
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [checkIn, setCheckIn] = useState(`${monthKey}-01`);
  const [checkOut, setCheckOut] = useState(`${monthKey}-03`);
  const [guests, setGuests] = useState("2");
  const [amountEur, setAmountEur] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(force = false) {
    if (!guestName.trim()) { setErr("Add a guest name."); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/admin/bookings/manual", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ propertySlug: slug, guestName, guestEmail, checkIn, checkOut, guests: Number(guests) || 2, amountEur: Number(amountEur) || 0, note, force }),
    });
    setBusy(false);
    if (res.status === 409) { if (confirm("These dates overlap an existing stay or block. Create it anyway?")) return save(true); return; }
    if (!res.ok) { const e = await res.json().catch(() => ({})); setErr(e.error || "Could not create the booking."); return; }
    onDone();
  }
  return (
    <div className="cal-modal" onClick={onClose}>
      <div className="cal-card" onClick={(e) => e.stopPropagation()}>
        <div className="cal-card__head"><h3 style={{ margin: 0 }}>Manual booking</h3><button className="cal-x" onClick={onClose}>×</button></div>
        <p className="panel__hint">Phone, email or repeat guest. It confirms immediately and blocks the calendar. No card is charged here.</p>
        <div className="cal-form">
          <label>Property<select value={slug} onChange={(e) => setSlug(e.target.value)}>{properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}</select></label>
          <label>Guest name<input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Olivia Smith" /></label>
          <label>Guest email (optional)<input type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="olivia@…" /></label>
          <label>Check in<input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} /></label>
          <label>Check out<input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} /></label>
          <label>Guests<input type="number" min={1} value={guests} onChange={(e) => setGuests(e.target.value)} /></label>
          <label>Value €<input type="number" min={0} step="0.01" value={amountEur} onChange={(e) => setAmountEur(e.target.value)} placeholder="0" /></label>
          <label>Note<input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" /></label>
        </div>
        {err && <p style={{ color: "#a3412e", fontSize: "0.85rem" }}>{err}</p>}
        <button className="btn btn--dark" style={{ width: "100%", justifyContent: "center", marginTop: "0.6rem" }} disabled={busy} onClick={() => save()}>{busy ? "Creating…" : "Create booking"}</button>
      </div>
    </div>
  );
}
