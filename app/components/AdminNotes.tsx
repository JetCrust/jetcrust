"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import LocalTime from "./LocalTime";

type NoteEntry = { text: string; at: string };

// Internal host notes as a running, dated log. Each note is added, never overwritten.
export default function AdminNotes({ bookingId, log }: { bookingId: string; log: NoteEntry[] }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!value.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}/notes`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note: value.trim() }),
    });
    setBusy(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Could not save the note.");
      return;
    }
    setValue("");
    router.refresh();
  }

  return (
    <div>
      {log.length > 0 && (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
          {log.map((n, i) => (
            <li key={i} style={{ padding: "0.7rem 0.9rem", background: "var(--white)", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}>
              <span className="panel__hint" style={{ display: "block", marginBottom: "0.25rem" }}>
                {n.at ? <LocalTime iso={n.at} /> : "Earlier"}
              </span>
              <span style={{ color: "var(--ink-soft)", whiteSpace: "pre-wrap" }}>{n.text}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="ef" style={{ gridTemplateColumns: "1fr" }}>
        <div className="full">
          <textarea value={value} onChange={(e) => setValue(e.target.value)} placeholder="Add a note (arrival time, gate code, a call you had, a follow-up…)" />
        </div>
        <div className="full" style={{ display: "flex", gap: "0.8rem", alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn--brass" disabled={busy || !value.trim()} onClick={add}>
            {busy ? "Adding…" : "Add note"}
          </button>
          {error && <span style={{ fontSize: "0.85rem", color: "#a3412e" }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}
