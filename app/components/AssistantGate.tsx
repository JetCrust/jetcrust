"use client";
import { useEffect, useState } from "react";
import AssistantWidget from "./AssistantWidget";

// Fetches the viewer's mode client-side so the root layout stays static
// (marketing/SEO pages are not forced dynamic). Renders nothing for guests
// who aren't signed in.
export default function AssistantGate() {
  const [state, setState] = useState<{ mode: "admin" | "client"; name?: string } | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/assistant", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (active && d?.mode) setState({ mode: d.mode, name: d.name }); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  if (!state) return null;
  return <AssistantWidget mode={state.mode} name={state.name} />;
}
