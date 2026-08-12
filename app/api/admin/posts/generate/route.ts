import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { generateAndSaveDraft, pickNextTopic } from "@/lib/generate";

// Research + write can take a while (web search + two model calls).
export const maxDuration = 300;

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Admin: generate one draft now. Optional { topic } in the body picks the subject.
export async function POST(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Add ANTHROPIC_API_KEY to enable draft generation." }, { status: 400 });
  }
  const body = await req.json().catch(() => ({}));
  const topic = (body?.topic && String(body.topic).trim()) || (await pickNextTopic());
  try {
    const post = await generateAndSaveDraft(topic);
    return NextResponse.json({ id: post.id, slug: post.slug });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Generation failed." }, { status: 500 });
  }
}

// Scheduled job (Vercel Cron, GET + Bearer CRON_SECRET): write the next auto-picked draft.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not authorized." }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not set." }, { status: 400 });
  }
  const topic = await pickNextTopic();
  // Scheduled runs publish straight to the Journal (hands-off).
  const post = await generateAndSaveDraft(topic, true);
  return NextResponse.json({ ok: true, id: post.id, slug: post.slug, topic });
}
