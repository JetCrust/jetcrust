import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  propertySlug: z.string().min(1),
  start: z.string(),      // ISO date (check-in day)
  end: z.string(),        // ISO date (check-out day, exclusive)
  note: z.string().max(200).optional(),
});

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Create a manual block (owner stay, maintenance, hold). Booking-owned blocks are
// written elsewhere; this is for admin-created blocks only.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the dates and try again." }, { status: 400 });
  const { propertySlug, start, end, note } = parsed.data;
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (e <= s) return NextResponse.json({ error: "End date must be after the start date." }, { status: 400 });
  const block = await prisma.availabilityBlock.create({
    data: { propertySlug, start: s, end: e, source: "MANUAL", note: note?.trim() || "Blocked" },
  });
  return NextResponse.json({ ok: true, block });
}

// Remove a block. Only manual blocks can be deleted here; booking blocks follow
// their booking, imported blocks are cleared on the next sync.
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const block = await prisma.availabilityBlock.findUnique({ where: { id } });
  if (!block) return NextResponse.json({ ok: true });
  if (block.source !== "MANUAL") {
    return NextResponse.json({ error: "Only manual blocks can be removed here." }, { status: 400 });
  }
  await prisma.availabilityBlock.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
