import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({ note: z.string().min(1).max(5000) });

type NoteEntry = { text: string; at: string };

function parseLog(raw: string | null): NoteEntry[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (Array.isArray(v)) return v as NoteEntry[];
  } catch {
    // Legacy single-note string: keep it as the first entry.
    return [{ text: raw, at: "" }];
  }
  return [];
}

// Append a dated internal note (host only). Notes accumulate as a log, never overwrite.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Please write a note." }, { status: 400 });

  const existing = await prisma.booking.findUnique({ where: { id }, select: { adminNotes: true } });
  if (!existing) return NextResponse.json({ error: "Booking not found." }, { status: 404 });

  const log = parseLog(existing.adminNotes);
  log.push({ text: parsed.data.note.trim(), at: new Date().toISOString() });
  await prisma.booking.update({ where: { id }, data: { adminNotes: JSON.stringify(log) } });
  return NextResponse.json({ ok: true });
}
