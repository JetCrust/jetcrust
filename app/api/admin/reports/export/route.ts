import { auth } from "@/auth";
import { buildPerformance } from "@/lib/reports";

const eur = (c: number) => (c / 100).toFixed(2);
const csvCell = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const row = (cells: (string | number)[]) => cells.map(csvCell).join(",");

// Performance export: per-property KPIs for the range, ready for a spreadsheet.
export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") return new Response("Not authorized", { status: 403 });
  const url = new URL(req.url);
  const start = url.searchParams.get("start") || "2000-01-01";
  const end = url.searchParams.get("end") || "2999-12-31";
  const perf = await buildPerformance(new Date(`${start}T00:00:00Z`), new Date(`${end}T23:59:59Z`));

  const lines = [row(["Property", "Occupancy %", "ADR EUR", "RevPAR EUR", "Room revenue EUR", "Bookings", "Booked nights", "Avg stay nights"])];
  for (const p of perf.byProperty) {
    lines.push(row([p.name, Math.round(p.occupancy * 100), eur(p.adrCents), eur(p.revparCents), eur(p.roomRevenueCents), p.bookings, p.bookedNights, p.avgStayNights.toFixed(1)]));
  }
  const t = perf.totals;
  lines.push(row(["PORTFOLIO", Math.round(t.occupancy * 100), eur(t.adrCents), eur(t.revparCents), eur(t.roomRevenueCents), t.bookings, t.bookedNights, t.avgStayNights.toFixed(1)]));

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="jetcrust-performance-${start}_${end}.csv"` },
  });
}
