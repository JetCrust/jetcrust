"use client";
import { useEffect, useRef } from "react";

// Fires a single "view" beacon when a property page mounts.
export default function TrackView({ slug }: { slug: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    // Where they came from: UTM tag wins, else the referring site.
    const utm = new URLSearchParams(window.location.search).get("utm_source") || "";
    const ref = document.referrer || "";
    fetch("/api/track", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", slug, ref, utm }), keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
