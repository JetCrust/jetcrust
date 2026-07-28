import { prisma } from "./prisma";
import { parseExtras, extrasIncomeCents } from "./accounting";

const DAY = 86400000;
const clampNights = (aStart: Date, aEnd: Date, wStart: Date, wEnd: Date) => {
  const s = Math.max(aStart.getTime(), wStart.getTime());
  const e = Math.min(aEnd.getTime(), wEnd.getTime());
  return Math.max(0, Math.round((e - s) / DAY));
};

export type PropPerf = {
  slug: string;
  name: string;
  bookings: number;          // bookings starting in range
  bookedNights: number;
  availableNights: number;
  occupancy: number;         // 0..1
  roomRevenueCents: number;  // prorated stay revenue in range
  adrCents: number;          // room revenue / booked nights
  revparCents: number;       // room revenue / available nights
  avgStayNights: number;
};

export type Performance = {
  start: string; end: string;
  totals: {
    bookings: number;
    bookedNights: number;
    availableNights: number;
    occupancy: number;
    roomRevenueCents: number;
    totalRevenueCents: number;   // room + extras + deposit captures
    adrCents: number;
    revparCents: number;
    avgStayNights: number;
    cancellationRate: number;    // cancelled+declined / all decided, by check-in in range
  };
  byProperty: PropPerf[];
  monthlyRevenue: { month: string; thisYear: number; lastYear: number }[]; // cents, 12 months
  sources: { label: string; bookings: number }[];
};

// Room revenue for a booking, prorated to the nights that fall in the window.
function proratedRoom(amountCents: number, aStart: Date, aEnd: Date, wStart: Date, wEnd: Date) {
  const totalNights = Math.max(1, Math.round((aEnd.getTime() - aStart.getTime()) / DAY));
  const inRange = clampNights(aStart, aEnd, wStart, wEnd);
  return Math.round((amountCents / totalNights) * inRange);
}

export async function buildPerformance(start: Date, end: Date, slugs?: string[] | null): Promise<Performance> {
  const nights = Math.max(1, Math.round((end.getTime() - start.getTime()) / DAY));
  const propWhere = slugs ? { slug: { in: slugs } } : {};
  const slugFilter = slugs ? { propertySlug: { in: slugs } } : {};
  const props = await prisma.property.findMany({ where: propWhere, select: { slug: true, name: true }, orderBy: { order: "asc" } });

  // Approved bookings overlapping the range (for occupancy/revenue) and all
  // decided bookings starting in range (for cancellation rate + counts).
  const overlapping = await prisma.booking.findMany({
    where: { status: "APPROVED", checkIn: { lt: end }, checkOut: { gt: start }, ...slugFilter },
  });
  const startingInRange = await prisma.booking.findMany({
    where: { checkIn: { gte: start, lte: end }, ...slugFilter },
  });

  const perf = new Map<string, PropPerf>();
  for (const p of props) perf.set(p.slug, {
    slug: p.slug, name: p.name, bookings: 0, bookedNights: 0, availableNights: nights,
    occupancy: 0, roomRevenueCents: 0, adrCents: 0, revparCents: 0, avgStayNights: 0,
  });

  let totalRoom = 0, totalExtras = 0, totalDeposit = 0, totalBookedNights = 0;
  for (const b of overlapping) {
    const g = perf.get(b.propertySlug);
    const bn = clampNights(b.checkIn, b.checkOut, start, end);
    const room = proratedRoom(b.amountCents, b.checkIn, b.checkOut, start, end);
    totalBookedNights += bn; totalRoom += room;
    totalExtras += extrasIncomeCents(parseExtras(b.extras));
    totalDeposit += b.securityCapturedCents;
    if (g) { g.bookedNights += bn; g.roomRevenueCents += room; }
  }

  const stayLengths = new Map<string, number[]>();
  for (const b of startingInRange) {
    if (b.status === "APPROVED") {
      const g = perf.get(b.propertySlug);
      const len = Math.max(1, Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / DAY));
      if (g) g.bookings += 1;
      if (!stayLengths.has(b.propertySlug)) stayLengths.set(b.propertySlug, []);
      stayLengths.get(b.propertySlug)!.push(len);
    }
  }

  for (const g of perf.values()) {
    g.occupancy = g.availableNights > 0 ? g.bookedNights / g.availableNights : 0;
    g.adrCents = g.bookedNights > 0 ? Math.round(g.roomRevenueCents / g.bookedNights) : 0;
    g.revparCents = g.availableNights > 0 ? Math.round(g.roomRevenueCents / g.availableNights) : 0;
    const ls = stayLengths.get(g.slug) || [];
    g.avgStayNights = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : 0;
  }

  const decided = startingInRange.filter((b) => ["APPROVED", "DECLINED", "CANCELLED"].includes(b.status));
  const lost = decided.filter((b) => b.status !== "APPROVED").length;
  const approvedInRange = startingInRange.filter((b) => b.status === "APPROVED");
  const allStayLengths = approvedInRange.map((b) => Math.max(1, Math.round((b.checkOut.getTime() - b.checkIn.getTime()) / DAY)));
  const availableTotal = nights * props.length;

  // Booking source — direct today; OTA/manual tagged via note.
  const sources = [
    { label: "Direct", bookings: approvedInRange.filter((b) => !(b.note || "").toLowerCase().includes("manual")).length },
    { label: "Manual / OTA", bookings: approvedInRange.filter((b) => (b.note || "").toLowerCase().includes("manual")).length },
  ];

  // Monthly revenue for the range's year vs the year before (check-in month).
  const year = start.getUTCFullYear();
  const monthly = await monthlyRevenue(year);

  return {
    start: start.toISOString(), end: end.toISOString(),
    totals: {
      bookings: approvedInRange.length,
      bookedNights: totalBookedNights,
      availableNights: availableTotal,
      occupancy: availableTotal > 0 ? totalBookedNights / availableTotal : 0,
      roomRevenueCents: totalRoom,
      totalRevenueCents: totalRoom + totalExtras + totalDeposit,
      adrCents: totalBookedNights > 0 ? Math.round(totalRoom / totalBookedNights) : 0,
      revparCents: availableTotal > 0 ? Math.round(totalRoom / availableTotal) : 0,
      avgStayNights: allStayLengths.length ? allStayLengths.reduce((a, b) => a + b, 0) / allStayLengths.length : 0,
      cancellationRate: decided.length ? lost / decided.length : 0,
    },
    byProperty: [...perf.values()].sort((a, b) => b.roomRevenueCents - a.roomRevenueCents),
    monthlyRevenue: monthly,
    sources,
  };
}

// Room revenue per month for `year` and `year-1`, by check-in month.
async function monthlyRevenue(year: number) {
  const from = new Date(Date.UTC(year - 1, 0, 1));
  const to = new Date(Date.UTC(year + 1, 0, 1));
  const bs = await prisma.booking.findMany({ where: { status: "APPROVED", checkIn: { gte: from, lt: to } } });
  const buckets: Record<number, number[]> = { [year]: new Array(12).fill(0), [year - 1]: new Array(12).fill(0) };
  for (const b of bs) {
    const y = b.checkIn.getUTCFullYear();
    if (buckets[y]) buckets[y][b.checkIn.getUTCMonth()] += b.amountCents;
  }
  const names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return names.map((m, i) => ({ month: m, thisYear: buckets[year][i], lastYear: buckets[year - 1][i] }));
}
