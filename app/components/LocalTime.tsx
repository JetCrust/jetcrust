"use client";
import { useEffect, useState } from "react";

// Renders a timestamp in the VIEWER's local timezone. Server components format
// in the server's TZ (UTC on Vercel), which showed the wrong time. This renders
// a stable UTC string on the server + first paint (so hydration matches), then
// swaps to the viewer's local time after mount.
export default function LocalTime({ iso, mode = "datetime" }: { iso: string; mode?: "datetime" | "date" }) {
  const opts: Intl.DateTimeFormatOptions =
    mode === "date"
      ? { day: "numeric", month: "short", year: "numeric" }
      : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  const utc = new Date(iso).toLocaleString("en-GB", { ...opts, timeZone: "UTC" });
  const [local, setLocal] = useState<string | null>(null);
  useEffect(() => { setLocal(new Date(iso).toLocaleString("en-GB", opts)); }, [iso, mode]);
  return <span suppressHydrationWarning>{local ?? utc}</span>;
}
