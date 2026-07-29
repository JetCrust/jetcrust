import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// First-party analytics beacon: record a property view or a date-range quote.
// Public (views come from signed-out visitors). No third-party trackers.
const schema = z.object({
  type: z.enum(["view", "quote"]),
  slug: z.string().min(1).max(80),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const d = parsed.data;

  const session = await auth().catch(() => null);
  const userId = (session?.user as { id?: string } | undefined)?.id || null;

  const jar = await cookies();
  let sid = jar.get("jc_sid")?.value || null;
  const res = NextResponse.json({ ok: true });
  if (!sid) {
    sid = crypto.randomUUID();
    res.cookies.set("jc_sid", sid, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

  await prisma.analyticsEvent.create({
    data: {
      type: d.type, slug: d.slug, userId, session: sid,
      checkIn: d.checkIn ? new Date(d.checkIn + "T00:00:00Z") : null,
      checkOut: d.checkOut ? new Date(d.checkOut + "T00:00:00Z") : null,
    },
  }).catch(() => {});
  return res;
}
