import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { buildIcs } from "@/lib/ical";

// Public availability feed for a property. External platforms (Airbnb, Booking.com,
// VRBO, concierge) subscribe to https://jetcrust.com/api/ical/<slug> to see our blocked dates.
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const property = await getProperty(slug);
  if (!property) return new Response("Not found", { status: 404 });

  const blocks = await prisma.availabilityBlock.findMany({
    where: { propertySlug: slug },
    orderBy: { start: "asc" },
  });

  const ics = buildIcs(property.name, blocks);
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="${slug}.ics"`,
      "Cache-Control": "public, max-age=900",
    },
  });
}
