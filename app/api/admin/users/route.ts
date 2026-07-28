import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  userId: z.string(),
  role: z.enum(["GUEST", "MANAGER", "ADMIN"]).optional(),
  managedSlugs: z.array(z.string()).optional(),
});

// Super Admin manages roles and property assignments. Guarded so a super admin
// cannot lock themselves (or the last admin) out.
export async function PATCH(req: Request) {
  const session = await auth();
  const me = session?.user as { id?: string; role?: string } | undefined;
  if (me?.role !== "ADMIN") return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { userId, role, managedSlugs } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) return NextResponse.json({ error: "User not found." }, { status: 404 });

  // Prevent removing the last super admin, or demoting yourself.
  if (role && role !== "ADMIN" && target.role === "ADMIN") {
    if (target.id === me.id) return NextResponse.json({ error: "You cannot change your own admin role." }, { status: 400 });
    const admins = await prisma.user.count({ where: { role: "ADMIN" } });
    if (admins <= 1) return NextResponse.json({ error: "There must be at least one Super Admin." }, { status: 400 });
  }

  const data: { role?: "GUEST" | "MANAGER" | "ADMIN"; managedSlugs?: string[] } = {};
  if (role) data.role = role;
  if (managedSlugs) data.managedSlugs = managedSlugs;
  // A non-manager holds no property assignments.
  if (role && role !== "MANAGER") data.managedSlugs = [];

  const updated = await prisma.user.update({ where: { id: userId }, data });
  return NextResponse.json({ ok: true, role: updated.role, managedSlugs: updated.managedSlugs });
}
