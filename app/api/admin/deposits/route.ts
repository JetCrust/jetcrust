import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { runSecurityDeposits } from "@/lib/security-deposit";

// Scheduled job: place security-deposit holds before check-in and release them
// after a clean checkout. GET (cron, Bearer CRON_SECRET) or POST (admin).
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, results: await runSecurityDeposits(new Date()) });
}

export async function POST() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, results: await runSecurityDeposits(new Date()) });
}
