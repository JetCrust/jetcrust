"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import LocalTime from "./LocalTime";

type Msg = { id: string; sender: string; body: string; createdAt: string };

export default function MessageThread({ bookingId, messages, me }: {
  bookingId: string; messages: Msg[]; me: "GUEST" | "ADMIN";
}) {
  const [msgs, setMsgs] = useState<Msg[]>(messages);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/bookings/${bookingId}/messages`);
      if (!res.ok) return;
      const d = await res.json();
      if (Array.isArray(d.messages)) setMsgs((prev) => (prev.length !== d.messages.length || JSON.stringify(prev) !== JSON.stringify(d.messages)) ? d.messages : prev);
    } catch { /* offline; try again next tick */ }
  }, [bookingId]);

  // Live updates: poll every 8s (and once on mount, which also marks read).
  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 8000);
    return () => clearInterval(t);
  }, [refresh]);

  // Keep scrolled to the newest message when already at the bottom.
  useEffect(() => {
    const el = threadRef.current;
    if (el && atBottom.current) el.scrollTop = el.scrollHeight;
  }, [msgs]);

  const onScroll = () => {
    const el = threadRef.current;
    if (el) atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  async function send() {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    const res = await fetch(`/api/bookings/${bookingId}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body: text.trim() }),
    });
    setBusy(false);
    if (!res.ok) { const e = await res.json().catch(() => ({})); setError(e.error || "Could not send."); return; }
    setText("");
    atBottom.current = true;
    refresh();
  }

  return (
    <div>
      <div className="msg-thread" ref={threadRef} onScroll={onScroll}>
        {msgs.length === 0 ? (
          <p style={{ color: "var(--stone)", margin: 0, fontSize: "0.9rem" }}>No messages yet. Say hello, ask a question, or request anything for the stay.</p>
        ) : (
          msgs.map((m) => {
            const mine = m.sender === me;
            return (
              <div key={m.id} className={`msg ${mine ? "msg--me" : "msg--them"}`}>
                <div className="msg__bubble">{m.body}</div>
                <div className="msg__meta">{mine ? "You" : m.sender === "ADMIN" ? "Jet Crust" : "Guest"} · <LocalTime iso={m.createdAt} /></div>
              </div>
            );
          })
        )}
      </div>
      <div className="msg-compose">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2} placeholder="Write a message…"
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }} />
        <button className="btn btn--dark" disabled={busy || !text.trim()} onClick={send}>{busy ? "Sending…" : "Send"}</button>
      </div>
      {error && <p style={{ color: "#a3412e", fontSize: "0.85rem", margin: "0.4rem 0 0" }}>{error}</p>}
    </div>
  );
}
