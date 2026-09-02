import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getProperty } from "@/lib/properties";
import { quote } from "@/lib/pricing";
import { occupancyRatio } from "@/lib/occupancy";
import { orphanDeal } from "@/lib/lastminute";
import { depositPlan } from "@/lib/policy";
import { matchOffer, applyOffer } from "@/lib/offers";
import { sendEmail } from "@/lib/email";

// Safety net: if the payment step can't complete (misconfigured keys, a Stripe
// outage, a card problem), don't dead-end the guest — capture their request as a
// lead and alert the team so the booking is taken by hand.
async function captureBookingLead(opts: { userId: string; slug: string; propertyName: string; checkIn: string; checkOut: string; guests: number; note?: string }) {
  try {
    const user = await prisma.user.findUnique({ where: { id: opts.userId } });
    const email = user?.email || undefined;
    const ci = new Date(opts.checkIn + "T00:00:00Z");
    const co = new Date(opts.checkOut + "T00:00:00Z");
    const existing = email ? await prisma.lead.findFirst({ where: { email, propertySlug: opts.slug, checkIn: ci } }) : null;
    if (!existing) {
      await prisma.lead.create({
        data: {
          name: user?.name || email?.split("@")[0] || "Guest",
          email: email || null, phone: user?.phone || null,
          propertySlug: opts.slug, source: "WEB", status: "NEW",
          message: `Tried to book online but the payment step failed — follow up to take the booking by hand.${opts.note ? ` Note: ${opts.note}` : ""}`,
          checkIn: ci, checkOut: co, guests: opts.guests, userId: opts.userId,
        },
      });
    }
    const to = process.env.EMAIL_ADMIN || process.env.EMAIL_FROM;
    if (to) {
      await sendEmail({
        to,
        subject: `Booking needs manual follow-up: ${opts.propertyName}`,
        html: `<p><strong>${user?.name || email || "A guest"}</strong> tried to book <strong>${opts.propertyName}</strong> (${opts.checkIn} to ${opts.checkOut}, ${opts.guests} guests) but the payment step failed.</p>` +
          `<p>${email ? `Email: ${email}<br>` : ""}${user?.phone ? `Phone: ${user.phone}` : ""}</p>` +
          `<p>Reach out and take the booking manually. It's saved under <strong>Leads &amp; CRM</strong>.</p>`,
      }).catch(() => {});
    }
  } catch { /* best-effort — never throw from the safety net */ }
}

const CAPTURED = "We have received your request. Our team will confirm your dates with you personally, shortly.";

