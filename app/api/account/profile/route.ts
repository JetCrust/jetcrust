import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  title: z.string().max(10).optional(),
  name: z.string().max(120).optional(),
  phone: z.string().max(40).optional(),
  preferences: z.string().max(2000).optional(),
  marketingOptIn: z.boolean().optional(),
});

// Guest updates their own profile & preferences.
export async function PATCH(req: Request) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid details." }, { status: 400 });
  const d = parsed.data;

  await prisma.user.update({
    where: { id: userId },
    data: {
      ...(d.title !== undefined ? { title: d.title || null } : {}),
      ...(d.name !== undefined ? { name: d.name || null } : {}),
      ...(d.phone !== undefined ? { phone: d.phone || null } : {}),
      ...(d.preferences !== undefined ? { preferences: d.preferences || null } : {}),
      ...(d.marketingOptIn !== undefined ? { marketingOptIn: d.marketingOptIn } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
