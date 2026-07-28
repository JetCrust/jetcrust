import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  billingName: z.string().max(120).optional(),
  billingLine1: z.string().max(200).optional(),
  billingLine2: z.string().max(200).optional(),
  billingCity: z.string().max(120).optional(),
  billingPostcode: z.string().max(40).optional(),
  billingCountry: z.string().max(80).optional(),
});

const clean = (v: string | undefined) => (v && v.trim() ? v.trim() : null);

// Guest saves their billing address (used to prefill checkout).
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid address." }, { status: 400 });
  const d = parsed.data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      billingName: clean(d.billingName),
      billingLine1: clean(d.billingLine1),
      billingLine2: clean(d.billingLine2),
      billingCity: clean(d.billingCity),
      billingPostcode: clean(d.billingPostcode),
      billingCountry: clean(d.billingCountry),
    },
  });
  return NextResponse.json({ ok: true });
}
