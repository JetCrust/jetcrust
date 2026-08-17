import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProperty } from "@/lib/properties";
import { answerFromGuide, type GuideSection } from "@/lib/guidebook";
import { askAssistant, fallbackAnswer, type ChatTurn } from "@/lib/assistant";

const schema = z.object({
  question: z.string().min(1).max(1000),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) })).max(12).optional(),
});

const fmt = (d: Date) => d.toISOString().slice(0, 10);

// Lightweight probe so the client gate knows whether to show the widget and in
// which mode — without forcing pages to render dynamically.
export async function GET() {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!user?.id) return NextResponse.json({ mode: null });
  const isTeam = user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF" || user.role === "OPS";
  return NextResponse.json({ mode: isTeam ? "admin" : "client", name: user.name?.split(" ")[0] || null });
}

export async function POST(req: Request) {
  const session = await auth();
  const user = session?.user as { id?: string; role?: string; name?: string } | undefined;
  if (!user?.id) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Ask a question." }, { status: 400 });
  const { question, history } = parsed.data;

  const isTeam = user.role === "ADMIN" || user.role === "MANAGER" || user.role === "STAFF" || user.role === "OPS";
  const mode: "admin" | "client" = isTeam ? "admin" : "client";

  // Guests: keyword knowledge base only — no AI credits. The guidebook for their
  // stay answers "how things work" (Wi-Fi, music, saunas…); general policy covers
  // deposits/payments; anything else invites them to message the host.
  if (mode === "client") {
    const bookings = await prisma.booking.findMany({ where: { userId: user.id }, orderBy: { checkIn: "desc" }, take: 4 });
    const gbBooking = bookings.find((b) => b.status === "APPROVED") || bookings[0];
    let sections: GuideSection[] = [];
    if (gbBooking) {
      const prop = await getProperty(gbBooking.propertySlug);
      if (prop?.guidebook?.enabled && Array.isArray(prop.guidebook.sections)) sections = prop.guidebook.sections;
    }
    const gb = answerFromGuide(sections, question);
    const answer = gb ? gb.text : fallbackAnswer(question);
    return NextResponse.json({ answer, grounded: !!gb });
  }

  // Team: AI-assisted (low volume, and worth the smarter help).
  const pending = await prisma.booking.count({ where: { status: "REQUESTED" } }).catch(() => 0);
  const context = `There are ${pending} booking request(s) awaiting approval. Today is ${fmt(new Date())}. The person asking is a ${user.role}.`;
  const { answer, grounded } = await askAssistant({ mode, question, history: history as ChatTurn[] | undefined, context });
  return NextResponse.json({ answer, grounded });
}
