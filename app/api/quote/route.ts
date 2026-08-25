import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getProperty } from "@/lib/properties";
import { quote } from "@/lib/pricing";
import { occupancyRatio } from "@/lib/occupancy";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { matchOffer, applyOffer } from "@/lib/offers";

// Public price quote so guests can see availability + price before signing in.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  // Selected add-ons (value or value:qty) so the live price reflects them as the
  // guest ticks boxes and sets quantities.
  const addons: Record<string, number> = {};
  for (const part of (searchParams.get("addons") || "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [value, qty] = part.split(":");
    if (value) addons[value] = Math.max(1, Math.round(Number(qty) || 1));
  }

  const p = await getProperty(slug);
  if (!p) return NextResponse.json({ error: "Unknown property." }, { status: 404 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return NextResponse.json({ error: "Pick your dates." }, { status: 400 });
  }

  const ratio = await occupancyRatio(p, checkIn, checkOut);
  const q = quote(p, checkIn, checkOut, ratio, addons, new Date());

  // A signed-in guest with a private rate for these exact dates sees it applied.
  if (q.valid) {
    const session = await auth().catch(() => null);
    const email = (session?.user as { email?: string } | undefined)?.email;
    const offer = await matchOffer(email, slug, checkIn, checkOut);
    if (offer) applyOffer(q, offer.priceCents);
  }
  // Record the date interest (fire-and-forget) for demand analytics, unless this
  // is a team member who has opted their own visits out (see /optout).
  const optedOut = (await cookies()).get("jc_noanalytics")?.value === "1";
  if (q.valid && !optedOut) {
    prisma.analyticsEvent.create({
      data: { type: "quote", slug, checkIn: new Date(checkIn + "T00:00:00Z"), checkOut: new Date(checkOut + "T00:00:00Z") },
    }).catch(() => {});
  }
  return NextResponse.json(q);
}
