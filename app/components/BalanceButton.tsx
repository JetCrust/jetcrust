"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BalanceButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <span style={{ display: "inline-flex", gap: "0.6rem", alignItems: "center" }}>
      <button
        className="btn btn--ghost"
        style={{ padding: "0.5rem 1rem" }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setErr(null);
          const res = await fetch(`/api/admin/bookings/${bookingId}/charge-balance`, { method: "POST" });
          const d = await res.json().catch(() => ({}));
          if (!res.ok) { setErr(d.error || "Charge failed."); setBusy(false); return; }
          router.refresh();
        }}
      >
        {busy ? "Charging…" : "Charge balance now"}
      </button>
      {err && <span style={{ color: "#a3412e", fontSize: "0.82rem" }}>{err}</span>}
    </span>
  );
}
