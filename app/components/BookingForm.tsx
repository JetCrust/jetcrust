"use client";
import { useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, AddressElement, useStripe, useElements } from "@stripe/react-stripe-js";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY as string);

type AddonUnit = "night" | "day" | "stay";
type RateLine = { kind: string; label: string; nights: number; rate: number; total: number };
type AddonLine = { value: string; title: string; unit: AddonUnit; unitPrice: number; qty: number; total: number };

type Quote = {
  nights: number;
  minNights: number;
  valid: boolean;
  currency: string;
  rateLines: RateLine[];
  stayTotal: number;
  addonLines: AddonLine[];
  addonsTotal: number;
  total: number;
  amountCents: number;
  avgNightly: number;
  hasWeekend: boolean;
  hasSeason: boolean;
  demandApplied: boolean;
};

type Addon = { icon?: string; title: string; value: string; text: string; price_eur?: number; unit?: AddonUnit };

type Props = {
  slug: string;
  propertyName: string;
  minNights: number;
  maxGuests: number;
  addons: Addon[];
  contract: string;
  signedIn: boolean;
  initial?: { checkIn?: string; checkOut?: string; guests?: number; addons?: string[]; note?: string };
};

const money = (n: number) => `€${Math.round(n).toLocaleString("en-US")}`;

function unitLabel(unit: AddonUnit): string {
  return unit === "stay" ? "per stay" : unit === "day" ? "per day" : "per night";
}

