import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseExtras, type Extra } from "@/lib/accounting";

const schema = z.object({
  photos: z.array(z.object({ url: z.string().min(1), at: z.string() })).default([]),
  items: z.array(z.object({ desc: z.string().min(1).max(120), amountCents: z.number().int().nonnegative() })).default([]),
  notes: z.string().max(1000).optional(),
  staffName: z.string().max(120).optional(),
  signature: z.string().optional(),
  acknowledged: z.boolean().optional(),
  complete: z.boolean().optional(),
});

// Save (draft) or complete the check-in report for a booking. On completion,
// any arrival add-ons are pushed to the booking's extras ledger so they can be
// collected. Uses the shared StayReport table with kind CHECKIN.
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { bookingId } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again." }, { status: 400 });
  const d = parsed.data;

  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { user: true } });
  if (!booking) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  if (d.complete) {
    if (!d.acknowledged) return NextResponse.json({ error: "House-rules and deposit acknowledgement are required." }, { status: 400 });
    if (!d.signature) return NextResponse.json({ error: "A signature is required to complete." }, { status: 400 });
  }

  const existing = await prisma.stayReport.findFirst({ where: { bookingId, kind: "CHECKIN" }, orderBy: { createdAt: "desc" } });
  const data = {
    bookingId,
    kind: "CHECKIN" as const,
    photos: JSON.stringify(d.photos),
    items: JSON.stringify(d.items),
    additionalCents: d.items.reduce((s, it) => s + it.amountCents, 0),
    depositStatus: d.acknowledged ? "acknowledged" : "pending",
    notes: d.notes || null,
    staffName: d.staffName || null,
    guestName: booking.user.name || booking.user.email,
    signature: d.signature || null,
    completedAt: d.complete ? new Date() : existing?.completedAt ?? null,
  };

  const report = existing
    ? await prisma.stayReport.update({ where: { id: existing.id }, data })
    : await prisma.stayReport.create({ data });

  if (d.complete && d.items.length && !existing?.completedAt) {
    const extras = parseExtras(booking.extras);
    for (const it of d.items) {
      if (it.amountCents > 0) {
        const e: Extra = { id: crypto.randomUUID(), desc: `Check-in: ${it.desc}`, amountCents: it.amountCents, at: new Date().toISOString(), settled: false };
        extras.push(e);
      }
    }
    await prisma.booking.update({ where: { id: bookingId }, data: { extras: JSON.stringify(extras) } });
  }

  return NextResponse.json({ ok: true, id: report.id, completed: !!report.completedAt });
}
