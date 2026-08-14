import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { staffScope, opsScope, canAccessProperty } from "@/lib/access";

const CATEGORIES = ["CLEANING", "MAINTENANCE", "INSPECTION", "RESTOCK", "CHEF", "SPA", "TRANSFER", "EXPERIENCE", "OTHER"] as const;
const STATUSES = ["OPEN", "IN_PROGRESS", "DONE"] as const;

const createSchema = z.object({
  propertySlug: z.string().min(1),
  bookingId: z.string().optional().nullable(),
  title: z.string().min(1).max(200),
  category: z.enum(CATEGORIES).default("CLEANING"),
  dueAt: z.string().optional().nullable(),
  assignedToId: z.string().optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  vendorPhone: z.string().max(40).optional().nullable(),
  costCents: z.number().int().min(0).optional(),
  notes: z.string().max(1000).optional().nullable(),
});

const patchSchema = z.object({
  id: z.string(),
  status: z.enum(STATUSES).optional(),
  assignedToId: z.string().optional().nullable(),
  title: z.string().min(1).max(200).optional(),
  category: z.enum(CATEGORIES).optional(),
  dueAt: z.string().optional().nullable(),
  vendor: z.string().max(120).optional().nullable(),
  vendorPhone: z.string().max(40).optional().nullable(),
  costCents: z.number().int().min(0).optional(),
  confirmed: z.boolean().optional(),
  paid: z.boolean().optional(),
  paidVia: z.enum(["cash", "bank", "card", "other"]).optional().nullable(),
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
      vendor: d.vendor?.trim() || null, vendorPhone: d.vendorPhone?.trim() || null,
      costCents: d.costCents || 0,
    },
  });
  return NextResponse.json({ ok: true, id: task.id });
}

export async function PATCH(req: Request) {
  // Workers (STAFF) may update tasks too, but only status + notes on jobs at
  // their property; managers/admins can change everything.
  const scope = await opsScope();
  if (!scope) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const d = parsed.data;
  const task = await prisma.task.findUnique({ where: { id: d.id } });
  if (!task) return NextResponse.json({ error: "Task not found." }, { status: 404 });
  if (!canAccessProperty(scope, task.propertySlug)) return NextResponse.json({ error: "Not your property." }, { status: 403 });
  if (scope.isWorker && task.assignedToId && task.assignedToId !== scope.userId) {
    return NextResponse.json({ error: "This task is assigned to someone else." }, { status: 403 });
  }

  const data: Record<string, unknown> = {};
  if (d.status) { data.status = d.status; data.completedAt = d.status === "DONE" ? new Date() : null; }
  if (d.notes !== undefined) data.notes = d.notes?.trim() || null;
  // Reassignment and edits are for managers/admins only.
  if (!scope.isWorker) {
    if (d.assignedToId !== undefined) data.assignedToId = d.assignedToId || null;
    if (d.title) data.title = d.title.trim();
    if (d.category) data.category = d.category;
    if (d.dueAt !== undefined) data.dueAt = d.dueAt ? new Date(d.dueAt) : null;
    if (d.vendor !== undefined) data.vendor = d.vendor?.trim() || null;
    if (d.vendorPhone !== undefined) data.vendorPhone = d.vendorPhone?.trim() || null;
    if (d.costCents !== undefined) data.costCents = d.costCents;
    if (d.confirmed !== undefined) data.confirmed = d.confirmed;
    if (d.paid !== undefined) { data.paid = d.paid; data.paidAt = d.paid ? new Date() : null; if (!d.paid) data.paidVia = null; }
    if (d.paidVia !== undefined) data.paidVia = d.paidVia;
  } else if (d.status === "IN_PROGRESS" && !task.assignedToId) {
    // A worker starting an unassigned job claims it.
    data.assignedToId = scope.userId;
  }
  await prisma.task.update({ where: { id: d.id }, data });

  // Keep the vendor cost in sync with the ledger: booked as an expense once the
  // job is Done, removed if it's reopened.
  const after = await prisma.task.findUnique({ where: { id: d.id } });
  if (after) {
    const expDesc = `Service: ${after.title}${after.vendor ? ` (${after.vendor})` : ""}${after.paid && after.paidVia ? ` [paid ${after.paidVia}]` : ""}`;
    if (after.status === "DONE" && after.costCents > 0 && !after.expenseId) {
      const exp = await prisma.expense.create({
        data: {
          propertySlug: after.propertySlug, bookingId: after.bookingId,
          category: "OTHER", amountCents: after.costCents,
          description: expDesc,
          date: after.dueAt || new Date(),
        },
      });
      await prisma.task.update({ where: { id: after.id }, data: { expenseId: exp.id } });
    } else if (after.status !== "DONE" && after.expenseId) {
      await prisma.expense.delete({ where: { id: after.expenseId } }).catch(() => {});
      await prisma.task.update({ where: { id: after.id }, data: { expenseId: null } });
    } else if (after.expenseId) {
      // Keep the ledger line in sync (e.g. the paid method was just set).
      await prisma.expense.update({ where: { id: after.expenseId }, data: { description: expDesc, amountCents: after.costCents } }).catch(() => {});
    }
  }
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
