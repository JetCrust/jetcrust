"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GuestStayForms({
  bookingId, preferences, showPreferences, canReview, review, googleReviewUrl,
}: {
  bookingId: string;
  preferences: string;
  showPreferences: boolean;
  canReview: boolean;
  review: { rating: number; text: string } | null;
  googleReviewUrl?: string;
}) {
  const router = useRouter();
  const [prefs, setPrefs] = useState(preferences);
  const [prefBusy, setPrefBusy] = useState(false);
  const [prefMsg, setPrefMsg] = useState<string | null>(null);

  const [rating, setRating] = useState(review?.rating || 0);
  const [reviewText, setReviewText] = useState(review?.text || "");
  const [revBusy, setRevBusy] = useState(false);
  const [revMsg, setRevMsg] = useState<string | null>(null);
  const [editingReview, setEditingReview] = useState(!review);
  const [copied, setCopied] = useState(false);
  function copyReview() {
    navigator.clipboard?.writeText(review?.text || "").then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  }

  async function savePrefs() {
    setPrefBusy(true); setPrefMsg(null);
    const res = await fetch(`/api/bookings/${bookingId}/guest`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "preferences", text: prefs }),
    });
    setPrefBusy(false);
    setPrefMsg(res.ok ? "Saved. Your host will see this." : "Could not save.");
    if (res.ok) router.refresh();
  }

  async function submitReview() {
    if (!rating) { setRevMsg("Please choose a star rating."); return; }
    setRevBusy(true); setRevMsg(null);
    const res = await fetch(`/api/bookings/${bookingId}/guest`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "review", rating, text: reviewText }),
    });
    setRevBusy(false);
    if (res.ok) { setRevMsg("Thank you for your review."); setEditingReview(false); router.refresh(); }
    else setRevMsg("Could not submit.");
  }

  return (
    <>
      {showPreferences && (
        <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
          <h3 style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>Pre-arrival preferences</h3>
          <p className="panel__hint" style={{ marginTop: 0 }}>Tell us anything that will make this stay yours. Your host sees it before you arrive.</p>
          <textarea value={prefs} onChange={(e) => setPrefs(e.target.value)} rows={3}
            placeholder="Arrival time, pillow / temperature, celebrating something, dietary notes, requests…"
            style={{ width: "100%", padding: "0.8rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontFamily: "inherit", fontSize: "0.95rem", background: "#fff", resize: "vertical" }} />
          <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.8rem", alignItems: "center" }}>
            <button className="btn btn--dark" disabled={prefBusy} onClick={savePrefs}>{prefBusy ? "Saving…" : "Save preferences"}</button>
            {prefMsg && <span style={{ fontSize: "0.85rem", color: "var(--stone)" }}>{prefMsg}</span>}
          </div>
        </div>
      )}

      {canReview && (
        <div id="review" className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
          <h3 style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>{review ? "Your review" : "Leave a review"}</h3>
          {!editingReview && review ? (
            <>
              <div className="stars" aria-label={`${review.rating} out of 5`}>{"★★★★★".slice(0, review.rating)}<span className="stars__empty">{"★★★★★".slice(review.rating)}</span></div>
              {review.text && <p style={{ margin: "0.5rem 0 0", color: "var(--ink-soft)" }}>&ldquo;{review.text}&rdquo;</p>}
              <button className="textlink" style={{ marginTop: "0.6rem", background: "none", border: "none", cursor: "pointer", padding: 0 }} onClick={() => setEditingReview(true)}>Edit review</button>
            </>
          ) : (
            <>
              <p className="panel__hint" style={{ marginTop: 0 }}>How was your stay? Your feedback helps us and future guests.</p>
              <div className="star-pick">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" className={`star-pick__btn${n <= rating ? " is-on" : ""}`} onClick={() => setRating(n)} aria-label={`${n} star${n > 1 ? "s" : ""}`}>★</button>
                ))}
              </div>
              <textarea value={reviewText} onChange={(e) => setReviewText(e.target.value)} rows={3} placeholder="What made the stay special? (optional)"
                style={{ width: "100%", marginTop: "0.6rem", padding: "0.8rem", border: "1px solid var(--line)", borderRadius: "var(--radius-sm)", fontFamily: "inherit", fontSize: "0.95rem", background: "#fff", resize: "vertical" }} />
              <div style={{ marginTop: "0.6rem", display: "flex", gap: "0.8rem", alignItems: "center" }}>
                <button className="btn btn--dark" disabled={revBusy} onClick={submitReview}>{revBusy ? "Sending…" : "Submit review"}</button>
                {revMsg && <span style={{ fontSize: "0.85rem", color: "var(--stone)" }}>{revMsg}</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* After a review is left, thank everyone and invite a public share. Low
          ratings are led to a private fix first, but the public option is still
          offered to all (no review gating). */}
      {review && (
        <div className="pdp-aside" style={{ position: "static", marginBottom: "1.6rem" }}>
          {review.rating >= 4 ? (
            <>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>Thank you</h3>
              <p className="panel__hint" style={{ marginTop: 0 }}>We are so glad you enjoyed your stay. If you have a moment, sharing it on Google means a great deal to our small team.</p>
              {review.text && googleReviewUrl && (
                <div style={{ background: "var(--cream-2, #f4f0e6)", borderRadius: "var(--radius-sm)", padding: "0.7rem 0.9rem", marginBottom: "0.8rem" }}>
                  <p style={{ margin: "0 0 0.4rem", fontSize: "0.8rem", color: "var(--stone)" }}>Copy your words, then paste them on Google:</p>
                  <p style={{ margin: "0 0 0.6rem", fontStyle: "italic", color: "var(--ink-soft)" }}>&ldquo;{review.text}&rdquo;</p>
                  <button type="button" className="btn btn--ghost" style={{ padding: "0.4rem 0.9rem", fontSize: "0.85rem" }} onClick={copyReview}>{copied ? "Copied ✓" : "Copy my review"}</button>
                </div>
              )}
              {googleReviewUrl
                ? <a className="btn btn--brass" href={googleReviewUrl} target="_blank" rel="noopener noreferrer">Share your stay on Google</a>
                : <p style={{ margin: 0, color: "var(--stone)", fontSize: "0.85rem" }}>Thank you again for your kind words.</p>}
            </>
          ) : (
            <>
              <h3 style={{ fontSize: "1.2rem", marginBottom: "0.4rem" }}>Thank you for the honest feedback</h3>
              <p className="panel__hint" style={{ marginTop: 0 }}>We are sorry it was not perfect. We would genuinely like to make it right. Tell us what happened and we will follow up with you personally.</p>
              <a className="btn btn--dark" href="/account/messages">Message our team</a>
              {googleReviewUrl && (
                <p className="panel__hint" style={{ marginTop: "0.9rem", marginBottom: 0 }}>
                  You are also welcome to <a className="textlink" href={googleReviewUrl} target="_blank" rel="noopener noreferrer">review us on Google</a>.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </>
  );
}
