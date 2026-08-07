"use client";
import { useEffect, useRef, useState } from "react";

type Turn = { role: "user" | "assistant"; content: string };

const SUGGESTIONS: Record<string, string[]> = {
  admin: [
    "How do I charge the security deposit for a long stay?",
    "How do I refund a guest's deposit?",
    "How do I add a chef task and WhatsApp the vendor?",
    "How do I change the nightly price?",
  ],
  client: [
    "What's the status of my booking?",
    "When is my card charged?",
    "How does the security deposit work?",
    "How do I add a massage to my stay?",
  ],
};

export default function AssistantWidget({ mode, name }: { mode: "admin" | "client"; name?: string }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);

  const greeting = mode === "admin"
    ? `Hi${name ? " " + name : ""} — ask me how to do anything on the back office: approvals, deposits, refunds, tasks, pricing.`
    : `Hi${name ? " " + name : ""} — ask me anything about your booking, payments, the deposit or your stay.`;

  useEffect(() => {
    if (open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [turns, busy, open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const history = turns.slice(-6);
    setTurns((t) => [...t, { role: "user", content: q }]);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });
      const data = await res.json().catch(() => ({}));
      setTurns((t) => [...t, { role: "assistant", content: data.answer || data.error || "Sorry, I couldn't answer that just now." }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", content: "Sorry, something went wrong. Please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  const accent = "var(--brass, #b08d57)";

  return (
    <>
      {/* Launcher */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close help" : "Open help"}
        style={{
          position: "fixed", right: 20, bottom: 20, zIndex: 60,
          width: 56, height: 56, borderRadius: "50%", border: "none", cursor: "pointer",
          background: "var(--forest, #253026)", color: "#fff", fontSize: "1.4rem",
          boxShadow: "0 8px 24px rgba(0,0,0,0.22)",
        }}
      >
        {open ? "✕" : "💬"}
      </button>

      {open && (
        <div
          style={{
            position: "fixed", right: 20, bottom: 88, zIndex: 60,
            width: "min(380px, calc(100vw - 40px))", height: "min(560px, calc(100vh - 140px))",
            display: "flex", flexDirection: "column",
            background: "var(--white, #fff)", borderRadius: 16, overflow: "hidden",
            border: "1px solid var(--line, #e4e0d8)", boxShadow: "0 18px 50px rgba(0,0,0,0.25)",
          }}
        >
          <div style={{ background: "var(--forest, #253026)", color: "#fff", padding: "0.9rem 1.1rem" }}>
            <strong style={{ fontSize: "1rem" }}>{mode === "admin" ? "Team helper" : "Jet Crust help"}</strong>
            <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Answers, not a live agent · replies may be imperfect</div>
          </div>

          <div ref={bodyRef} style={{ flex: 1, overflowY: "auto", padding: "1rem", display: "flex", flexDirection: "column", gap: "0.7rem", background: "var(--cream, #f7f4ee)" }}>
            <div style={bubble("assistant", accent)}>{greeting}</div>
            {turns.length === 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.2rem" }}>
                {(SUGGESTIONS[mode] || []).map((s) => (
                  <button key={s} onClick={() => send(s)} style={{ fontSize: "0.78rem", padding: "0.4rem 0.6rem", borderRadius: 999, border: "1px solid var(--line, #e4e0d8)", background: "#fff", cursor: "pointer", textAlign: "left", color: "var(--ink, #2a2a2a)" }}>{s}</button>
                ))}
              </div>
            )}
            {turns.map((t, i) => (
              <div key={i} style={bubble(t.role, accent)}>{t.content}</div>
            ))}
            {busy && <div style={{ ...bubble("assistant", accent), opacity: 0.6 }}>Thinking…</div>}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            style={{ display: "flex", gap: "0.5rem", padding: "0.7rem", borderTop: "1px solid var(--line, #e4e0d8)", background: "#fff" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your question…"
              style={{ flex: 1, padding: "0.6rem 0.8rem", borderRadius: 10, border: "1px solid var(--line, #e4e0d8)", fontSize: "0.9rem" }}
            />
            <button type="submit" disabled={busy || !input.trim()} style={{ padding: "0.6rem 1rem", borderRadius: 10, border: "none", background: "var(--forest, #253026)", color: "#fff", cursor: "pointer", fontWeight: 500 }}>Send</button>
          </form>
        </div>
      )}
    </>
  );
}

function bubble(role: "user" | "assistant", accent: string): React.CSSProperties {
  const me = role === "user";
  return {
    alignSelf: me ? "flex-end" : "flex-start",
    maxWidth: "85%",
    background: me ? accent : "#fff",
    color: me ? "#fff" : "var(--ink, #2a2a2a)",
    border: me ? "none" : "1px solid var(--line, #e4e0d8)",
    borderRadius: 12,
    padding: "0.6rem 0.8rem",
    fontSize: "0.88rem",
    lineHeight: 1.5,
    whiteSpace: "pre-wrap",
  };
}
