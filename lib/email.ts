import { Resend } from "resend";
import fs from "node:fs";
import path from "node:path";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// Sent from stay@jetcrust.com (Resend); replies go to the real Zoho inbox.
const FROM = process.env.EMAIL_FROM || "Jet Crust <stay@jetcrust.com>";
const REPLY_TO = process.env.EMAIL_REPLY_TO || "contact@jetcrust.com";

/**
 * Send an email. In production (RESEND_API_KEY set) it sends via Resend.
 * In development it writes the rendered HTML to .dev-emails/ and logs it,
 * so the whole flow works before an email account exists.
 */
export async function sendEmail(opts: { to: string; subject: string; html: string }) {
  if (!resend) {
    try {
      const dir = path.join(process.cwd(), ".dev-emails");
      fs.mkdirSync(dir, { recursive: true });
      const safe = opts.subject.replace(/[^a-z0-9]+/gi, "-").slice(0, 60).toLowerCase();
      const file = path.join(dir, `${Date.now()}-${safe}.html`);
      fs.writeFileSync(file, `<!-- To: ${opts.to} | Subject: ${opts.subject} -->\n${opts.html}`);
      console.log(`[email:dev] wrote ${file}  (to: ${opts.to} | ${opts.subject})`);
    } catch (e) {
      console.log("[email:dev] (could not write outbox)", opts.to, opts.subject, e);
    }
    return { dev: true };
  }
  return resend.emails.send({ from: FROM, to: opts.to, subject: opts.subject, html: opts.html, replyTo: REPLY_TO });
}
