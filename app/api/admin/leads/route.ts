import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffScope, canAccessProperty } from "@/lib/access";

const SOURCES = ["PHONE", "WHATSAPP", "EMAIL", "INSTAGRAM", "FACEBOOK", "WEB", "REFERRAL", "OTHER"] as const;
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// Staff: create a lead by hand ("someone called"), or update it (status,
// timestamped note, follow-up date, dates of interest).
const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().max(40).optional(),
  propertySlug: z.string().max(80).optional().or(z.literal("")),
  source: z.enum(SOURCES).default("PHONE"),
  message: z.string().max(2000).optional(),
  checkIn: ymd.optional().or(z.literal("")),
  checkOut: ymd.optional().or(z.literal("")),
  followUpAt: ymd.optional().or(z.literal("")),
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(["NEW", "CONTACTED", "QUOTED", "WON", "LOST"]).optional(),
  addNote: z.string().max(4000).optional(),
  followUpAt: ymd.optional().or(z.literal("")).or(z.null()),
  propertySlug: z.string().max(80).optional().or(z.literal("")),
});

const toDate = (s?: string | null) => (s ? new Date(s + "T00:00:00Z") : null);

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
      checkIn: toDate(d.checkIn), checkOut: toDate(d.checkOut), followUpAt: toDate(d.followUpAt),
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

  // Append a timestamped note to the log rather than overwriting.
  let noteLog: { at: string; text: string }[] | undefined;
  if (d.addNote && d.addNote.trim()) {
    try { noteLog = JSON.parse(lead.noteLog || "[]"); } catch { noteLog = []; }
    noteLog!.push({ at: new Date().toISOString(), text: d.addNote.trim() });
  }

  await prisma.lead.update({
    where: { id: d.id },
    data: {
      ...(d.status ? { status: d.status } : {}),
      ...(noteLog ? { noteLog: JSON.stringify(noteLog) } : {}),
      ...(d.followUpAt !== undefined ? { followUpAt: d.followUpAt ? toDate(d.followUpAt) : null } : {}),
      ...(d.propertySlug !== undefined ? { propertySlug: d.propertySlug || null } : {}),
    },
  });
  return NextResponse.json({ ok: true });
}
