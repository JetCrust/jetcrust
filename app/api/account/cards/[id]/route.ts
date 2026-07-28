import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";

async function userAndCustomer() {
  const session = await auth();
  const uid = (session?.user as { id?: string } | undefined)?.id ?? null;
  if (!uid) return { uid: null, customerId: null };
  const user = await prisma.user.findUnique({ where: { id: uid } });
  return { uid, customerId: user?.stripeCustomerId ?? null };
}

// Remove a saved card. Verifies it belongs to this guest's customer first.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { uid, customerId } = await userAndCustomer();
  if (!uid) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;

  const pm = await stripe.paymentMethods.retrieve(id).catch(() => null);
  const owner = pm && (typeof pm.customer === "string" ? pm.customer : pm.customer?.id);
  if (!pm || !customerId || owner !== customerId) {
    return NextResponse.json({ error: "Card not found." }, { status: 404 });
  }
  await stripe.paymentMethods.detach(id);
  return NextResponse.json({ ok: true });
}

// Set a saved card as the default.
export async function PATCH(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { uid, customerId } = await userAndCustomer();
  if (!uid || !customerId) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;

  const pm = await stripe.paymentMethods.retrieve(id).catch(() => null);
  const owner = pm && (typeof pm.customer === "string" ? pm.customer : pm.customer?.id);
  if (!pm || owner !== customerId) return NextResponse.json({ error: "Card not found." }, { status: 404 });

  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: id } });
  return NextResponse.json({ ok: true });
}