const schema = z.object({
  slug: z.string(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(64),
  // Add-ons carry a quantity now (sessions/hours/etc.); still accept a bare
  // string list for older clients.
  addons: z.array(z.union([z.string(), z.object({ value: z.string(), qty: z.number().int().min(1).max(64) })])).default([]),
  note: z.string().max(2000).optional(),
  acceptContract: z.literal(true),
});

// Create a booking REQUEST: authorize (hold) the card, log the contract acceptance
// with IP + timestamp, and leave it pending the host's approval (which captures).
export async function POST(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return NextResponse.json({ error: "Please sign in to request a booking." }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Please complete the dates, guests and accept the contract." }, { status: 400 });
  }
  const { slug, checkIn, checkOut, guests, note } = parsed.data;
  // Normalise add-ons to {value, qty} and to a value→qty map for pricing.
  const addonSel: { value: string; qty: number }[] = parsed.data.addons.map((a) => (typeof a === "string" ? { value: a, qty: 1 } : a));
  const addonMap: Record<string, number> = {};
  for (const a of addonSel) addonMap[a.value] = a.qty;

  const property = await getProperty(slug);
  if (!property || property.status !== "live") {
    return NextResponse.json({ error: "That property is not available." }, { status: 404 });
  }
  if (guests > property.capacity.sleeps) {
    return NextResponse.json({ error: `This home sleeps up to ${property.capacity.sleeps}.` }, { status: 400 });
  }

  const now = new Date();
  const ratio = await occupancyRatio(property, checkIn, checkOut);
  const deal = await orphanDeal(property, checkIn, checkOut, now);
  // Add-ons are priced into the total, so the hold matches what the guest saw.
  const q = quote(property, checkIn, checkOut, ratio, addonMap, now, deal || undefined);
  if (!q.valid) {
    return NextResponse.json({ error: `Please choose at least ${q.minNights} night(s), with check-out after check-in.` }, { status: 400 });
  }

  // Private rate for this guest + these exact dates (e.g. matching an OTA price).
  const offerEmail = (session?.user as { email?: string } | undefined)?.email;
  const offer = await matchOffer(offerEmail, slug, checkIn, checkOut);
  if (offer) applyOffer(q, offer.priceCents);

  // Availability: reject if the dates overlap an existing block or approved booking.
  const overlap = await prisma.availabilityBlock.findFirst({
    where: {
      propertySlug: slug,
      start: { lt: new Date(checkOut) },
      end: { gt: new Date(checkIn) },
    },
  });
  if (overlap) {
    return NextResponse.json({ error: "Those dates are no longer available." }, { status: 409 });
  }

  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    hdrs.get("x-real-ip") ||
    "unknown";
  const userAgent = hdrs.get("user-agent") || "unknown";

  // Hold reflects the property's default charge-now percentage; the host can
  // still adjust the amount when approving.
  const plan = depositPlan(
    q.amountCents,
    new Date(checkIn),
    new Date(),
    Number(property.pricing.charge_now_pct) || undefined,
    Number(property.pricing.balance_days_before) || undefined,
  );

  if (!process.env.STRIPE_SECRET_KEY) {
    await captureBookingLead({ userId, slug, propertyName: property.name, checkIn, checkOut, guests, note });
    return NextResponse.json({ captured: true, message: CAPTURED }, { status: 200 });
  }

  try {
    // A Stripe customer so we can charge the balance later, off-session.
    const user = await prisma.user.findUnique({ where: { id: userId } });
    const customer = await stripe.customers.create({
      email: user?.email,
      name: user?.name ?? undefined,
      metadata: { userId },
    });

    // Authorize (hold) the deposit now; capture happens on host approval. Card saved for the balance.
    // Card-only: no Satispay / ACH / wire, and no Stripe Link "create an account" prompt.
    const intent = await stripe.paymentIntents.create({
      amount: plan.depositCents,
      currency: q.currency,
      capture_method: "manual",
      customer: customer.id,
      setup_future_usage: "off_session",
      payment_method_types: ["card"],
      metadata: { propertySlug: slug, userId, kind: "deposit" },
      description: `Jet Crust booking: ${property.name} ${checkIn} to ${checkOut}`,
    });

    const booking = await prisma.booking.create({
      data: {
        propertySlug: slug,
        userId,
        checkIn: new Date(checkIn),
        checkOut: new Date(checkOut),
        guests,
        addons: JSON.stringify(addonSel),
        // Snapshot of exactly how the price was built, so the guest and the host
        // always see what was quoted, even if rates change later.
        breakdown: JSON.stringify({
          nights: q.nights,
          rateLines: q.rateLines,
          stayTotal: q.stayTotal,
          addonLines: q.addonLines,
          addonsTotal: q.addonsTotal,
          total: q.total,
          avgNightly: q.avgNightly,
        }),
        amountCents: q.amountCents,
        currency: q.currency,
        depositCents: plan.depositCents,
        balanceCents: plan.balanceCents,
        balanceDueAt: plan.balanceDueAt,
        stripeCustomerId: customer.id,
        stripePaymentIntentId: intent.id,
        note: note ?? null,
        acceptance: {
          create: {
            userId,
            contractVersion: process.env.CONTRACT_VERSION || "v1",
            ipAddress: ip,
            userAgent,
          },
        },
      },
    });

    // A private rate is one-time — mark it used now that the booking exists.
    if (offer) {
      await prisma.privateOffer.update({ where: { id: offer.id }, data: { status: "used", usedAt: new Date(), usedBookingId: booking.id } }).catch(() => {});
    }

    return NextResponse.json({
      bookingId: booking.id,
      clientSecret: intent.client_secret,
      depositCents: plan.depositCents,
      balanceCents: plan.balanceCents,
      balanceDueAt: plan.balanceDueAt,
      split: plan.split,
    });
  } catch (e) {
    // Log the real reason for us, but don't dead-end the guest: capture the
    // request as a lead and confirm we'll follow up by hand.
    console.error("Booking creation failed:", e);
    await captureBookingLead({ userId, slug, propertyName: property.name, checkIn, checkOut, guests, note });
    return NextResponse.json({ captured: true, message: CAPTURED }, { status: 200 });
  }
}
