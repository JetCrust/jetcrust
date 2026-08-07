import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { stripe } from "@/lib/stripe";
import { parseExtras, type Extra } from "@/lib/accounting";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("add"), desc: z.string().min(1).max(200), amountCents: z.number().int().positive() }),
  z.object({ action: z.literal("settle"), extraId: z.string(), via: z.enum(["card", "cash", "deposit"]) }),
  z.object({ action: z.literal("remove"), extraId: z.string() }),
]);

// Admin extras ledger: add a line item, settle it (charge the saved card, or
// record it as cash / covered by the security deposit), or remove it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b) return NextResponse.json({ error: "Booking not found." }, { status: 404 });
  const extras = parseExtras(b.extras);
  const d = parsed.data;

  if (d.action === "add") {
    const extra: Extra = {
      id: crypto.randomUUID(),
      desc: d.desc.trim(),
      amountCents: d.amountCents,
      at: new Date().toISOString(),
      settled: false,
    };
    extras.push(extra);
    await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extras) } });
    return NextResponse.json({ ok: true, extra });
  }

  if (d.action === "remove") {
    const next = extras.filter((e) => e.id !== d.extraId);
    await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(next) } });
    return NextResponse.json({ ok: true });
  }

  // settle
  const extra = extras.find((e) => e.id === d.extraId);
  if (!extra) return NextResponse.json({ error: "Line item not found." }, { status: 404 });
  if (extra.settled) return NextResponse.json({ error: "Already settled." }, { status: 400 });

  if (d.via === "card") {
    if (!b.stripeCustomerId || !b.stripePaymentMethodId) {
      return NextResponse.json({ error: "No saved card on file to charge." }, { status: 400 });
    }
    try {
      const pi = await stripe.paymentIntents.create({
        amount: extra.amountCents,
        currency: b.currency,
        customer: b.stripeCustomerId,
        payment_method: b.stripePaymentMethodId,
        off_session: true,
        confirm: true,
        payment_method_types: ["card"],
        metadata: { bookingId: b.id, kind: "extra", extraId: extra.id },
        description: `Jet Crust extra: ${extra.desc} · ${b.propertySlug}`,
      });
      if (pi.status !== "succeeded") {
        return NextResponse.json({ error: `Charge ${pi.status}. The card may need action.` }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  }

  extra.settled = true;
  extra.settledVia = d.via;
  extra.settledAt = new Date().toISOString();
  await prisma.booking.update({ where: { id }, data: { extras: JSON.stringify(extras) } });
  return NextResponse.json({ ok: true });
}
