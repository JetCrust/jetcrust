"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const TITLES = ["", "Mr", "Mrs", "Ms", "Mx"];

export default function ProfileForm({
  initial,
}: {
  initial: { title: string; name: string; phone: string; preferences: string; marketingOptIn: boolean };
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [name, setName] = useState(initial.name);
  const [phone, setPhone] = useState(initial.phone);
  const [preferences, setPreferences] = useState(initial.preferences);
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
      body: JSON.stringify({ title, name, phone, preferences, marketingOptIn }),
    });
    setBusy(false);
    if (!res.ok) { setError("Could not save. Please try again."); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form className="ef" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <div>
        <label>Title</label>
        <select value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }}>
          {TITLES.map((t) => <option key={t} value={t}>{t || "—"}</option>)}
        </select>
      </div>
      <div><label>Full name</label><input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="Your name" /></div>
      <div className="full"><label>Phone</label><input value={phone} onChange={(e) => { setPhone(e.target.value); setSaved(false); }} placeholder="+40 …" /></div>
      <div className="full">
        <label>Preferences (optional)</label>
        <textarea value={preferences} onChange={(e) => { setPreferences(e.target.value); setSaved(false); }} placeholder="Dietary needs, allergies, special occasions, arrival preferences, favourite experiences — anything we should know to look after you." />
      </div>
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