function fmtDate(s: string) {
  if (!s) return "";
  return new Date(s + "T00:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

// Itemised price: nightly rates grouped by kind, then each add-on, then the total.
function PriceBreakdown({ q }: { q: Quote }) {
  return (
    <div className="breakdown">
      {q.rateLines.map((l, i) => (
        <div className="breakdown__row" key={i}>
          <span>
            {l.nights} × {l.label} <small>at {money(l.rate)}</small>
          </span>
          <span>{money(l.total)}</span>
        </div>
      ))}

      {q.addonLines.length > 0 && (
        <div className="breakdown__row breakdown__row--sub">
          <span>Stay subtotal</span>
          <span>{money(q.stayTotal)}</span>
        </div>
      )}

      {q.addonLines.map((l) => (
        <div className="breakdown__row" key={l.value}>
          <span>
            {l.title} <small>{money(l.unitPrice)} {unitLabel(l.unit)}{l.qty > 1 ? ` × ${l.qty}` : ""}</small>
          </span>
          <span>{money(l.total)}</span>
        </div>
      ))}

      <div className="breakdown__row breakdown__row--total">
        <span>Total</span>
        <span>{money(q.total)}</span>
      </div>

      <p className="breakdown__note">
        {q.nights} night{q.nights === 1 ? "" : "s"} · average {money(q.avgNightly)} per night
        {q.demandApplied ? " · adjusted for demand" : ""}
      </p>
    </div>
  );
}

export default function BookingForm(props: Props) {
  const [checkIn, setCheckIn] = useState(props.initial?.checkIn || "");
  const [checkOut, setCheckOut] = useState(props.initial?.checkOut || "");
  const [guests, setGuests] = useState(props.initial?.guests || 2);
  const [addons, setAddons] = useState<string[]>(props.initial?.addons || []);
  const [note, setNote] = useState(props.initial?.note || "");
  const [accepted, setAccepted] = useState(false);
  const [over18, setOver18] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [deposit, setDeposit] = useState<{ depositCents: number; balanceCents: number; balanceDueAt: string | null } | null>(null);
  const [q, setQ] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Live price (public), re-quoted whenever dates or add-ons change.
  const addonKey = addons.join(",");
  useEffect(() => {
    if (!checkIn || !checkOut) { setQ(null); return; }
    let active = true;
    setQuoting(true);
    fetch(`/api/quote?slug=${props.slug}&checkIn=${checkIn}&checkOut=${checkOut}&addons=${encodeURIComponent(addonKey)}`)
      .then((r) => r.json())
      .then((data) => { if (active) setQ(data.error ? null : data); })
      .catch(() => active && setQ(null))
      .finally(() => active && setQuoting(false));
    return () => { active = false; };
  }, [checkIn, checkOut, addonKey, props.slug]);

  const priceValid = !!q && q.valid && guests >= 1 && guests <= props.maxGuests;

  async function requestBooking(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: props.slug, checkIn, checkOut, guests, addons, note, acceptContract: true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { toSignIn(); return; }
      setError(data.error || "Could not create the booking request.");
      setBusy(false);
      return;
    }
    setClientSecret(data.clientSecret);
    setBookingId(data.bookingId);
    setDeposit({ depositCents: data.depositCents, balanceCents: data.balanceCents, balanceDueAt: data.balanceDueAt });
    setBusy(false);
  }

  function toSignIn() {
    // Carry the whole selection (dates, guests, add-ons, note) through sign-in.
    const p = new URLSearchParams({ checkIn, checkOut, guests: String(guests) });
    if (addons.length) p.set("addons", addons.join(","));
    if (note.trim()) p.set("note", note.trim());
    const next = `/book/${props.slug}?${p.toString()}`;
    window.location.href = `/account?next=${encodeURIComponent(next)}`;
  }

  const appearance = useMemo(
    () => ({ theme: "flat" as const, variables: { colorPrimary: "#B08D57", fontFamily: "Jost, sans-serif", borderRadius: "8px" } }),
    []
  );

  if (clientSecret && q) {
    return (
      <Elements stripe={stripePromise} options={{ clientSecret, appearance }}>
        <CardHold
          deposit={deposit}
          bookingId={bookingId as string}
          propertyName={props.propertyName}
          checkIn={checkIn}
          checkOut={checkOut}
          guests={guests}
          q={q}
          onBack={() => { setClientSecret(null); setBookingId(null); }}
        />
      </Elements>
    );
  }

  return (
    <form className="ef" onSubmit={requestBooking}>
      <div><label>Check in</label><input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} required /></div>
      <div><label>Check out</label><input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} required /></div>
      <div><label>Guests</label><input type="number" min={1} max={props.maxGuests} value={guests} onChange={(e) => setGuests(Number(e.target.value))} /></div>
      <div><label>Minimum stay</label><input type="text" readOnly value={`${props.minNights} night${props.minNights === 1 ? "" : "s"}`} /></div>

      {guests > props.maxGuests && (
        <div className="full" style={{ marginTop: "-0.3rem", color: "#a3412e", fontSize: "0.9rem" }}>
          {props.propertyName} sleeps up to <strong>{props.maxGuests}</strong> {props.maxGuests === 1 ? "guest" : "guests"}. Please reduce the number of guests, or <a className="textlink" href="/#collection">choose a home with more space</a>.
        </div>
      )}

      <div className="full"><label>Add to your stay</label>
        <div className="addon-checks">
          {props.addons.map((a) => (
            <label className="addon-check" key={a.value}>
              <input type="checkbox" checked={addons.includes(a.value)}
                onChange={(e) => setAddons((prev) => (e.target.checked ? [...prev, a.value] : prev.filter((v) => v !== a.value)))} />
              <span>
                {a.title}
                {a.price_eur ? (
                  <small style={{ display: "block", color: "var(--stone)", fontSize: "0.78rem" }}>
                    {money(a.price_eur)} {unitLabel((a.unit as AddonUnit) || "stay")}
                  </small>
                ) : null}
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="full">
        <label>Your price</label>
        {quoting ? (
          <p className="breakdown__empty">Checking availability and price…</p>
        ) : !q || q.nights <= 0 ? (
          <p className="breakdown__empty">Select your dates to see the full price.</p>
        ) : !q.valid ? (
          <p className="breakdown__empty">This home has a minimum stay of {q.minNights} nights. Please extend your dates.</p>
        ) : (
          <PriceBreakdown q={q} />
        )}
      </div>

      <div className="full"><label>Anything else</label><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Occasion, party, special requests" /></div>

      {!props.signedIn ? (
        <div className="full">
          <div className="pdp-aside" style={{ position: "static" }}>
            <h3 style={{ fontSize: "1.3rem", marginBottom: "0.4rem" }}>Sign in to reserve</h3>
            <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: "0 0 1rem" }}>
              Review your dates and price above. To hold your dates you will create an account or sign in, then accept
              the rental agreement.
            </p>
            <button type="button" className="btn btn--brass" onClick={toSignIn}>Sign In or Create Account</button>
          </div>
        </div>
      ) : (
        <>
          <div className="full">
            <label>Rental agreement</label>
            <div style={{ maxHeight: 200, overflow: "auto", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", padding: "1rem", background: "var(--white)", fontSize: "0.86rem", whiteSpace: "pre-wrap", color: "var(--ink-soft)" }}>
              {props.contract}
            </div>
            <label className="addon-check" style={{ marginTop: "0.8rem" }}>
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              <span>I have read and accept the rental agreement, terms and privacy policy.</span>
            </label>
            <label className="addon-check" style={{ marginTop: "0.5rem" }}>
              <input type="checkbox" checked={over18} onChange={(e) => setOver18(e.target.checked)} />
              <span>I confirm the lead guest is 18 or over.</span>
            </label>
          </div>
          {error && <p className="full" style={{ color: "#a3412e", margin: 0, fontSize: "0.9rem" }}>{error}</p>}
          <div className="full">
            <button className="btn btn--brass" type="submit" disabled={!priceValid || !accepted || !over18 || busy}>
              {busy ? "Please wait…" : "Continue to secure hold"}
            </button>
            <p className="note" style={{ marginTop: "0.8rem", color: "var(--stone)", fontSize: "0.8rem" }}>
              Your card is held, not charged. We charge only once your booking is approved.
            </p>
          </div>
        </>
      )}
    </form>
  );
}

function CardHold({
  deposit,
  bookingId,
  propertyName,
  checkIn,
  checkOut,
  guests,
  q,
  onBack,
}: {
  deposit: { depositCents: number; balanceCents: number; balanceDueAt: string | null } | null;
  bookingId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  q: Quote;
  onBack: () => void;
}) {
  const holdEur = (deposit?.depositCents ?? 0) / 100;
  const balanceEur = (deposit?.balanceCents ?? 0) / 100;
  const split = balanceEur > 0;
  const balanceDate = deposit?.balanceDueAt
    ? new Date(deposit.balanceDueAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : null;
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function confirm(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);
    const { error } = await stripe.confirmPayment({ elements, redirect: "if_required" });
    if (error) {
      setError(error.message || "Could not authorize the card.");
      setBusy(false);
      return;
    }
    await fetch(`/api/bookings/${bookingId}/notify`, { method: "POST" }).catch(() => {});
    setDone(true);
  }

  if (done) {
    return (
      <div className="pdp-aside" style={{ position: "static" }}>
        <h3 style={{ fontSize: "1.6rem", marginBottom: "0.6rem" }}>Request received</h3>
        <p style={{ color: "var(--ink-soft)", margin: "0 0 0.8rem" }}>
          Thank you. Your request for <strong>{propertyName}</strong> is now <strong>pending approval</strong>. Your card
          has only been <strong>held</strong>, not charged.
        </p>
        <p style={{ color: "var(--ink-soft)", margin: "0 0 0.8rem" }}>
          Our team reviews every booking personally. You will receive an email confirmation, usually within a day. Your
          card is charged only once we approve the booking{split ? ", starting with the amount held now" : ""}.
        </p>
        <p style={{ margin: 0 }}>
          <a className="btn btn--brass" href="/account">Manage my booking</a>
        </p>
      </div>
    );
  }

  return (
    <form className="ef" onSubmit={confirm}>
      {/* Exactly what is being reserved, and exactly what gets charged when. */}
      <div className="full">
        <div className="pdp-aside" style={{ position: "static", marginBottom: "1.2rem" }}>
          <h3 style={{ fontSize: "1.3rem", marginBottom: "0.2rem" }}>Your request</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: "0.95rem", margin: "0 0 0.9rem" }}>{propertyName}</p>

          <div className="breakdown" style={{ marginBottom: "0.9rem" }}>
            <div className="breakdown__row"><span>Check in</span><span>{fmtDate(checkIn)}</span></div>
            <div className="breakdown__row"><span>Check out</span><span>{fmtDate(checkOut)}</span></div>
            <div className="breakdown__row"><span>Guests</span><span>{guests}</span></div>
          </div>

          <PriceBreakdown q={q} />

          <div className="payplan">
            {split ? (
              <>
                <div><strong>Held now:</strong> {money(holdEur)} — authorised, not charged. Captured only once we approve.</div>
                <div style={{ marginTop: "0.3rem" }}>
                  <strong>Balance:</strong> {money(balanceEur)}{balanceDate ? ` on ${balanceDate}` : " before arrival"}, to the same card.
                </div>
              </>
            ) : (
              <div><strong>Held now:</strong> {money(holdEur)} — authorised, not charged. Captured only once we approve.</div>
            )}
          </div>

          <button type="button" className="textlink" style={{ marginTop: "0.8rem", background: "none", border: "none", padding: 0, cursor: "pointer" }} onClick={onBack}>
            &larr; Change dates or add-ons
          </button>
        </div>
      </div>

      {/* Billing details: who the card belongs to + billing address. */}
      <div className="full">
        <label>Billing details</label>
        <AddressElement options={{ mode: "billing" }} />
      </div>

      {/* Card only (Satispay / ACH / wire and the Link account prompt are disabled server-side). */}
      <div className="full">
        <label>Card</label>
        <PaymentElement options={{ fields: { billingDetails: { name: "never", address: "never" } } }} />
      </div>

      {error && <p className="full" style={{ color: "#a3412e", margin: 0, fontSize: "0.9rem" }}>{error}</p>}
      <div className="full">
        <button className="btn btn--brass" type="submit" disabled={busy || !stripe}>
          {busy ? "Authorising…" : `Authorise ${money(holdEur)} hold & submit request`}
        </button>
        <p className="note" style={{ marginTop: "0.8rem", color: "var(--stone)", fontSize: "0.8rem" }}>
          Test mode: use card 4242 4242 4242 4242, any future date, any CVC, any billing details.
        </p>
      </div>
    </form>
  );
}
