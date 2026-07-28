// Branded transactional email templates. Inline styles for email-client support.
// Voice matches the site; no em or en dashes.

type BookingData = {
  guestName: string;
  guestEmail: string;
  propertyName: string;
  location: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  amountCents: number;
  currency: string;
  bookingId: string;
  checkInTime?: string;
  checkOutTime?: string;
  depositCents?: number;
  balanceCents?: number;
  balanceDueAt?: Date | null;
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://jetcrust.com";

function fmt(d: Date) {
  return new Date(d).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}
function money(cents: number, currency: string) {
  return `${currency.toUpperCase() === "EUR" ? "€" : ""}${(cents / 100).toLocaleString("en-US")}`;
}
function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function layout(opts: { preheader: string; heading: string; accent: string; bodyHtml: string }) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#EFE8D9;font-family:Helvetica,Arial,sans-serif;color:#17160F;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#EFE8D9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FBFAF6;border:1px solid rgba(23,22,15,0.10);border-radius:14px;overflow:hidden;">
  <tr><td style="background:#253026;padding:26px 32px;text-align:center;">
    <div style="font-family:Georgia,'Times New Roman',serif;font-weight:600;letter-spacing:3px;color:#F6F1E7;font-size:22px;">JET CRUST</div>
    <div style="font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(246,241,231,0.7);margin-top:6px;">Curated Luxury Rentals</div>
  </td></tr>
  <tr><td style="padding:36px 32px 8px;">
    <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:${opts.accent};margin-bottom:12px;">${esc(opts.heading.toUpperCase())}</div>
    ${opts.bodyHtml}
  </td></tr>
  <tr><td style="padding:24px 32px 34px;border-top:1px solid rgba(23,22,15,0.08);">
    <div style="font-size:12px;color:#8C8676;line-height:1.7;">
      Jet Crust &middot; Bran &middot; Bucharest<br>
      <a href="tel:+40770111555" style="color:#8C8676;text-decoration:none;">+40 770 111 555</a> &middot;
      <a href="mailto:contact@jetcrust.com" style="color:#8C8676;text-decoration:none;">contact@jetcrust.com</a>
    </div>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function detailsTable(d: BookingData) {
  const row = (l: string, v: string) =>
    `<tr><td style="padding:8px 0;font-size:13px;color:#8C8676;">${l}</td><td style="padding:8px 0;font-size:14px;color:#17160F;text-align:right;">${v}</td></tr>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border-top:1px solid rgba(23,22,15,0.10);border-bottom:1px solid rgba(23,22,15,0.10);">
    ${row("Property", esc(d.propertyName))}
    ${row("Location", esc(d.location))}
    ${row("Check in", fmt(d.checkIn) + (d.checkInTime ? `, from ${d.checkInTime}` : ""))}
    ${row("Check out", fmt(d.checkOut) + (d.checkOutTime ? `, by ${d.checkOutTime}` : ""))}
    ${row("Guests", String(d.guests))}
    ${row("Total", money(d.amountCents, d.currency))}
  </table>`;
}

function h2(text: string) {
  return `<div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;line-height:1.15;color:#17160F;margin:0 0 14px;">${esc(text)}</div>`;
}
function p(text: string) {
  return `<p style="font-size:15px;line-height:1.65;color:#3B392E;margin:0 0 14px;">${text}</p>`;
}
function button(href: string, label: string) {
  return `<a href="${href}" style="display:inline-block;background:#B08D57;color:#17160F;text-decoration:none;font-size:13px;letter-spacing:1.5px;text-transform:uppercase;padding:14px 26px;border-radius:10px;margin-top:6px;">${esc(label)}</a>`;
}

export function bookingRequestedEmail(d: BookingData) {
  const first = d.guestName.split(" ")[0] || "there";
  return {
    subject: `We have your request for ${d.propertyName}`,
    html: layout({
      preheader: `Your card is held, not charged. We will confirm ${d.propertyName} personally.`,
      heading: "Request received",
      accent: "#B08D57",
      bodyHtml:
        h2(`Thank you, ${esc(first)}`) +
        p("We have received your booking request and placed a hold on your card. Nothing has been charged yet. We review each request personally and will confirm, usually within the day.") +
        detailsTable(d) +
        p("You can follow your request any time under My Bookings.") +
        button(`${SITE}/account`, "View My Bookings"),
    }),
  };
}

export function bookingApprovedEmail(d: BookingData) {
  const first = d.guestName.split(" ")[0] || "there";
  const split = (d.balanceCents || 0) > 0;
  const paymentLine = split
    ? p(
        `We have charged your deposit of <strong>${money(d.depositCents || 0, d.currency)}</strong>. The remaining ` +
          `<strong>${money(d.balanceCents || 0, d.currency)}</strong> will be charged on <strong>${d.balanceDueAt ? fmt(d.balanceDueAt) : "a date before arrival"}</strong> ` +
          `to the card on file. Your dates are held for you.`
      )
    : p("Your card has now been charged for the total below, and your dates are held for you.");
  return {
    subject: `Confirmed: your stay at ${d.propertyName}`,
    html: layout({
      preheader: `Your booking at ${d.propertyName} is confirmed. We look forward to hosting you.`,
      heading: "Booking confirmed",
      accent: "#253026",
      bodyHtml:
        h2(`It is confirmed, ${esc(first)}`) +
        p(`We are delighted to confirm your stay at ${esc(d.propertyName)}.`) +
        paymentLine +
        detailsTable(d) +
        p("We will be in touch before arrival with directions and everything you need. If there is anything that would make the stay yours, simply reply to this email.") +
        button(`${SITE}/account`, "View My Booking"),
    }),
  };
}

export function balanceChargedEmail(d: BookingData) {
  const first = d.guestName.split(" ")[0] || "there";
  return {
    subject: `Balance received for ${d.propertyName}`,
    html: layout({
      preheader: `The balance for your stay at ${d.propertyName} has been charged. See you soon.`,
      heading: "Balance received",
      accent: "#253026",
      bodyHtml:
        h2(`You are all set, ${esc(first)}`) +
        p(`We have charged the remaining balance of <strong>${money(d.balanceCents || 0, d.currency)}</strong> for your stay at ${esc(d.propertyName)}. Nothing further is due.`) +
        detailsTable(d) +
        p("We look forward to welcoming you. If anything changes, just reply to this email.") +
        button(`${SITE}/account`, "View My Booking"),
    }),
  };
}

export function bookingDeclinedEmail(d: BookingData) {
  const first = d.guestName.split(" ")[0] || "there";
  return {
    subject: `About your request for ${d.propertyName}`,
    html: layout({
      preheader: `We were unable to confirm these dates. The hold on your card has been released.`,
      heading: "Request update",
      accent: "#8C8676",
      bodyHtml:
        h2(`Thank you for your interest, ${esc(first)}`) +
        p(`Unfortunately we are not able to confirm ${esc(d.propertyName)} for the dates you requested. The hold on your card has been released in full and you have not been charged.`) +
        p("We would still love to host you. Reply to this email or reach us on WhatsApp and we will help you find dates or another home in the collection.") +
        button(`${SITE}/#collection`, "Explore the Collection"),
    }),
  };
}

export function guestChangeAdminEmail(d: BookingData, summary: string) {
  return {
    subject: `Booking updated: ${d.propertyName} (${d.guestName})`,
    html: layout({
      preheader: `${d.guestName} updated their booking for ${d.propertyName}.`,
      heading: "Booking updated",
      accent: "#B08D57",
      bodyHtml:
        h2("A guest updated their booking") +
        p(`<strong>${esc(d.guestName)}</strong> (${esc(d.guestEmail)}) made changes to their booking for ${esc(d.propertyName)}:`) +
        p(esc(summary).replace(/\n/g, "<br>")) +
        detailsTable(d) +
        button(`${SITE}/admin`, "Open Admin"),
    }),
  };
}

export function adminNewRequestEmail(d: BookingData) {
  return {
    subject: `New booking request: ${d.propertyName} (${money(d.amountCents, d.currency)})`,
    html: layout({
      preheader: `${d.guestName} requested ${d.propertyName}. Card authorized, awaiting your approval.`,
      heading: "New request",
      accent: "#B08D57",
      bodyHtml:
        h2("A new booking request") +
        p(`<strong>${esc(d.guestName)}</strong> (${esc(d.guestEmail)}) has requested a stay. The card is authorized and awaiting your approval.`) +
        detailsTable(d) +
        button(`${SITE}/admin`, "Review in Admin"),
    }),
  };
}

const DEPOSIT_LINE: Record<string, string> = {
  refund: "Your security deposit will be refunded in full. Please allow 7 to 10 days for it to clear.",
  partial: "A partial charge will be applied to your security deposit for the items noted below. The remainder is released.",
  claim: "A charge will be applied for the items noted below.",
  pending: "Your security deposit is being reviewed and we will be in touch shortly.",
};

export function checkoutReportEmail(d: {
  guestName: string;
  propertyName: string;
  checkOut: Date;
  items: { desc: string; amountCents: number }[];
  additionalCents: number;
  depositStatus: string;
  photos: number;
}) {
  const first = d.guestName.split(" ")[0] || "there";
  const itemsRows = d.items.length
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;border-top:1px solid rgba(23,22,15,0.10);border-bottom:1px solid rgba(23,22,15,0.10);">
        ${d.items.map((it) => `<tr><td style="padding:8px 0;font-size:14px;color:#17160F;">${esc(it.desc)}</td><td style="padding:8px 0;font-size:14px;color:#17160F;text-align:right;">${money(it.amountCents, "eur")}</td></tr>`).join("")}
        <tr><td style="padding:10px 0;font-size:14px;color:#17160F;font-weight:bold;border-top:1px solid rgba(23,22,15,0.10);">Additional charges</td><td style="padding:10px 0;font-size:14px;color:#17160F;text-align:right;font-weight:bold;border-top:1px solid rgba(23,22,15,0.10);">${money(d.additionalCents, "eur")}</td></tr>
      </table>`
    : p("No additional charges. Thank you for leaving the home in wonderful condition.");
  return {
    subject: `Your check-out summary, ${d.propertyName}`,
    html: layout({
      preheader: `Thank you for staying at ${d.propertyName}. Your signed check-out summary is enclosed.`,
      heading: "Check-out complete",
      accent: "#253026",
      bodyHtml:
        h2(`Thank you, ${esc(first)}`) +
        p(`We have completed the check-out for your stay at <strong>${esc(d.propertyName)}</strong> on ${fmt(d.checkOut)}. A condition report with ${d.photos} photo${d.photos === 1 ? "" : "s"} has been recorded and signed.`) +
        itemsRows +
        p(DEPOSIT_LINE[d.depositStatus] || DEPOSIT_LINE.pending) +
        p("It was a pleasure to host you. We would love to welcome you back.") +
        button(`${SITE}/account`, "View My Bookings"),
    }),
  };
}

export function newMessageEmail(d: { toGuest: boolean; guestName: string; propertyName: string; preview: string; bookingId: string }) {
  const first = d.guestName.split(" ")[0] || "there";
  const link = d.toGuest ? `${SITE}/account/bookings/${d.bookingId}` : `${SITE}/admin/bookings/${d.bookingId}`;
  return {
    subject: d.toGuest ? `A message about your stay at ${d.propertyName}` : `New guest message: ${d.propertyName}`,
    html: layout({
      preheader: d.preview,
      heading: "New message",
      accent: "#B08D57",
      bodyHtml:
        h2(d.toGuest ? `Hello ${esc(first)}` : "New guest message") +
        p(d.toGuest ? `You have a new message from your host about ${esc(d.propertyName)}:` : `<strong>${esc(d.guestName)}</strong> sent a message about ${esc(d.propertyName)}:`) +
        `<p style="font-size:15px;line-height:1.65;color:#3B392E;margin:0 0 16px;padding:12px 16px;background:#EFE8D9;border-radius:8px;">&ldquo;${esc(d.preview)}&rdquo;</p>` +
        button(link, d.toGuest ? "Read & reply" : "Open in Admin"),
    }),
  };
}

export type { BookingData };
