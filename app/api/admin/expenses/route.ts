import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const CATEGORIES = ["CLEANING", "MAINTENANCE", "SUPPLIES", "COMMISSION", "UTILITIES", "OTHER"] as const;

const createSchema = z.object({
  propertySlug: z.string().optional().nullable(),
  bookingId: z.string().optional().nullable(),
  category: z.enum(CATEGORIES),
  description: z.string().min(1).max(200),
  amountCents: z.number().int().positive(),
  date: z.string(), // ISO date
});

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// List costs, optionally filtered by property + date range.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const url = new URL(req.url);
  const propertySlug = url.searchParams.get("property") || undefined;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const where: Record<string, unknown> = {};
  if (propertySlug && propertySlug !== "all") where.propertySlug = propertySlug;
  if (start || end) {
    where.date = {};
    if (start) (where.date as Record<string, Date>).gte = new Date(start);
    if (end) (where.date as Record<string, Date>).lte = new Date(end);
  }
  const expenses = await prisma.expense.findMany({ where, orderBy: { date: "desc" } });
  return NextResponse.json({ expenses });
}

// Add a cost.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const parsed = createSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Check the fields and try again." }, { status: 400 });
  const d = parsed.data;
  const expense = await prisma.expense.create({
    data: {
      propertySlug: d.propertySlug && d.propertySlug !== "all" ? d.propertySlug : null,
      bookingId: d.bookingId || null,
      category: d.category,
      description: d.description.trim(),
      amountCents: d.amountCents,
      date: new Date(d.date),
    },
  });
  return NextResponse.json({ ok: true, expense });
}

// Delete a cost.
export async function DELETE(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });
  await prisma.expense.delete({ where: { id } }).catch(() => {});
  return NextResponse.json({ ok: true });
}
