import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Daily cron: email the team the leads whose follow-up date has arrived, so no
// prospect goes cold. Open leads only (not Won/Lost).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const now = new Date();
  const endToday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59));
  const due = await prisma.lead.findMany({
    where: { followUpAt: { not: null, lte: endToday }, status: { notIn: ["WON", "LOST"] } },
    orderBy: { followUpAt: "asc" },
  });

  if (due.length) {
    const to = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM;
    if (to) {
      const rows = due.map((l) =>
        `<li style="margin:6px 0;"><strong>${esc(l.name)}</strong> · ${l.status.toLowerCase()}` +
        `${l.phone ? ` · ${esc(l.phone)}` : ""}${l.email ? ` · ${esc(l.email)}` : ""}` +
        `${l.followUpAt ? ` · due ${l.followUpAt.toLocaleDateString("en-GB")}` : ""}</li>`
      ).join("");
      await sendEmail({
        to,
        subject: `${due.length} lead${due.length === 1 ? "" : "s"} to follow up`,
        html: `<p>These prospects are due for a follow-up today:</p><ul>${rows}</ul><p>Open them in the console under <strong>Leads &amp; CRM</strong>.</p>`,
      }).catch(() => {});
    }
  }
  return NextResponse.json({ ok: true, due: due.length });
}
