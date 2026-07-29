import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffScope, canAccessProperty } from "@/lib/access";

// Log / update the money for an OTA reservation so it counts in the P&L. iCal
// never carries the payout, so the admin enters it by hand from the channel.
const schema = z.object({
  id: z.string().optional(),
  propertySlug: z.string().min(1),
  channel: z.enum(["AIRBNB", "BOOKING", "VRBO", "OTHER"]).default("AIRBNB"),
  confirmationCode: z.string().optional(),
  guestName: z.string().optional(),
  checkIn: z.string(),  // YYYY-MM-DD
  checkOut: z.string(),
  grossCents: z.number().int().min(0).default(0),
  feeCents: z.number().int().min(0).default(0),
  netCents: z.number().int().min(0).default(0),
  note: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the figures and try again." }, { status: 400 });
  const d = parsed.data;
  if (!canAccessProperty(scope, d.propertySlug)) return NextResponse.json({ error: "Not authorized for this property." }, { status: 403 });

  const data = {
    propertySlug: d.propertySlug,
    channel: d.channel,
    confirmationCode: d.confirmationCode || null,
    guestName: d.guestName || null,
    checkIn: new Date(d.checkIn + "T00:00:00Z"),
    checkOut: new Date(d.checkOut + "T00:00:00Z"),
    grossCents: d.grossCents,
    feeCents: d.feeCents,
    netCents: d.netCents,
    note: d.note || null,
  };

  // Update in place when we already have this reservation (by id, else by
  // property + confirmation code, else by property + dates), so re-logging or a
  // re-sync never creates duplicates.
  const existing = d.id
    ? await prisma.otaBooking.findUnique({ where: { id: d.id } })
    : d.confirmationCode
      ? await prisma.otaBooking.findFirst({ where: { propertySlug: d.propertySlug, confirmationCode: d.confirmationCode } })
      : await prisma.otaBooking.findFirst({ where: { propertySlug: d.propertySlug, checkIn: data.checkIn, checkOut: data.checkOut } });

  const saved = existing
    ? await prisma.otaBooking.update({ where: { id: existing.id }, data })
    : await prisma.otaBooking.create({ data });
  return NextResponse.json({ ok: true, id: saved.id });
}

export async function DELETE(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const row = await prisma.otaBooking.findUnique({ where: { id } });
  if (row && canAccessProperty(scope, row.propertySlug)) await prisma.otaBooking.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
