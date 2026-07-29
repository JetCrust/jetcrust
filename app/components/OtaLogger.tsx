"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export type OtaReservation = {
  propertySlug: string;
  propertyName: string;
  channel: "AIRBNB" | "BOOKING" | "VRBO" | "OTHER";
  confirmationCode?: string;
  checkIn: string;   // YYYY-MM-DD
  checkOut: string;
  guestName?: string;
  id?: string;       // existing OtaBooking id, if logged
  grossCents?: number;
  feeCents?: number;
  netCents?: number;
  note?: string;
  phoneLast4?: string;
  reservationLink?: string;
};

const CHANNEL_LABEL: Record<string, string> = { AIRBNB: "Airbnb", BOOKING: "Booking.com", VRBO: "VRBO", OTHER: "Other" };
const eur = (c?: number) => (c ? (c / 100).toString() : "");
const cents = (v: string) => Math.round((parseFloat(v) || 0) * 100);
const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 0 })}`;

export default function OtaLogger({ r }: { r: OtaReservation }) {
  const router = useRouter();
  const [gross, setGross] = useState(eur(r.grossCents));
  const [fee, setFee] = useState(eur(r.feeCents));
  const [net, setNet] = useState(eur(r.netCents));
  const [guestName, setGuestName] = useState(r.guestName || "");
  const [note, setNote] = useState(r.note || "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const logged = !!r.id && (r.netCents || 0) > 0;

  // Convenience: if they fill gross + fee but not net, net = gross − fee.
  const derivedNet = net || (gross && fee ? String((cents(gross) - cents(fee)) / 100) : gross);

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/ota-bookings", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: r.id,
        propertySlug: r.propertySlug,
        channel: r.channel,
        confirmationCode: r.confirmationCode,
        guestName: guestName.trim() || undefined,
        checkIn: r.checkIn, checkOut: r.checkOut,
        grossCents: cents(gross), feeCents: cents(fee), netCents: cents(derivedNet),
        note: note.trim() || undefined,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) { setMsg("Saved to accounting."); router.refresh(); } else setMsg(d.error || "Could not save.");
  }

  return (
    <div className="panel" style={{ borderLeft: logged ? "3px solid var(--forest, #253026)" : "3px solid #a3412e" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.8rem", flexWrap: "wrap", marginBottom: "0.7rem" }}>
        <div>
          <strong>{r.propertyName}</strong>
          <span className="tag" style={{ marginLeft: "0.5rem", fontSize: "0.72rem" }}>{CHANNEL_LABEL[r.channel]}</span>
          {logged ? <span className="tag" style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "var(--forest)", borderColor: "var(--forest)" }}>Logged · {money(r.netCents || 0)}</span>
            : <span className="tag" style={{ marginLeft: "0.4rem", fontSize: "0.72rem", color: "#a3412e", borderColor: "#a3412e" }}>Not logged</span>}
        </div>
        <span style={{ fontSize: "0.82rem", color: "var(--stone)" }}>{r.checkIn} → {r.checkOut}</span>
      </div>

      <p className="panel__hint" style={{ marginTop: 0, marginBottom: "0.7rem" }}>
        {r.confirmationCode && <>Code <strong>{r.confirmationCode}</strong>. </>}
        {r.phoneLast4 && <>Phone ••• {r.phoneLast4}. </>}
        {r.reservationLink && <a className="textlink" href={r.reservationLink} target="_blank" rel="noopener noreferrer">Open on {CHANNEL_LABEL[r.channel]} →</a>}
      </p>

      <div className="ef">
        <div><label>Guest paid / gross (€)</label><input type="number" value={gross} onChange={(e) => setGross(e.target.value)} placeholder="optional" /></div>
        <div><label>Channel fee (€)</label><input type="number" value={fee} onChange={(e) => setFee(e.target.value)} placeholder="optional" /></div>
        <div><label>Your payout / net (€) *</label><input type="number" value={net} onChange={(e) => setNet(e.target.value)} placeholder={gross && fee ? `${(cents(gross) - cents(fee)) / 100}` : "counts as revenue"} /></div>
        <div><label>Guest name</label><input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="from the reservation" /></div>
        <div className="full"><label>Note</label><input value={note} onChange={(e) => setNote(e.target.value)} placeholder="anything worth recording" /></div>
      </div>
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "0.7rem", flexWrap: "wrap" }}>
        <button className="btn btn--dark" disabled={busy} onClick={save}>{busy ? "Saving…" : logged ? "Update" : "Log payout"}</button>
        {msg && <span style={{ fontSize: "0.85rem", color: msg.startsWith("Saved") ? "var(--forest)" : "#a3412e" }}>{msg}</span>}
      </div>
    </div>
  );
}
