import { prisma } from "./prisma";

const DAY = 86400000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

// Booked nights (YYYY-MM-DD) for a property over the next ~12 months: OTA imports
// and manual holds (AvailabilityBlock) plus approved direct bookings. A booked
// night is any date in [start, checkout); the checkout day itself stays open so
// a back-to-back arrival is possible.
export async function blockedDates(slug: string): Promise<string[]> {
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const horizon = new Date(today.getTime() + 400 * DAY);
  const [blocks, bookings] = await Promise.all([
    prisma.availabilityBlock.findMany({ where: { propertySlug: slug, end: { gt: today }, start: { lt: horizon } }, select: { start: true, end: true } }),
    prisma.booking.findMany({ where: { propertySlug: slug, status: "APPROVED", checkOut: { gt: today } }, select: { checkIn: true, checkOut: true } }),
  ]);
  const set = new Set<string>();
  const add = (start: Date, end: Date) => {
    let d = new Date(Math.max(start.getTime(), today.getTime()));
    d = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const e = new Date(end);
    while (d < e) { set.add(iso(d)); d = new Date(d.getTime() + DAY); }
  };
  for (const b of blocks) add(b.start, b.end);
  for (const b of bookings) add(b.checkIn, b.checkOut);
  return [...set];
}
