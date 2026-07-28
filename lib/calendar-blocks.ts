import { prisma } from "./prisma";

// A confirmed booking owns exactly one availability block, tagged in `note` so
// we can find and move it when the booking's dates change. Keep this the single
// place that writes booking-owned blocks.
export const bookingBlockNote = (bookingId: string) => `Booking ${bookingId}`;

export async function upsertBookingBlock(bookingId: string, propertySlug: string, start: Date, end: Date) {
  const note = bookingBlockNote(bookingId);
  const existing = await prisma.availabilityBlock.findFirst({ where: { note, source: "BOOKING" } });
  if (existing) {
    await prisma.availabilityBlock.update({ where: { id: existing.id }, data: { propertySlug, start, end } });
  } else {
    await prisma.availabilityBlock.create({ data: { propertySlug, start, end, source: "BOOKING", note } });
  }
}

export async function removeBookingBlock(bookingId: string) {
  await prisma.availabilityBlock.deleteMany({ where: { note: bookingBlockNote(bookingId), source: "BOOKING" } });
}

// Do the requested dates overlap any OTHER block for this property? Used to warn
// before a manual booking or a move lands on top of an existing stay/block.
export async function overlapsExisting(propertySlug: string, start: Date, end: Date, ignoreBookingId?: string) {
  const clash = await prisma.availabilityBlock.findMany({
    where: { propertySlug, start: { lt: end }, end: { gt: start } },
  });
  const ignoreNote = ignoreBookingId ? bookingBlockNote(ignoreBookingId) : null;
  return clash.filter((b) => b.note !== ignoreNote);
}
