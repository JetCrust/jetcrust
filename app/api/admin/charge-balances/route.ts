import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { chargeDueBalances } from "@/lib/charge";

// Scheduled job (Vercel Cron, GET + Bearer CRON_SECRET) or admin (POST) charges all due balances.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  return NextResponse.json({ ok: true, results: await chargeDueBalances(new Date()) });
}

export async function POST() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  return NextResponse.json({ ok: true, results: await chargeDueBalances(new Date()) });
}
