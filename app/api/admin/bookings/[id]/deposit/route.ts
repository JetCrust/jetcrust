import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { placeSecurityHold, chargeSecurityDeposit, secureDeposit, setBookingDeposit, releaseSecurityHold, captureSecurityHold } from "@/lib/security-deposit";

const schema = z.object({
  action: z.enum(["set", "hold", "charge", "secure", "release", "capture"]),
  amountCents: z.number().int().positive().optional(),
});

// Admin controls for the security deposit: place the hold, release it, or capture
// part/all for damage or extras.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { action, amountCents } = parsed.data;
  let r;
  if (action === "set") r = await setBookingDeposit(id);
  else if (action === "hold") r = await placeSecurityHold(id);
  else if (action === "charge") r = await chargeSecurityDeposit(id);
  else if (action === "secure") r = await secureDeposit(id);
  else if (action === "release") r = await releaseSecurityHold(id);
  else r = await captureSecurityHold(id, amountCents ?? 0);

  if (r.error) return NextResponse.json({ error: r.error }, { status: 400 });
  return NextResponse.json({ ok: true, ...r });
}
