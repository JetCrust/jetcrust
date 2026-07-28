"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="textlink"
      style={{ fontSize: "0.72rem" }}
      disabled={busy}
      onClick={async () => {
        if (!confirm("Cancel this request? The hold on your card will be released.")) return;
        setBusy(true);
        await fetch(`/api/bookings/${bookingId}/cancel`, { method: "POST" }).catch(() => {});
        router.refresh();
      }}
    >
      {busy ? "Cancelling…" : "Cancel request"}
    </button>
  );
}
