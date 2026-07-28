import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { placeSecurityHold, releaseSecurityHold, captureSecurityHold } from "@/lib/security-deposit";

const schema = z.object({
  action: z.enum(["hold", "release", "capture"]),
  amountCents: z.number().int().positive().optional(),
});

// Admin controls for the security deposit: place the hold, release it, or capture
// part/all for damage or extras.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  let r;
  if (parsed.data.action === "hold") r = await placeSecurityHold(id);
  else if (parsed.data.action === "release") r = await releaseSecurityHold(id);
  else r = await captureSecurityHold(id, parsed.data.amountCents ?? 0);

  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...r });
}
