"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Generates an AI draft (research + original write-up) and opens it for review.
export default function GenerateButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/posts/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
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
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.3rem" }}>
      <button className="btn btn--ghost" disabled={busy} onClick={run}>
        {busy ? "Writing a draft…" : "Generate a draft"}
      </button>
      {err && <span style={{ color: "#a3412e", fontSize: "0.82rem" }}>{err}</span>}
    </span>
  );
}
