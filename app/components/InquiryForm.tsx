"use client";
import { useState } from "react";

// Public "have a question" form. Creates a CRM lead and alerts the team. For
// people not ready to book but worth capturing.
export default function InquiryForm({ propertySlug, propertyName }: { propertySlug?: string; propertyName?: string }) {
  const [f, setF] = useState({ name: "", email: "", phone: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p }));

  async function send() {
    if (!f.name.trim() || (!f.email.trim() && !f.phone.trim())) { setErr("Add your name and an email or phone."); return; }
    setBusy(true); setErr(null);
    const res = await fetch("/api/leads", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, propertySlug }),
    });
    setBusy(false);
    if (res.ok) setDone(true);
    else { const d = await res.json().catch(() => ({})); setErr(d.error || "Could not send, please try again."); }
  }

  if (done) return <p className="lead" style={{ margin: 0 }}>Thank you. We have your note{propertyName ? ` about ${propertyName}` : ""} and will be in touch personally, shortly.</p>;

  return (
    <div style={{ maxWidth: 560, margin: "0 auto", textAlign: "left" }}>
      <div className="ef">
        <div><label>Name</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} /></div>
        <div><label>Email</label><input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} /></div>
        <div><label>Phone</label><input value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
        <div className="full"><label>Your question</label><textarea value={f.message} onChange={(e) => set({ message: e.target.value })} rows={3} placeholder="Dates you have in mind, the occasion, anything you'd like to know." /></div>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.8rem" }}>
        <button className="btn btn--brass" disabled={busy} onClick={send}>{busy ? "Sending…" : "Send inquiry"}</button>
        {err && <span style={{ color: "#a3412e", fontSize: "0.85rem" }}>{err}</span>}
      </div>
    </div>
  );
}
