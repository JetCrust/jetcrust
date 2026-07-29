import { NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userId: z.string(),
  role: z.enum(["GUEST", "STAFF", "MANAGER", "ADMIN"]).optional(),
  managedSlugs: z.array(z.string()).optional(),
  resetPassword: z.boolean().optional(),
});

const createSchema = z.object({
  email: z.string().email(),
  name: z.string().max(120).optional(),
  role: z.enum(["STAFF", "MANAGER", "ADMIN"]).default("MANAGER"),
  managedSlugs: z.array(z.string()).default([]),
});

async function requireSuper() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Create a team member (Super Admin only). Returns a one-time temporary password
// to share; they change it after signing in.
export async function POST(req: Request) {
  if (!(await requireSuper())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and role." }, { status: 400 });
  const d = parsed.data;
  const email = d.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return NextResponse.json({ error: "Someone already has that email. Change their role in the list instead." }, { status: 409 });
  const tempPassword = "jc-" + randomBytes(4).toString("hex");
  await prisma.user.create({
    data: { email, name: d.name?.trim() || null, role: d.role, managedSlugs: (d.role === "MANAGER" || d.role === "STAFF") ? d.managedSlugs : [], passwordHash: await bcrypt.hash(tempPassword, 10) },
  });
  return NextResponse.json({ ok: true, tempPassword });
}

// Super Admin manages roles and property assignments. Guarded so a super admin
// cannot lock themselves (or the last admin) out.
export async function PATCH(req: Request) {
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { userId, role, managedSlugs, resetPassword } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Prevent removing the last super admin, or demoting yourself.
  if (role && role !== "ADMIN" && target.role === "ADMIN") {
    if (target.id === me.id) return NextResponse.json({ error: "You cannot change your own admin role." }, { status: 400 });
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return NextResponse.json({ error: "There must be at least one Super Admin." }, { status: 400 });
  }

  const data: { role?: "GUEST" | "STAFF" | "MANAGER" | "ADMIN"; managedSlugs?: string[]; passwordHash?: string } = {};
  if (role) data.role = role;
  if (managedSlugs) data.managedSlugs = managedSlugs;
  // Only managers and staff hold property assignments.
  if (role && role !== "MANAGER" && role !== "STAFF") data.managedSlugs = [];

  let tempPassword: string | undefined;
  if (resetPassword) {
    tempPassword = "jc-" + randomBytes(4).toString("hex");
    data.passwordHash = await bcrypt.hash(tempPassword, 10);
  }

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ ok: true, role: updated.role, managedSlugs: updated.managedSlugs, tempPassword });
}
