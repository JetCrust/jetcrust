"use client";
import { useEffect, useRef } from "react";

// Fires a single "view" beacon when a property page mounts.
export default function TrackView({ slug }: { slug: string }) {
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    fetch("/api/track", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "view", slug }), keepalive: true,
    }).catch(() => {});
  }, [slug]);
  return null;
}
