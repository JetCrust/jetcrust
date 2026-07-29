import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email(),
  password: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Please provide a name, a valid email and a password of at least 8 characters." }, { status: 400 });
  }
  const email = parsed.data.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "An account with this email already exists. Please sign in." }, { status: 409 });
  }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const user = await prisma.user.create({ data: { email, name: parsed.data.name, passwordHash } });
  // Link any prior inquiries from this email to the new account (CRM continuity).
  await prisma.lead.updateMany({ where: { email, userId: null }, data: { userId: user.id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
