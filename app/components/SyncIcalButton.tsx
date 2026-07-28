"use client";
import { useState } from "react";

export default function SyncIcalButton() {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
      <button
        className="btn btn--ghost"
        style={{ padding: "0.6rem 1.2rem" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMsg(null);
          const res = await fetch("/api/admin/sync-ical", { method: "POST" });
          const d = await res.json().catch(() => ({}));
          if (res.ok) {
            const total = Object.values(d.results || {}).reduce(
              (n: number, r) => n + ((r as { imported?: number }).imported || 0),
              0
            );
            setMsg(`Synced. ${total} imported dates across the collection.`);
          } else {
            setMsg(d.error || "Sync failed.");
          }
          setBusy(false);
        }}
      >
        {busy ? "Syncing…" : "Sync calendars"}
      </button>
      {msg && <span style={{ fontSize: "0.85rem", color: "var(--stone)" }}>{msg}</span>}
    </div>
  );
}
