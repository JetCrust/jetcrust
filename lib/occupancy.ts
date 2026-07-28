import { prisma } from "./prisma";
import type { Property } from "./properties";

// Fraction (0..1) of nights already booked in a window around the requested stay.
// Drives occupancy-based dynamic pricing: the busier the period, the higher the price.
export async function occupancyRatio(p: Property, checkIn: string, checkOut: string): Promise<number> {
  const windowDays = p.pricing.dynamic?.occupancy?.window_days || 30;
  const center = new Date(checkIn + "T00:00:00Z");
  const half = Math.floor(windowDays / 2) * 86400000;
  const winStart = new Date(center.getTime() - half);
  const winEnd = new Date(center.getTime() + half);

  const blocks = await prisma.availabilityBlock.findMany({
    where: { propertySlug: p.slug, start: { lt: winEnd }, end: { gt: winStart } },
  });

  // Count distinct booked days within the window.
  const booked = new Set<string>();
  for (const b of blocks) {
    let d = new Date(Math.max(b.start.getTime(), winStart.getTime()));
    const end = new Date(Math.min(b.end.getTime(), winEnd.getTime()));
    while (d < end) {
      booked.add(d.toISOString().slice(0, 10));
      d = new Date(d.getTime() + 86400000);
    }
  }
  return Math.min(1, booked.size / windowDays);
}
