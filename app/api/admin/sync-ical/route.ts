import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperties } from "@/lib/properties";
import { parseIcs, channelName, reservationMeta } from "@/lib/ical";

// Pull external iCal feeds (Airbnb, Booking.com, VRBO, concierge) listed in each
// property's data file (ical_urls) and refresh its imported AvailabilityBlocks.
async function runSync() {
  const results: Record<string, { imported: number; feeds: number; errors: string[] }> = {};
  for (const property of await getProperties()) {
    const urls = (property.ical_urls as string[] | undefined) || [];
    const summary = { imported: 0, feeds: urls.length, errors: [] as string[] };
    const rows: { propertySlug: string; start: Date; end: Date; source: "ICAL"; note: string; meta: string | null }[] = [];
    for (const url of urls) {
      const channel = channelName(url);
      try {
        const res = await fetch(url, { headers: { "User-Agent": "JetCrust/1.0" } });
        if (!res.ok) { summary.errors.push(`${channel}: HTTP ${res.status}`); continue; }
        for (const e of parseIcs(await res.text())) {
          const m = reservationMeta(e);
          rows.push({
            propertySlug: property.slug, start: e.start, end: e.end, source: "ICAL",
            note: channel, // shows the platform (Airbnb / Booking.com / VRBO) on the calendar
            meta: JSON.stringify({ channel, ...m }),
          });
        }
      } catch (e) {
        summary.errors.push(`${channel}: ${(e as Error).message}`);
      }
    }
    await prisma.availabilityBlock.deleteMany({ where: { propertySlug: property.slug, source: "ICAL" } });
    if (rows.length) {
      await prisma.availabilityBlock.createMany({ data: rows });
      summary.imported = rows.length;
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
