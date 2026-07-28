import { getProperty } from "./properties";
import type { BookingData } from "./emails";

type BookingRecord = {
  id: string;
  propertySlug: string;
  checkIn: Date;
  checkOut: Date;
  guests: number;
  amountCents: number;
  currency: string;
  depositCents?: number | null;
  balanceCents?: number;
  balanceDueAt?: Date | null;
};
type UserRecord = { name: string | null; email: string };

export async function toBookingData(b: BookingRecord, user: UserRecord): Promise<BookingData> {
  const p = await getProperty(b.propertySlug);
  return {
    guestName: user.name || "Guest",
    guestEmail: user.email,
    propertyName: p?.name || b.propertySlug,
    location: p?.location || "",
    checkIn: b.checkIn,
    checkOut: b.checkOut,
    guests: b.guests,
    amountCents: b.amountCents,
    currency: b.currency,
    bookingId: b.id,
    checkInTime: p?.hours?.check_in,
    checkOutTime: p?.hours?.check_out,
    depositCents: b.depositCents ?? undefined,
    balanceCents: b.balanceCents ?? 0,
    balanceDueAt: b.balanceDueAt ?? null,
  };
}
