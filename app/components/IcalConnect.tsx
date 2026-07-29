"use client";
import { useState } from "react";

type Row = { slug: string; name: string; urls: string[] };

// Friendly channel label from a feed URL, so a connected calendar reads
// "Airbnb" / "Booking.com" / "VRBO" instead of a long token URL.
function channelOf(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("airbnb")) return "Airbnb";
  if (u.includes("booking.com") || u.includes("admin.booking")) return "Booking.com";
  if (u.includes("vrbo") || u.includes("homeaway") || u.includes("expedia")) return "VRBO";
  if (u.includes("google")) return "Google";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Calendar"; }
}

function PropertyRow({ row, onSynced }: { row: Row; onSynced: () => void }) {
  const [urls, setUrls] = useState<string[]>(row.urls);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function connect() {
    const url = value.trim();
    if (!url) return;
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/properties/${row.slug}/ical`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setUrls(d.urls); setValue(""); setMsg("Connected. Pulling bookings…"); onSynced(); }
    else { setMsg(d.error || "Could not connect that link."); }
    setBusy(false);
  }

  async function remove(url: string) {
    setBusy(true); setMsg(null);
    const res = await fetch(`/api/admin/properties/${row.slug}/ical`, {
      method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }),
    });
    const d = await res.json().catch(() => ({}));
    if (res.ok) { setUrls(d.urls); setMsg("Removed."); onSynced(); }
    else { setMsg(d.error || "Could not remove that link."); }
    setBusy(false);
  }

  return (
    <div style={{ padding: "1rem 0", borderTop: "1px solid var(--line, #e7e2d8)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "0.5rem", flexWrap: "wrap" }}>
        <strong>{row.name}</strong>
        <span style={{ fontSize: "0.8rem", color: urls.length ? "var(--forest)" : "#a3412e" }}>
          {urls.length ? `${urls.length} connected` : "None connected yet"}
        </span>
      </div>

      {urls.length > 0 && (
        <ul style={{ listStyle: "none", padding: 0, margin: "0.6rem 0 0.4rem" }}>
          {urls.map((u) => (
            <li key={u} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", padding: "0.25rem 0" }}>
              <span style={{ fontWeight: 600 }}>{channelOf(u)}</span>
              <span style={{ color: "var(--stone)", fontSize: "0.72rem", wordBreak: "break-all", flex: 1 }}>{u}</span>
              <button onClick={() => remove(u)} disabled={busy} title="Remove"
                style={{ border: "none", background: "none", color: "#a3412e", cursor: "pointer", fontSize: "1rem", lineHeight: 1 }}>×</button>
            </li>
          ))}
        </ul>
      )}

      <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
          placeholder="Paste the OTA calendar link (Airbnb / Booking.com / VRBO)…"
          style={{ flex: "1 1 320px", minWidth: 0, padding: "0.55rem 0.7rem", border: "1px solid var(--line, #d8d2c6)", borderRadius: 8, fontSize: "0.85rem" }}
        />
        <button className="btn btn--ghost" style={{ padding: "0.55rem 1.1rem", flex: "0 0 auto" }} disabled={busy || !value.trim()} onClick={connect}>
          {busy ? "…" : "Connect"}
        </button>
      </div>
      {msg && <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem", color: "var(--stone)" }}>{msg}</p>}
    </div>
  );
}

export default function IcalConnect({ properties }: { properties: Row[] }) {
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true); setSyncMsg(null);
    const res = await fetch("/api/admin/sync-ical", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (res.ok) {
      const total = Object.values(d.results || {}).reduce((n: number, r) => n + ((r as { imported?: number }).imported || 0), 0);
      setSyncMsg(`Synced. ${total} imported date${total === 1 ? "" : "s"} across the collection. Refresh to see blocked dates below.`);
    } else setSyncMsg(d.error || "Sync failed.");
    setSyncing(false);
  }

  return (
    <div>
      {properties.map((row) => <PropertyRow key={row.slug} row={row} onSynced={sync} />)}
      <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap", marginTop: "1rem" }}>
        <button className="btn btn--ghost" style={{ padding: "0.6rem 1.2rem" }} disabled={syncing} onClick={sync}>
          {syncing ? "Syncing…" : "Sync now"}
        </button>
        {syncMsg && <span style={{ fontSize: "0.85rem", color: "var(--stone)" }}>{syncMsg}</span>}
      </div>
    </div>
  );
}
