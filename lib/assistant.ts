import Anthropic from "@anthropic-ai/sdk";

// The in-app helper. Answers "how do I…" for the team and "what's happening with
// my booking" for guests. Uses Claude when ANTHROPIC_API_KEY is set, and falls
// back to a keyword match over the same knowledge base when it isn't — so the
// helper is useful immediately and gets smarter once the key is added.

export type ChatTurn = { role: "user" | "assistant"; content: string };

const MODEL = process.env.ASSISTANT_MODEL || "claude-opus-4-8";

// ---- Knowledge base -------------------------------------------------------

export const ADMIN_KB = `You are the Jet Crust back-office assistant, helping the owner and their team run the booking site. Be brief, concrete and friendly. Give click-by-click steps. Never invent features that aren't listed here; if you don't know, say so and suggest where to look or to check the System check page.

HOW THE BACK OFFICE IS ORGANISED (left menu inside /admin):
- Overview: portfolio snapshot. Bookings: every request and stay. Guests: guest profiles. Leads & CRM: enquiries pipeline. Inbox: guest messages. Calendar & sync: block dates, iCal. Operations: tasks/turnovers. Reports, Finance & P&L, OTA bookings, Channel rates. Properties & pricing. Journal. Users & access. System check (diagnostics).

APPROVING A BOOKING:
- Open Bookings, click the request (status Requested). The guest's card is only HELD at this point, not charged.
- Press Approve to confirm the stay — this captures (charges) the held amount. Press Decline to release the hold with no charge.

PAYMENTS:
- At booking the card is authorised (held) for the full amount. It is charged when you Approve.
- If a booking is split, a Balance is due later — open the booking and press Charge balance, or it charges automatically on the due date.
- Refunds: open the booking and use the refund control to refund part or all of the stay charge.

SECURITY DEPOSIT (separate from the rent, on each approved booking, "Security deposit" panel):
- It runs automatically. Short stays (7 nights or fewer): a HOLD is placed ~2 days before check-out — nothing is charged — and released after a clean check-out. Long stays (over 7 nights): the deposit is CHARGED near check-in and REFUNDED after a clean check-out (a card hold can't last a long stay).
- Manual buttons on that panel: "Place hold now" / "Charge deposit now" to secure early; "Release (clean checkout)" or "Refund to guest (clean)" to give it all back; or type an amount in "keep €__ for damage" to keep that much and release/refund the rest.
- You refund from the website here — no need to open Stripe.
- A hold expires ~7 days after it is placed. If you need longer to assess damage, use "keep €2,000 for damage" to secure it, then refund the unused part later.

CHARGING MORE THAN THE DEPOSIT (extras/damage above €2,000):
- Open the booking's Extras ledger, add a line (description + amount) and settle it — it charges the guest's saved card for any amount, beyond the deposit if needed.

CHECK-IN / CHECK-OUT:
- On an approved booking use the check-in and check-out forms to record condition photos and any extras consumed. The check-out report feeds the deposit decision (if it logs extra charges, the deposit is left for you to handle rather than auto-released).

OPERATIONS / TASKS:
- Operations page: add a task (cleaning, turnover, maintenance, or a service like chef/massage/transfer/experience), assign it to a team member or an outside vendor, and send them a WhatsApp with one click. Mark Confirmed when they accept and Done when finished. A paid task becomes an Expense automatically.

LEADS & CRM:
- Add an enquiry, set the source (phone, WhatsApp, email, Instagram, etc.), interested dates and a follow-up date, and log notes. Overdue follow-ups are flagged.

PROPERTIES & PRICING:
- Edit nightly rates, weekend/seasonal rates, minimum nights, discounts, the security deposit amount, and add-ons.
- Add-ons can be charged per night, per day, per stay, or "each" — "each" lets the guest choose a quantity (sessions, hours, days) with a min and max. Set the noun (e.g. "session"), Min and Max when you pick "each".

USERS & ACCESS: add team members as Manager (their properties) or Staff (operations only); Staff and crew can have a phone number for WhatsApp.

SYSTEM CHECK (/admin/diagnostics): shows whether Stripe (live keys), email, storage and the database are healthy. Start here if payments or emails aren't working.`;

