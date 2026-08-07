import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { askAssistant, type ChatTurn } from "@/lib/assistant";

const schema = z.object({
  question: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).optional(),
});

const money = (c: number) => `€${Math.round((c || 0) / 100).toLocaleString("en-US")}`;
const fmt = (d: Date) => d.toISOString().slice(0, 10);

const DEPOSIT_STATE: Record<string, string> = {
  none: "not secured yet", held: "held (nothing charged)", charged: "charged, refundable after a clean checkout",
  released: "released back", captured: "partly kept for damage", expired: "expired",
};

// Lightweight probe so the client gate knows whether to show the widget and in
// which mode — without forcing pages to render dynamically.
export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!user?.id) return NextResponse.json({ mode: null });
  const isTeam = user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF";
  return NextResponse.json({ mode: isTeam ? "admin" : "client", name: user.name?.split(" ")[0] || null });
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  const { question, history } = parsed.data;

  const isTeam = user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF";
  const mode: "admin" | "client" = isTeam ? "admin" : "client";

  // Ground the answer in this person's real data.
  let context = "";
  if (mode === "client") {
    const bookings = await prisma.booking.findMany({
      where: { userId: user.id },
      orderBy: { checkIn: "desc" },
      take: 4,
    });
    if (bookings.length) {
      context = "The guest's bookings:\n" + bookings.map((b) => {
        const bits = [
          `- ${b.propertySlug}: ${fmt(b.checkIn)} to ${fmt(b.checkOut)}, ${b.guests} guests, status ${b.status}`,
          `  paid/held ${money(b.depositCents ?? 0)}${b.status === "APPROVED" ? " charged" : " held"}`,
        ];
        if (b.balanceCents > 0) bits.push(`  balance ${money(b.balanceCents)}${b.balancePaidAt ? " paid" : b.balanceDueAt ? ` due ${fmt(b.balanceDueAt)}` : ""}`);
        if (b.securityCents > 0) bits.push(`  security deposit ${money(b.securityCents)}: ${DEPOSIT_STATE[b.securityStatus] || b.securityStatus}`);
        return bits.join("\n");
      }).join("\n");
    } else {
      context = "The guest has no bookings yet.";
    }
    context += `\nThe guest's name is ${user.name || "there"}. Today is ${fmt(new Date())}.`;
  } else {
    const pending = await prisma.booking.count({ where: { status: "REQUESTED" } }).catch(() => 0);
    context = `There are ${pending} booking request(s) awaiting approval. Today is ${fmt(new Date())}. The person asking is a ${user.role}.`;
  }

  const { answer, grounded } = await askAssistant({ mode, question, history: history as ChatTurn[] | undefined, context });
  return NextResponse.json({ answer, grounded });
}
