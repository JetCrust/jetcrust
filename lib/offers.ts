import { prisma } from "./prisma";
import type { Quote } from "./pricing";

// Find an active private offer for this guest + property + exact dates.
export async function matchOffer(email: string | null | undefined, slug: string, checkIn: string, checkOut: string) {
  if (!email) return null;
  return prisma.privateOffer.findFirst({
    where: {
      email: email.toLowerCase().trim(),
      propertySlug: slug,
      status: "active",
      checkIn: new Date(checkIn + "T00:00:00Z"),
      checkOut: new Date(checkOut + "T00:00:00Z"),
    },
    orderBy: { createdAt: "desc" },
  });
}

// Override a quote's total with the matched private rate, shown as a clean
// "Private rate" line in the breakdown (never a coupon code at checkout).
export function applyOffer(q: Quote, priceCents: number): Quote {
  const offerEuros = priceCents / 100;
  const diff = Math.round(q.total - offerEuros);
  if (diff > 0) {
    const pct = q.stayTotal > 0 ? Math.round((diff / q.stayTotal) * 100) : 0;
    q.discountLines = [...(q.discountLines || []), { label: "Private rate", pct, amount: diff }];
    q.discountTotal = (q.discountTotal || 0) + diff;
  }
  q.total = offerEuros;
  q.amountCents = priceCents;
  q.avgNightly = q.nights > 0 ? Math.round(offerEuros / q.nights) : offerEuros;
  return q;
}
