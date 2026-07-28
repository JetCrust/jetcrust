import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { stripe } from "@/lib/stripe";
import { ensureStripeCustomer } from "@/lib/customer";

async function userId() {
  const session = await auth();
  return (session?.user as { id?: string } | undefined)?.id ?? null;
}

// List the guest's saved cards.
export async function GET() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const customerId = await ensureStripeCustomer(uid);

  const [methods, customer] = await Promise.all([
    stripe.paymentMethods.list({ customer: customerId, type: "card" }),
    stripe.customers.retrieve(customerId),
  ]);
  const defaultId =
    typeof customer !== "string" && !customer.deleted
      ? (customer.invoice_settings?.default_payment_method as string | null)
      : null;

  const cards = methods.data.map((m) => ({
    id: m.id,
    brand: m.card?.brand ?? "card",
    last4: m.card?.last4 ?? "----",
    expMonth: m.card?.exp_month ?? 0,
    expYear: m.card?.exp_year ?? 0,
    isDefault: m.id === defaultId,
  }));
  return NextResponse.json({ cards });
}

// Start saving a new card: return a SetupIntent client secret for the card form.
export async function POST() {
  const uid = await userId();
  if (!uid) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const customerId = await ensureStripeCustomer(uid);

  const intent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
    usage: "off_session",
  });
  return NextResponse.json({ clientSecret: intent.client_secret });
}
