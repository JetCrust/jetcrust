"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Generates an AI draft (research + original write-up) and opens it for review.
// Leave the topic blank to auto-pick the next one, or type a specific topic
// (e.g. "Halloween at Bran Castle") to write that.
export default function GenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [topic, setTopic] = useState("");

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/posts/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(topic.trim() ? { topic: topic.trim() } : {}),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setErr(d.error || "Could not generate."); setBusy(false); return; }
      router.push(`/admin/journal/${d.id}`);
      router.refresh();
    } catch {
      setErr("Could not generate.");
      setBusy(false);
    }
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.4rem", maxWidth: 420 }}>
      <span style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic (optional) — e.g. Halloween at Bran Castle"
          disabled={busy}
          style={{ flex: 1, minWidth: 220, padding: "0.5rem 0.7rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)" }}
        />
        <button className="btn btn--ghost" disabled={busy} onClick={run}>
          {busy ? "Writing a draft…" : "Generate a draft"}
        </button>
      </span>
      {err && <span style={{ color: "#a3412e", fontSize: "0.82rem" }}>{err}</span>}
    </span>
  );
}
