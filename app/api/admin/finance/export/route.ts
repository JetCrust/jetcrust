import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseExtras, extrasIncomeCents } from "@/lib/accounting";

const eur = (c: number) => (c / 100).toFixed(2);
const csvCell = (v: string | number) => {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const row = (cells: (string | number)[]) => cells.map(csvCell).join(",");
const iso = (d: Date) => new Date(d).toISOString().slice(0, 10);

// Flat, Excel-friendly transactions export for accounting: one row per income
// booking and one per cost, with an Income and an Expense column.
export async function GET(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return new Response("Not authorized", { status: 403 });
  }
  const url = new URL(req.url);
  const property = url.searchParams.get("property") || undefined;
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");
  const startD = start ? new Date(start) : new Date("2000-01-01");
  const endD = end ? new Date(end) : new Date("2999-01-01");
  const propFilter = property && property !== "all" ? property : undefined;

  const bookings = await prisma.booking.findMany({
    where: { status: "APPROVED", checkIn: { gte: startD, lte: endD }, ...(propFilter ? { propertySlug: propFilter } : {}) },
    include: { user: true },
    orderBy: { checkIn: "asc" },
  });
  const expenses = await prisma.expense.findMany({
    where: { date: { gte: startD, lte: endD }, ...(propFilter ? { propertySlug: propFilter } : {}) },
    orderBy: { date: "asc" },
  });

  const lines: string[] = [];
  lines.push(row(["Date", "Type", "Property", "Reference", "Detail", "Description", "Income EUR", "Expense EUR"]));

  for (const b of bookings) {
    const extras = extrasIncomeCents(parseExtras(b.extras));
    const gross = b.amountCents + extras + b.securityCapturedCents;
    const net = gross - b.refundedCents;
    lines.push(row([
      iso(b.checkIn), "Booking", b.propertySlug, b.id,
      [b.user.title, b.user.name].filter(Boolean).join(" ") || b.user.email,
      `Stay €${eur(b.amountCents)}${extras ? ` + extras €${eur(extras)}` : ""}${b.securityCapturedCents ? ` + deposit €${eur(b.securityCapturedCents)}` : ""}${b.refundedCents ? ` − refund €${eur(b.refundedCents)}` : ""}`,
      eur(net), "",
    ]));
  }
  for (const e of expenses) {
    lines.push(row([
      iso(e.date), e.category === "COMMISSION" ? "Commission" : "Cost",
      e.propertySlug || "—", e.id, e.category, e.description, "", eur(e.amountCents),
    ]));
  }

  const csv = lines.join("\n");
  const fname = `jetcrust-pl-${start || "all"}_${end || "all"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
