import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffScope, canAccessProperty } from "@/lib/access";

// Staff: create a lead by hand ("someone called"), or update its status/notes.
const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  propertySlug: z.string().max(80).optional().or(z.literal("")),
  source: z.enum(["WEB", "PHONE", "EMAIL", "REFERRAL", "OTHER"]).default("PHONE"),
  message: z.string().max(2000).optional(),
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["NEW", "CONTACTED", "QUOTED", "WON", "LOST"]).optional(),
  notes: z.string().max(4000).optional(),
  propertySlug: z.string().max(80).optional().or(z.literal("")),
});

export async function POST(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Add at least a name." }, { status: 400 });
  const d = parsed.data;
  if (d.propertySlug && !canAccessProperty(scope, d.propertySlug)) return NextResponse.json({ error: "Not your property." }, { status: 403 });

  const email = d.email || undefined;
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  const lead = await prisma.lead.create({
    data: {
      name: d.name.trim(), email, phone: d.phone?.trim() || null,
      propertySlug: d.propertySlug || null, source: d.source, message: d.message?.trim() || null,
      userId: user?.id || null,
    },
  });
  return NextResponse.json({ ok: true, id: lead.id });
}

export async function PATCH(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid update." }, { status: 400 });
  const d = parsed.data;

  const lead = await prisma.lead.findUnique({ where: { id: d.id } });
  if (!lead) return NextResponse.json({ error: "Not found." }, { status: 404 });
  // Managers may only touch leads for their properties (or unassigned ones).
  if (lead.propertySlug && !canAccessProperty(scope, lead.propertySlug)) return NextResponse.json({ error: "Not authorized." }, { status: 403 });

  await prisma.lead.update({
    where: { id: d.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(d.notes !== undefined ? { notes: d.notes } : {}),
      ...(d.propertySlug !== undefined ? { propertySlug: d.propertySlug || null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
