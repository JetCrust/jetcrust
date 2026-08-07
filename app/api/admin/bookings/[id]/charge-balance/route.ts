import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chargeBookingBalance } from "@/lib/charge";

// Admin charges a single booking's remaining balance now.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!["ADMIN", "OPS"].includes((session?.user as { role?: string } | undefined)?.role ?? "")) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const { id } = await params;
  const r = await chargeBookingBalance(id);
  return NextResponse.json(r, { status: r.ok ? 200 : 400 });
}
