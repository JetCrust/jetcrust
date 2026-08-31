"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

// Delete an OTA booking (e.g. one created from a stray calendar block).
export default function RemoveOtaButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function remove() {
    if (!confirm("Remove this OTA booking from your Bookings list? If it's still a real reservation in the calendar feed, it may reappear on the next sync.")) return;
    setBusy(true); setErr(null);
    const res = await fetch(`/api/admin/bookings/${bookingId}`, { method: "DELETE" });
    if (res.ok) { router.push("/admin"); router.refresh(); return; }
    const d = await res.json().catch(() => ({}));
    setErr(d.error || "Could not remove."); setBusy(false);
  }

  return (
    <span style={{ display: "inline-flex", flexDirection: "column", gap: "0.3rem" }}>
      <button className="btn btn--ghost" disabled={busy} onClick={remove} style={{ color: "#a3412e" }}>{busy ? "Removing…" : "Remove this booking"}</button>
      {err && <span style={{ color: "#a3412e", fontSize: "0.82rem" }}>{err}</span>}
    </span>
  );
}
