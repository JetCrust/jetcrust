import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ adminNotes: z.string().max(5000) });

// Internal host notes on a booking. Never shown to the guest.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid note." }, { status: 400 });

  const exists = await prisma.booking.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  await prisma.booking.update({ where: { id }, data: { adminNotes: parsed.data.adminNotes || null } });
  return NextResponse.json({ ok: true });
}
