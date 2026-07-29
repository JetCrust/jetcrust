"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export type Lead = {
  id: string; name: string; email?: string | null; phone?: string | null;
  propertySlug?: string | null; source: string; status: string;
  message?: string | null; notes?: string | null; guests?: number | null;
  checkIn?: string | null; checkOut?: string | null; userId?: string | null; createdAt: string;
};
type Prop = { slug: string; name: string };

const STATUSES = ["NEW", "CONTACTED", "QUOTED", "WON", "LOST"] as const;
const LABEL: Record<string, string> = { NEW: "New", CONTACTED: "Contacted", QUOTED: "Quoted", WON: "Won", LOST: "Lost" };
const COLOR: Record<string, string> = { NEW: "#a3412e", CONTACTED: "#9a7b3f", QUOTED: "#3a6ea5", WON: "#253026", LOST: "#8a8375" };
const fmt = (s?: string | null) => (s ? new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");

function LeadCard({ lead, properties }: { lead: Lead; properties: Prop[] }) {
  const router = useRouter();
  const [status, setStatus] = useState(lead.status);
  const [notes, setNotes] = useState(lead.notes || "");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameOf = (s?: string | null) => properties.find((p) => p.slug === s)?.name || s || "Any / unsure";

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    await fetch("/api/admin/leads", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: lead.id, ...body }) });
    setBusy(false); router.refresh();
  }

  return (
    <div className="panel" style={{ borderLeft: `3px solid ${COLOR[status]}`, marginBottom: "0.8rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: "0.6rem", flexWrap: "wrap", alignItems: "baseline" }}>
        <strong>{lead.name}{lead.userId && <Link href={`/admin/guests/${lead.userId}`} className="tag" style={{ marginLeft: "0.5rem", fontSize: "0.68rem" }}>has account →</Link>}</strong>
        <select value={status} onChange={(e) => { setStatus(e.target.value); patch({ status: e.target.value }); }} disabled={busy} style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}>
          {STATUSES.map((s) => <option key={s} value={s}>{LABEL[s]}</option>)}
        </select>
      </div>
      <p className="panel__hint" style={{ margin: "0.3rem 0 0.4rem" }}>
        {nameOf(lead.propertySlug)} · <span className="tag" style={{ fontSize: "0.66rem" }}>{lead.source}</span>
        {lead.checkIn && <> · {fmt(lead.checkIn)}{lead.checkOut ? `–${fmt(lead.checkOut)}` : ""}</>}
        {lead.guests ? ` · ${lead.guests} guests` : ""} · in {fmt(lead.createdAt)}
      </p>
      <p style={{ margin: "0 0 0.4rem", fontSize: "0.85rem" }}>
        {lead.email && <a className="textlink" href={`mailto:${lead.email}`}>{lead.email}</a>}
        {lead.email && lead.phone ? " · " : ""}
        {lead.phone && <a className="textlink" href={`tel:${lead.phone}`}>{lead.phone}</a>}
      </p>
      {lead.message && <p style={{ margin: "0 0 0.4rem", color: "var(--ink-soft)", fontSize: "0.88rem" }}>&ldquo;{lead.message}&rdquo;</p>}
      {open ? (
        <div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Notes — calls, quotes, follow-ups…" style={{ width: "100%", padding: "0.6rem", border: "1px solid var(--line)", borderRadius: 8, fontSize: "0.85rem" }} />
          <div style={{ display: "flex", gap: "0.6rem", marginTop: "0.4rem" }}>
            <button className="btn btn--dark" style={{ padding: "0.4rem 0.9rem" }} disabled={busy} onClick={() => patch({ notes })}>Save notes</button>
            <button className="btn btn--ghost" style={{ padding: "0.4rem 0.9rem" }} onClick={() => setOpen(false)}>Close</button>
          </div>
        </div>
      ) : (
        <button className="textlink" style={{ background: "none", border: 0, cursor: "pointer", padding: 0, fontSize: "0.82rem" }} onClick={() => setOpen(true)}>{notes ? "Notes ▾" : "Add notes"}</button>
      )}
    </div>
  );
}

export default function LeadBoard({ leads, properties }: { leads: Lead[]; properties: Prop[] }) {
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", phone: "", propertySlug: "", source: "PHONE", message: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const set = (patch: Partial<typeof form>) => setForm((s) => ({ ...s, ...patch }));

  async function add() {
    if (!form.name.trim()) { setMsg("Add a name."); return; }
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setBusy(false);
    if (res.ok) { setForm({ name: "", email: "", phone: "", propertySlug: "", source: "PHONE", message: "" }); setMsg("Added."); router.refresh(); }
    else setMsg("Could not add.");
  }

  return (
    <div>
      <div className="panel" style={{ marginBottom: "1.6rem" }}>
        <div className="panel__head"><h3>Log a lead</h3></div>
        <p className="panel__hint" style={{ marginTop: 0 }}>Someone called or emailed? Capture them here so they don&rsquo;t slip.</p>
        <div className="ef">
          <div><label>Name</label><input value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
          <div><label>Email</label><input value={form.email} onChange={(e) => set({ email: e.target.value })} placeholder="links to their account if they sign up" /></div>
          <div><label>Phone</label><input value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
          <div><label>Property</label>
            <select value={form.propertySlug} onChange={(e) => set({ propertySlug: e.target.value })}>
              <option value="">Any / unsure</option>
              {properties.map((p) => <option key={p.slug} value={p.slug}>{p.name}</option>)}
            </select>
          </div>
          <div><label>Source</label>
            <select value={form.source} onChange={(e) => set({ source: e.target.value })}>
              {["PHONE", "EMAIL", "WEB", "REFERRAL", "OTHER"].map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="full"><label>What they want</label><input value={form.message} onChange={(e) => set({ message: e.target.value })} placeholder="dates, occasion, questions…" /></div>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.7rem" }}>
          <button className="btn btn--dark" disabled={busy} onClick={add}>{busy ? "Adding…" : "Add lead"}</button>
          {msg && <span style={{ fontSize: "0.85rem", color: "var(--stone)" }}>{msg}</span>}
        </div>
      </div>

      {STATUSES.map((s) => {
        const group = leads.filter((l) => l.status === s);
        if (group.length === 0 && (s === "WON" || s === "LOST")) return null;
        return (
          <div key={s} style={{ marginBottom: "1.6rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.7rem" }}>
              <h3 style={{ margin: 0, color: COLOR[s] }}>{LABEL[s]}</h3>
              <span className="console__count">{group.length}</span>
            </div>
            {group.length === 0 ? <p className="panel__hint" style={{ margin: 0 }}>None.</p> : group.map((l) => <LeadCard key={l.id} lead={l} properties={properties} />)}
          </div>
        );
      })}
    </div>
  );
}
