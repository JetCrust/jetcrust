import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("preferences"), text: z.string().max(1000) }),
  z.object({ action: z.literal("review"), rating: z.number().int().min(1).max(5), text: z.string().max(2000).optional() }),
]);

// Guest self-service: save this stay's pre-arrival preferences, or leave a
// post-stay review. Only the guest who owns the booking can do this.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const userId = (session.user as { id: string }).id;
  const { id } = await params;

  const b = await prisma.booking.findUnique({ where: { id } });
  if (!b || b.userId !== userId) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the form and try again." }, { status: 400 });
  const d = parsed.data;

  if (d.action === "preferences") {
    if (["CANCELLED", "DECLINED", "EXPIRED"].includes(b.status)) {
      return NextResponse.json({ error: "This booking can no longer be edited." }, { status: 400 });
    }
    await prisma.booking.update({ where: { id }, data: { stayPreferences: d.text.trim() || null } });
    return NextResponse.json({ ok: true });
  }

  // review
  if (b.status !== "APPROVED") return NextResponse.json({ error: "You can review a stay once it is confirmed." }, { status: 400 });
  await prisma.booking.update({
    where: { id },
    data: { reviewRating: d.rating, reviewText: d.text?.trim() || null, reviewedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