export const CLIENT_KB = `You are the Jet Crust guest assistant. Be warm, concise and helpful. Answer questions about the guest's booking and how things work. Only state facts from the booking details provided or from the general policies below. If you don't know something specific, say you'll pass it to the team, or suggest they message the host from their booking. Never share card numbers or internal notes.

BOOKING STATUS MEANINGS:
- Requested: we've received your request and your card is only HELD (not charged) while we confirm your dates.
- Approved: your stay is confirmed and the held amount has been charged.
- Declined / Cancelled / Expired: the hold is released and nothing is charged.

WHEN YOUR CARD IS CHARGED:
- A hold is placed when you request. You're charged only when Jet Crust approves the booking. If your booking is split, any balance is due before arrival (the date is shown on your booking).

SECURITY DEPOSIT (refundable, separate from the rent):
- For shorter stays we place a temporary hold shortly before departure — nothing is taken unless there's damage — and release it after a clean check-out.
- For longer stays the deposit is charged near check-in and refunded in full after a clean check-out, usually within a few business days (a card hold can't last a long stay).

EXPERIENCES / ADD-ONS (chef, massage, sauna, ski, etc.):
- Arranged with trusted local partners and subject to availability, so book ahead. Tell us your preferred days and times in the booking notes and we'll confirm. If something you paid for can't be provided, it's refunded.

OTHER:
- Cancellation: unless stated otherwise, nights are non-refundable within 30 days of arrival; we'll confirm terms with you.
- When the guest's guidebook is included in the context, answer their specific questions from it directly (Wi-Fi, getting in, how the pool/saunas/cinema/sound work, house rules, local picks). The full guidebook is also on their booking once approved.
- You can message the host directly from your booking for anything else.
- Check-in/check-out times are shown on your booking.`;

// Small keyword fallback so the helper still answers without an API key.
const FALLBACK: { keys: string[]; a: string }[] = [
  { keys: ["deposit", "security", "hold", "refund"], a: "The €2,000 security deposit is refundable and separate from the rent. For short stays it's a temporary hold placed just before check-out (nothing is taken unless there's damage); for longer stays it's charged near check-in and refunded after a clean check-out. The host can release or refund it, or keep part for damage, from the booking." },
  { keys: ["charge", "charged", "card", "pay", "payment", "when"], a: "Your card is held when you request a booking and charged only when Jet Crust approves it. Any split balance is due before arrival, on the date shown on your booking." },
  { keys: ["approve", "approving", "confirm", "capture"], a: "Open Bookings, click the request, and press Approve to confirm and charge the held card, or Decline to release the hold. (Admin)" },
  { keys: ["extra", "damage", "beyond", "more than"], a: "For charges beyond the deposit, use the Extras ledger on the booking — it charges the guest's saved card for any amount. (Admin)" },
  { keys: ["cancel", "cancellation", "refund policy"], a: "Unless stated otherwise, nights are non-refundable within 30 days of arrival. The team will confirm terms with you." },
  { keys: ["experience", "add-on", "addon", "chef", "massage", "ski", "sauna", "spa"], a: "Experiences are arranged with local partners and are subject to availability, so book ahead. Add how you'd like them scheduled in your booking notes and we'll confirm." },
  { keys: ["guidebook", "wifi", "wi-fi", "check in", "check-in", "get in", "code"], a: "Your digital guidebook — Wi-Fi, how to get in and local tips — is on your booking once it's approved." },
  { keys: ["task", "operations", "cleaning", "vendor", "whatsapp"], a: "In Operations, add a task, assign it to a team member or outside vendor, send a WhatsApp with one click, then mark it Confirmed and Done. Paid tasks become expenses. (Admin)" },
  { keys: ["status", "booking"], a: "Requested means your card is held while we confirm; Approved means it's confirmed and charged; Declined/Cancelled means the hold is released and nothing is charged." },
];

function fallbackAnswer(question: string): string {
  const q = question.toLowerCase();
  let best: { score: number; a: string } | null = null;
  for (const f of FALLBACK) {
    const score = f.keys.reduce((s, k) => s + (q.includes(k) ? 1 : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { score, a: f.a };
  }
  return best?.a || "I can help with bookings, payments, the security deposit, experiences and how to use the site. Could you rephrase your question, or message the host directly from your booking for anything specific?";
}

// ---- Ask ------------------------------------------------------------------

export async function askAssistant(opts: {
  mode: "admin" | "client";
  question: string;
  history?: ChatTurn[];
  context?: string; // live booking details, injected server-side
}): Promise<{ answer: string; grounded: boolean }> {
  const { mode, question, history = [], context } = opts;

  if (!process.env.ANTHROPIC_API_KEY) {
    return { answer: fallbackAnswer(question), grounded: false };
  }

  const kb = mode === "admin" ? ADMIN_KB : CLIENT_KB;
  const system = context ? `${kb}\n\nLIVE DETAILS FOR THIS PERSON:\n${context}` : kb;

  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 700,
      system,
      messages: [
        ...history.slice(-6).map((t) => ({ role: t.role, content: t.content })),
        { role: "user" as const, content: question },
      ],
    });
    const answer = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { answer: answer || fallbackAnswer(question), grounded: true };
  } catch {
    return { answer: fallbackAnswer(question), grounded: false };
  }
}
