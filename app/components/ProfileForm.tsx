"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ProfileForm({
  initial,
}: {
  initial: { name: string; phone: string; marketingOptIn: boolean };
}) {
  const router = useRouter();
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [marketingOptIn, setMarketing] = useState(initial.marketingOptIn);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    const res = await fetch("/api/account/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, phone, marketingOptIn }),
    });
    setBusy(false);
    if (!res.ok) { setError("Could not save. Please try again."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="ef" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div className="full"><label>Full name</label><input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Your name" /></div>
      <div className="full"><label>Phone</label><input value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} placeholder="+40 …" /></div>
      <div className="full">
        <label className="addon-check">
          <input type="checkbox" checked={marketingOptIn} onChange={(e) => { setMarketing(e.target.checked); setSaved(false); }} />
          <span>Send me occasional stories and offers from Jet Crust. You can unsubscribe anytime.</span>
        </label>
      </div>
      <div className="full" style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
        <button type="submit" className="btn btn--brass" disabled={busy}>{busy ? "Saving…" : "Save details"}</button>
        {saved && <span style={{ fontSize: "0.85rem", color: "var(--forest)" }}>Saved.</span>}
        {error && <span style={{ fontSize: "0.85rem", color: "#a3412e" }}>{error}</span>}
      </div>
    </form>
  );
}
