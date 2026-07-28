import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffScope, canAccessProperty } from "@/lib/access";

const CATEGORIES = ["CLEANING", "MAINTENANCE", "INSPECTION", "RESTOCK", "OTHER"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;

const createSchema = z.object({
  propertySlug: z.string().min(1),
  bookingId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  category: z.enum(CATEGORIES).default("CLEANING"),
  dueAt: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(STATUSES).optional(),
  assignedToId: z.string().optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  dueAt: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export async function POST(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the task and try again." }, { status: 400 });
  const d = parsed.data;
  if (!canAccessProperty(scope, d.propertySlug)) return NextResponse.json({ error: "Not your property." }, { status: 403 });
  const task = await prisma.task.create({
    data: {
      propertySlug: d.propertySlug, bookingId: d.bookingId || null, title: d.title.trim(),
      category: d.category, dueAt: d.dueAt ? new Date(d.dueAt) : null,
      assignedToId: d.assignedToId || null, notes: d.notes?.trim() || null,
    },
  });
  return NextResponse.json({ ok: true, id: task.id });
}

export async function PATCH(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;
  const task = await prisma.task.findUnique({ where: { id: d.id } });
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (!canAccessProperty(scope, task.propertySlug)) return NextResponse.json({ error: "Not your property." }, { status: 403 });

  const data: Record<string, unknown> = {};
  if (d.status) { data.status = d.status; data.completedAt = d.status === "DONE" ? new Date() : null; }
  if (d.assignedToId !== undefined) data.assignedToId = d.assignedToId || null;
  if (d.title) data.title = d.title.trim();
  if (d.category) data.category = d.category;
  if (d.dueAt !== undefined) data.dueAt = d.dueAt ? new Date(d.dueAt) : null;
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null;
  await prisma.task.update({ where: { id: d.id }, data });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const scope = await staffScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return NextResponse.json({ ok: true });
  if (!canAccessProperty(scope, task.propertySlug)) return NextResponse.json({ error: "Not your property." }, { status: 403 });
  await prisma.task.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
