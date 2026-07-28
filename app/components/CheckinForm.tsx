"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { compress, SignaturePad } from "./StayFormBits";

type Photo = { url: string; at: string };
type Item = { desc: string; amountCents: number };
type Initial = { photos: Photo[]; items: Item[]; notes: string; staffName: string; signature: string; acknowledged: boolean; completedAt: string | null } | null;

const money = (c: number) => `€${(c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const QUICK = [["Grocery pre-stock", 8000], ["Airport transfer", 15000], ["Private chef", 30000], ["Champagne on arrival", 12000]] as const;

export default function CheckinForm({ bookingId, propertyName, guestName, stay, initial }: {
  bookingId: string; propertyName: string; guestName: string;
  stay: { checkIn: string; checkOut: string; guests: number; checkInTime?: string };
  initial: Initial;
}) {
  const router = useRouter();
  const done = !!initial?.completedAt;
  const [photos, setPhotos] = useState<Photo[]>(initial?.photos || []);
  const [items, setItems] = useState<Item[]>(initial?.items || []);
  const [notes, setNotes] = useState(initial?.notes || "");
  const [staffName, setStaffName] = useState(initial?.staffName || "");
  const [ackRules, setAckRules] = useState(initial?.acknowledged || false);
  const [ackDeposit, setAckDeposit] = useState(initial?.acknowledged || false);
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
        const res = await fetch(`/api/admin/checkin/${bookingId}/photo`, { method: "POST", body: fd });
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
    const sig = sigRef.current?.export() || initial?.signature;
    if (complete) {
      if (!ackRules || !ackDeposit) { setError("Please confirm the house rules and deposit acknowledgements."); return; }
      if (!sig) { setError("Please capture the guest signature."); return; }
    }
    setBusy(true);
    const res = await fetch(`/api/admin/checkin/${bookingId}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos, items: items.filter((it) => it.desc.trim()), notes, staffName, signature: sig || undefined, acknowledged: ackRules && ackDeposit, complete }),
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
        <h1 className="co-title">Check-in: {propertyName}</h1>
        <p className="co-sub">{guestName}{done ? " · completed" : ""}</p>
      </div>

      {done && <div className="co-doneflag">This check-in is complete and signed. Changes below will not re-notify.</div>}

      {/* Stay confirmation */}
      <section className="co-sec">
        <h2 className="co-h">Stay</h2>
        <ul className="kv">
          <li><span>Arrival</span><span>{stay.checkIn}{stay.checkInTime ? ` · from ${stay.checkInTime}` : ""}</span></li>
          <li><span>Departure</span><span>{stay.checkOut}</span></li>
          <li><span>Guests</span><span>{stay.guests}</span></li>
        </ul>
      </section>

      {/* ID / arrival photos */}
      <section className="co-sec">
        <h2 className="co-h">ID &amp; arrival photos</h2>
        <div className="co-photos">
          {photos.map((p, i) => (
            <div key={i} className="co-thumb" style={{ backgroundImage: `url(${p.url})` }}>
              {!done && <button className="co-thumb__x" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}>×</button>}
            </div>
          ))}
          {!done && (
            <button className="co-takephoto" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "＋ Capture"}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <p className="co-note">Stored privately and compressed on the device. Capture ID only where your market requires it.</p>
      </section>

      {/* Preferences & notes */}
      <section className="co-sec">
        <h2 className="co-h">Preferences &amp; notes</h2>
        <textarea className="co-textarea" rows={3} value={notes} disabled={done} onChange={(e) => setNotes(e.target.value)} placeholder="Arrival time, pillow / temperature preferences, occasion, dietary notes, anything to make the stay theirs." />
      </section>

      {/* Early extras */}
      <section className="co-sec">
        <h2 className="co-h">Add-ons on arrival</h2>
        {!done && (
          <div className="co-quick">
            {QUICK.map(([label, amt]) => (
              <button key={label} className="chip" onClick={() => addItem(label as string, amt as number)}>+ {label}</button>
            ))}
          </div>
        )}
        {items.length === 0 ? (
          <p className="co-note">None. Add any early services above.</p>
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
        {total > 0 && <div className="co-total"><span>Add-ons total</span><strong>{money(total)}</strong></div>}
      </section>

      {/* Acknowledgements */}
      <section className="co-sec">
        <h2 className="co-h">Agreement <span className="co-req">required</span></h2>
        <label className={`co-check${ackRules ? " is-on" : ""}`}>
          <input type="checkbox" checked={ackRules} disabled={done} onChange={(e) => setAckRules(e.target.checked)} />
          <span>Guest has read and agrees to the house rules and rental agreement.</span>
        </label>
        <label className={`co-check${ackDeposit ? " is-on" : ""}`}>
          <input type="checkbox" checked={ackDeposit} disabled={done} onChange={(e) => setAckDeposit(e.target.checked)} />
          <span>Guest acknowledges the security-deposit terms for this stay.</span>
        </label>
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

      {/* Staff */}
      <section className="co-sec">
        <input className="co-staff" value={staffName} disabled={done} onChange={(e) => setStaffName(e.target.value)} placeholder="Checked in by (staff name)" />
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
