import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { sendEmail } from "@/lib/email";
import { toBookingData } from "@/lib/booking-data";
import { bookingRequestedEmail, adminNewRequestEmail } from "@/lib/emails";

// Called by the client once the card is successfully authorized (held).
// Sends the guest their "request received" email and notifies the host.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const { id } = await params;

  const booking = await prisma.booking.findUnique({ where: { id }, include: { user: true } });
  if (!booking) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (booking.userId !== userId) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  // Only notify once the hold is really in place.
  if (booking.stripePaymentIntentId) {
    const pi = await stripe.paymentIntents.retrieve(booking.stripePaymentIntentId);
    if (pi.status !== "requires_capture") {
      return NextResponse.json({ pending: true });
    }
  }

  const data = await toBookingData(booking, booking.user);
  const guest = bookingRequestedEmail(data);
  await sendEmail({ to: booking.user.email, subject: guest.subject, html: guest.html });

  const adminTo = process.env.EMAIL_ADMIN;
  if (adminTo) {
    const notify = adminNewRequestEmail(data);
    await sendEmail({ to: adminTo, subject: notify.subject, html: notify.html });
  }

  return NextResponse.json({ ok: true });
}
