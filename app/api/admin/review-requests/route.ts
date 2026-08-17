import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { sendEmail } from "@/lib/email";
import { bookingReviewRequestEmail } from "@/lib/emails";

const DAY = 86400000;

// Scheduled (Vercel Cron): a day or two after checkout, ask guests who haven't
// reviewed yet to leave one. One email per booking (reviewRequestedAt guards it).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  const now = Date.now();
  const bookings = await prisma.booking.findMany({
    where: {
      status: "APPROVED",
      checkOut: { gte: new Date(now - 5 * DAY), lte: new Date(now - 1 * DAY) },
      reviewRating: null,
      reviewRequestedAt: null,
    },
    include: { user: true },
  });
  let sent = 0;
  for (const b of bookings) {
    if (!b.user?.email) continue;
    const prop = await getProperty(b.propertySlug);
    const mail = bookingReviewRequestEmail({
      guestName: b.user.name || b.user.email,
      propertyName: prop?.name || b.propertySlug,
      bookingId: b.id,
    });
    await sendEmail({ to: b.user.email, subject: mail.subject, html: mail.html }).catch(() => {});
    await prisma.booking.update({ where: { id: b.id }, data: { reviewRequestedAt: new Date() } });
    sent += 1;
  }
  return NextResponse.json({ ok: true, sent });
}
