import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { getProperty } from "@/lib/properties";
import { quote } from "@/lib/pricing";
import { occupancyRatio } from "@/lib/occupancy";
import { depositPlan } from "@/lib/policy";

const schema = z.object({
  slug: z.string(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  guests: z.number().int().min(1).max(64),
  addons: z.array(z.string()).default([]),
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
  const { slug, checkIn, checkOut, guests, addons, note } = parsed.data;

  const property = await getProperty(slug);
  if (!property || property.status !== "live") {
    return NextResponse.json({ error: "That property is not available." }, { status: 404 });
  }
  if (guests > property.capacity.sleeps) {
    return NextResponse.json({ error: `This home sleeps up to ${property.capacity.sleeps}.` }, { status: 400 });
  }

  const ratio = await occupancyRatio(property, checkIn, checkOut);
  // Add-ons are priced into the total, so the hold matches what the guest saw.
  const q = quote(property, checkIn, checkOut, ratio, addons);
  if (!q.valid) {
    return NextResponse.json({ error: `Please choose at least ${q.minNights} night(s), with check-out after check-in.` }, { status: 400 });
  }

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
    return NextResponse.json({ error: "Payments are not configured yet. Please contact us to complete your booking." }, { status: 500 });
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
        addons: JSON.stringify(addons),
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

    return NextResponse.json({
      bookingId: booking.id,
      clientSecret: intent.client_secret,
      depositCents: plan.depositCents,
      balanceCents: plan.balanceCents,
      balanceDueAt: plan.balanceDueAt,
      split: plan.split,
    });
  } catch (e) {
    // Surface a real reason instead of a blank 500, and log the detail server-side.
    console.error("Booking creation failed:", e);
    const detail = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Could not create the booking request. (${detail})` }, { status: 500 });
  }
}
