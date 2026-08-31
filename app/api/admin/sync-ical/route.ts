import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { parseIcs, channelName, reservationMeta } from "@/lib/ical";

// A single placeholder guest account that all OTA reservations attach to (iCal
// never carries the guest's real email). The real name/code lives on the booking.
const OTA_EMAIL = "ota-guest@jetcrust.internal";
async function otaUserId(): Promise<string> {
  const u = await prisma.user.upsert({
    where: { email: OTA_EMAIL },
    update: {},
    create: { email: OTA_EMAIL, name: "OTA guest", role: "GUEST", passwordHash: "" },
  });
  return u.id;
}

// Pull external iCal feeds (Airbnb, Booking.com, VRBO, concierge) listed in each
// property's data file (ical_urls). Refreshes the imported AvailabilityBlocks AND
// upserts an OTA booking per reservation, so those stays appear under Bookings and
// support check-in/check-out.
async function runSync() {
  const results: Record<string, { imported: number; feeds: number; errors: string[]; reservations: number }> = {};
  const uid = await otaUserId();
  for (const property of await getProperties()) {
    const urls = (property.ical_urls as string[] | undefined) || [];
    const summary = { imported: 0, feeds: urls.length, errors: [] as string[], reservations: 0 };
    const rows: { propertySlug: string; start: Date; end: Date; source: "ICAL"; note: string; meta: string | null }[] = [];
    const feedKeys = new Set<string>();
    let anyFeedOk = false;
    for (const url of urls) {
      const channel = channelName(url);
      try {
        const res = await fetch(url, { headers: { "User-Agent": "JetCrust/1.0" } });
        if (!res.ok) { summary.errors.push(`${channel}: HTTP ${res.status}`); continue; }
        anyFeedOk = true;
        for (const e of parseIcs(await res.text())) {
          const m = reservationMeta(e);
          // Always block the calendar for every event…
          rows.push({
            propertySlug: property.slug, start: e.start, end: e.end, source: "ICAL",
            note: channel, meta: JSON.stringify({ channel, ...m }),
          });
          // …but only REAL reservations (a deep-link, confirmation code, or guest
          // name) become bookings. Owner-blocks and "Not available" markers don't.
          const isReservation = !!(m.link || m.code || m.summary);
          if (!isReservation) continue;
          // Stable id per reservation so it dedupes across syncs.
          const key = `${channel}:${property.slug}:${e.uid || `${e.start.toISOString().slice(0, 10)}_${e.end.toISOString().slice(0, 10)}`}`;
          feedKeys.add(key);
          const guestName = (m.summary && m.summary.trim()) || `${channel} reservation`;
          await prisma.booking.upsert({
            where: { otaUid: key },
            update: { checkIn: e.start, checkOut: e.end, guestName, channel, status: "APPROVED" },
            create: {
              otaUid: key, channel, guestName, propertySlug: property.slug, userId: uid,
              checkIn: e.start, checkOut: e.end, guests: 2, amountCents: 0, currency: "eur",
              status: "APPROVED", addons: "[]", breakdown: "{}", note: m.code ? `Reservation ${m.code}` : null,
            },
          }).catch(() => {});
          summary.reservations += 1;
        }
      } catch (e) {
        summary.errors.push(`${channel}: ${(e as Error).message}`);
      }
    }
    await prisma.availabilityBlock.deleteMany({ where: { propertySlug: property.slug, source: "ICAL" } });
    if (rows.length) { await prisma.availabilityBlock.createMany({ data: rows }); summary.imported = rows.length; }
    // Cancel upcoming OTA bookings that vanished from the feed (cancelled on the OTA).
    // Only when a feed actually fetched, and only future stays, so a transient error
    // or dropped past reservations never wrongly cancel anything.
    if (anyFeedOk) {
      await prisma.booking.updateMany({
        where: {
          propertySlug: property.slug, channel: { not: "DIRECT" }, status: { not: "CANCELLED" },
          checkOut: { gte: new Date() }, otaUid: { notIn: [...feedKeys] },
        },
        data: { status: "CANCELLED" },
      });
    }
    results[property.slug] = summary;
  }
  return results;
}

// Admin button (POST) triggers a sync.
export async function POST() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, results: await runSync() });
}

// Scheduled job (Vercel Cron) triggers a sync via GET with the cron secret.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, results: await runSync() });
}
