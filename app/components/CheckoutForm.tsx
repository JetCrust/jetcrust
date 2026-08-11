"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compress, SignaturePad } from "./StayFormBits";

type Photo = { url: string; at: string };
type Item = { desc: string; amountCents: number };
type Initial = { photos: Photo[]; items: Item[]; depositStatus: string; depositNote: string; notes: string; staffName: string; signature: string; completedAt: string | null } | null;

const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const QUICK = [["Wine", 5000], ["Minibar", 3000], ["Late checkout", 8000], ["Extra cleaning", 6000], ["Chef groceries", 0], ["Flowers", 0], ["Damage", 0], ["Other", 0]] as const;

export default function CheckoutForm({ bookingId, propertyName, guestName, security, initial }: {
  bookingId: string; propertyName: string; guestName: string;
  security: { cents: number; status: string; capturedCents: number };
  initial: Initial;
}) {
  const router = useRouter();
  const done = !!initial?.completedAt;
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos || []);
  const [items, setItems] = useState<Item[]>(initial?.items || []);
  const [depositStatus, setDepositStatus] = useState(initial?.depositStatus || (security.status === "captured" ? "partial" : "refund"));
  const [notes, setNotes] = useState(initial?.notes || "");
  const [staffName, setStaffName] = useState(initial?.staffName || "");
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<{ export: () => string | undefined } | null>(null);

  const total = items.reduce((s, it) => s + it.amountCents, 0);

  async function onFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true); setError(null);
    for (const file of Array.from(list)) {
      try {
        const blob = await compress(file);
        const fd = new FormData();
        fd.append("file", blob, "photo.jpg");
        const res = await fetch(`/api/admin/checkout/${bookingId}/photo`, { method: "POST", body: fd });
        const d = await res.json().catch(() => ({}));
        if (!res.ok) { setError(d.error || "Upload failed."); break; }
        setPhotos((p) => [...p, { url: d.url, at: new Date().toISOString() }]);
      } catch { setError("Could not process that image."); }
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const addItem = (desc = "", amountCents = 0) => setItems((x) => [...x, { desc, amountCents }]);
  const setItem = (i: number, patch: Partial<Item>) => setItems((x) => x.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems((x) => x.filter((_, j) => j !== i));

  async function submit(complete: boolean) {
    setError(null);
    const sig = complete ? sigRef.current?.export() : sigRef.current?.export() || initial?.signature;
    if (complete) {
      if (photos.length === 0) { setError("Take at least one condition photo."); return; }
      if (!sig) { setError("Please capture the guest signature."); return; }
    }
    setBusy(true);
    const res = await fetch(`/api/admin/checkout/${bookingId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos, items: items.filter((it) => it.desc.trim()), depositStatus, notes, staffName, signature: sig || undefined, complete }),
    });
    setBusy(false);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Could not save."); return; }
    if (complete) router.refresh();
    else setError("Saved.");
  }

  return (
    <div className="co-card">
      <div className="co-head">
        <button className="co-back" onClick={() => router.push(`/admin/bookings/${bookingId}`)}>‹ Booking</button>
        <h1 className="co-title">Check-out: {propertyName}</h1>
        <p className="co-sub">{guestName}{done ? " · completed" : ""}</p>
      </div>

      {done && (
        <div className="co-doneflag">This check-out is complete. The guest has been emailed a signed summary. Changes below will not re-charge or re-send.</div>
      )}

      {/* Photos */}
      <section className="co-sec">
        <h2 className="co-h">Condition photos <span className="co-req">required</span></h2>
        <div className="co-photos">
          {photos.map((p, i) => (
            <div key={i} className="co-thumb" style={{ backgroundImage: `url(${p.url})` }}>
              {!done && <button className="co-thumb__x" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}>×</button>}
            </div>
          ))}
          {!done && (
            <button className="co-takephoto" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "＋ Take photos"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <p className="co-note">Photos shrink on the device before saving, so they stay small and load fast.</p>
      </section>

      {/* Extras / charges */}
      <section className="co-sec">
        <h2 className="co-h">Extras &amp; additional charges</h2>
        {!done && (
          <div className="co-quick">
            {QUICK.map(([label, amt]) => (
              <button key={label} className="chip" onClick={() => addItem(label as string, amt as number)}>+ {label}</button>
            ))}
          </div>
        )}
        {items.length === 0 ? (
          <p className="co-note">No extras. Add bar, minibar, services or a breakage above.</p>
        ) : (
          <div className="co-items">
            {items.map((it, i) => (
              <div key={i} className="co-item">
                <input className="co-item__desc" value={it.desc} disabled={done} onChange={(e) => setItem(i, { desc: e.target.value })} placeholder="Description" />
                <div className="co-item__amt">
                  <span>€</span>
                  <input type="number" min={0} step="0.01" disabled={done} value={it.amountCents ? it.amountCents / 100 : ""} onChange={(e) => setItem(i, { amountCents: Math.round(Number(e.target.value) * 100) })} placeholder="0.00" />
                </div>
                {!done && <button className="co-item__x" onClick={() => removeItem(i)}>×</button>}
              </div>
            ))}
          </div>
        )}
        <div className="co-total"><span>Total additional charges</span><strong>{money(total)}</strong></div>
      </section>

      {/* Security deposit */}
      <section className="co-sec">
        <h2 className="co-h">Security deposit</h2>
        <p className="co-note" style={{ marginTop: 0 }}>
          {security.cents > 0 ? `${money(security.cents)} on file · currently ${security.status}.` : "No security deposit set for this home."}
          {" "}Money is moved on the booking's deposit panel; here you record the outcome for the guest.
        </p>
        <div className="co-radios">
          {[["refund", "Refund in full"], ["partial", "Partial claim"], ["claim", "Charge for items"], ["pending", "Review later"]].map(([v, l]) => (
            <label key={v} className={`co-radio${depositStatus === v ? " is-on" : ""}`}>
              <input type="radio" name="dep" value={v} checked={depositStatus === v} disabled={done} onChange={() => setDepositStatus(v)} /> {l}
            </label>
          ))}
        </div>
      </section>

      {/* Signature */}
      <section className="co-sec">
        <h2 className="co-h">Guest signature <span className="co-req">required</span></h2>
        {done && initial?.signature ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={initial.signature} alt="Signature" className="co-sigimg" />
        ) : (
          <SignaturePad ref={sigRef} initial={initial?.signature} />
        )}
      </section>

      {/* Notes + staff */}
      <section className="co-sec">
        <h2 className="co-h">Notes</h2>
        <textarea className="co-textarea" rows={3} value={notes} disabled={done} onChange={(e) => setNotes(e.target.value)} placeholder="Anything worth recording about the walkthrough." />
        <input className="co-staff" value={staffName} disabled={done} onChange={(e) => setStaffName(e.target.value)} placeholder="Completed by (staff name)" />
      </section>

      {error && <p className="co-error">{error}</p>}

      {!done && (
        <div className="co-actions">
          <button className="btn btn--ghost" disabled={busy} onClick={() => submit(false)}>Save draft</button>
          <button className="co-complete" disabled={busy} onClick={() => submit(true)}>{busy ? "Saving…" : "Confirm & complete"}</button>
        </div>
      )}
    </div>
  );
}
