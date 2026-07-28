"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminActions({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "decline") {
    setBusy(action);
    setError(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Action failed.");
      setBusy(null);
      return;
    }
    router.refresh();
  }

  return (
    <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", flexWrap: "wrap" }}>
      <button className="btn btn--brass" style={{ padding: "0.6rem 1.2rem" }} disabled={!!busy} onClick={() => act("approve")}>
        {busy === "approve" ? "Charging…" : "Approve & Charge"}
      </button>
      <button className="btn btn--ghost" style={{ padding: "0.6rem 1.2rem" }} disabled={!!busy} onClick={() => act("decline")}>
        {busy === "decline" ? "Releasing…" : "Decline"}
      </button>
      {error && <span style={{ color: "#a3412e", fontSize: "0.85rem" }}>{error}</span>}
    </div>
  );
}
