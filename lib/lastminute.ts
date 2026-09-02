import { prisma } from "./prisma";
import type { Property } from "./properties";
import { nightsBetween } from "./pricing";

const DAY = 86400000;

// Is a given night already taken — by an imported/booking block OR an approved
// booking (manual OTA stays live only as bookings, with no block)? Mirrors the
// two sources the calendar treats as unavailable.
async function nightTaken(slug: string, day: Date): Promise<boolean> {
  const dayEnd = new Date(day.getTime() + DAY);
  const [block, booking] = await Promise.all([
    prisma.availabilityBlock.findFirst({ where: { propertySlug: slug, start: { lt: dayEnd }, end: { gt: day } } }),
    prisma.booking.findFirst({ where: { propertySlug: slug, status: "APPROVED", checkIn: { lt: dayEnd }, checkOut: { gt: day } } }),
  ]);
  return !!(block || booking);
}

// A stranded gap: a short open run (<= max_gap_nights) in the near-term window
// that is wedged between two already-taken nights, so nobody else can use it.
// Those nights are dead weight empty, so they earn the deeper "orphan" cut.
// Returns the deal for quote(), or null when it isn't a wedged gap.
export async function orphanDeal(
  p: Property,
  checkIn: string,
  checkOut: string,
  now = new Date(),
): Promise<{ pct: number; floorEur: number } | null> {
  const o = p.pricing.orphan;
  if (!o?.enabled || !(o.pct && o.pct > 0)) return null;

  const nights = nightsBetween(checkIn, checkOut);
  if (nights <= 0 || nights > (o.max_gap_nights || 2)) return null;

  const start = new Date(checkIn + "T00:00:00Z");
  const end = new Date(checkOut + "T00:00:00Z");
  const leadDays = Math.ceil((start.getTime() - now.getTime()) / DAY);
  if (leadDays < 0 || leadDays > (o.window_days || 45)) return null;

  // Both edges must be taken: the night before check-in, and the check-out night.
  const [leftTaken, rightTaken] = await Promise.all([
    nightTaken(p.slug, new Date(start.getTime() - DAY)),
    nightTaken(p.slug, end),
  ]);
  if (!leftTaken || !rightTaken) return null;

  return { pct: o.pct, floorEur: o.floor_eur || 0 };
}
