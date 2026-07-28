"use client";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

type Card = { id: string; brand: string; last4: string; expMonth: number; expYear: number; isDefault: boolean };

const brandLabel = (b: string) => (b === "visa" ? "Visa" : b === "mastercard" ? "Mastercard" : b === "amex" ? "Amex" : b.charAt(0).toUpperCase() + b.slice(1));

export default function SavedCards() {
  const [cards, setCards] = useState<Card[] | null>(null);
  const [adding, setAdding] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/account/cards");
    const d = await res.json().catch(() => ({ cards: [] }));
    setCards(d.cards || []);
  }
  useEffect(() => { load(); }, []);

  async function startAdd() {
    setError(null);
    setAdding(true);
    const res = await fetch("/api/account/cards", { method: "POST" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok || !d.clientSecret) { setError("Could not start. Please try again."); setAdding(false); return; }
    setClientSecret(d.clientSecret);
  }

  async function remove(id: string) {
    setBusyId(id);
    await fetch(`/api/account/cards/${id}`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  async function makeDefault(id: string) {
    setBusyId(id);
    await fetch(`/api/account/cards/${id}`, { method: "PATCH" });
    setBusyId(null);
    load();
  }

  const appearance = useMemo(
    () => ({ theme: "flat" as const, variables: { colorPrimary: "#B08D57", fontFamily: "Jost, sans-serif", borderRadius: "8px" } }),
    []
  );

  return (
    <div>
      {cards === null ? (
        <p style={{ color: "var(--stone)" }}>Loading your cards…</p>
      ) : cards.length === 0 ? (
        <p style={{ color: "var(--stone)", marginTop: 0 }}>No cards saved yet. Add one to check out faster next time.</p>
      ) : (
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: "0 0 1.2rem" }}>
          {cards.map((c) => (
            <li key={c.id} className="cardrow">
              <span className="cardrow__face">
                <strong>{brandLabel(c.brand)}</strong> ····&nbsp;{c.last4}
                <span className="cardrow__exp">expires {String(c.expMonth).padStart(2, "0")}/{c.expYear}</span>
                {c.isDefault && <span className="pill pill--confirmed" style={{ marginLeft: "0.6rem" }}>Default</span>}
              </span>
              <span style={{ display: "flex", gap: "0.8rem", alignItems: "center" }}>
                {!c.isDefault && (
                  <button className="textlink" style={{ background: "none", border: 0, cursor: "pointer" }} disabled={busyId === c.id} onClick={() => makeDefault(c.id)}>Make default</button>
                )}
                <button className="textlink" style={{ background: "none", border: 0, cursor: "pointer", color: "#a3412e" }} disabled={busyId === c.id} onClick={() => remove(c.id)}>Remove</button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {error && <p style={{ color: "#a3412e", fontSize: "0.9rem" }}>{error}</p>}

      {!adding ? (
        <button className="btn btn--ghost" onClick={startAdd}>Add a card</button>
      ) : clientSecret ? (
        <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
          <AddCard
            onDone={() => { setAdding(false); setClientSecret(null); load(); }}
            onCancel={() => { setAdding(false); setClientSecret(null); }}
          />
        </Elements>
      ) : (
        <p style={{ color: "var(--stone)" }}>Preparing secure form…</p>
      )}
    </div>
  );
}

function AddCard({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error } = await stripe.confirmSetup({ elements, redirect: "if_required" });
    if (error) { setError(error.message || "Could not save the card."); setBusy(false); return; }
    onDone();
  }

  return (
    <form className="ef" onSubmit={save} style={{ marginTop: "1rem" }}>
      <div className="full"><label>New card</label><PaymentElement /></div>
      <div className="full" style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
        <button className="btn btn--brass" type="submit" disabled={busy || !stripe}>{busy ? "Saving…" : "Save card"}</button>
        <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={busy}>Cancel</button>
      </div>
      {error && <p className="full" style={{ color: "#a3412e", fontSize: "0.9rem", margin: 0 }}>{error}</p>}
      <p className="full note" style={{ color: "var(--stone)", fontSize: "0.8rem", margin: 0 }}>
        Test mode: card 4242 4242 4242 4242, any future date, any CVC.
      </p>
    </form>
  );
}
