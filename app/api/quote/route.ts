import { NextResponse } from "next/server";
import { getProperty } from "@/lib/properties";
import { quote } from "@/lib/pricing";
import { occupancyRatio } from "@/lib/occupancy";
import { prisma } from "@/lib/prisma";

// Public price quote so guests can see availability + price before signing in.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  // Selected add-ons so the live price reflects them as the guest ticks boxes.
  const addons = (searchParams.get("addons") || "").split(",").map((s) => s.trim()).filter(Boolean);

  const p = await getProperty(slug);
  if (!p) return NextResponse.json({ error: "Unknown property." }, { status: 404 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(checkIn) || !/^\d{4}-\d{2}-\d{2}$/.test(checkOut)) {
    return NextResponse.json({ error: "Pick your dates." }, { status: 400 });
  }

  const ratio = await occupancyRatio(p, checkIn, checkOut);
  const q = quote(p, checkIn, checkOut, ratio, addons, new Date());
  // Record the date interest (fire-and-forget) for demand analytics.
  if (q.valid) {
    prisma.analyticsEvent.create({
      data: { type: "quote", slug, checkIn: new Date(checkIn + "T00:00:00Z"), checkOut: new Date(checkOut + "T00:00:00Z") },
    }).catch(() => {});
  }
  return NextResponse.json(q);
}
