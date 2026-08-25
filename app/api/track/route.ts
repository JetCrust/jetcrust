import { NextResponse } from "next/server";
import { z } from "zod";
import { cookies } from "next/headers";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// First-party analytics beacon: record a property view or a date-range quote.
// Public (views come from signed-out visitors). No third-party trackers.
const schema = z.object({
  type: z.enum(["view", "quote"]),
  slug: z.string().min(1).max(80),
  ref: z.string().max(500).optional(),
  utm: z.string().max(120).optional(),
  checkIn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  checkOut: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const SOCIAL = ["facebook.", "fb.com", "instagram.", "t.co", "twitter.", "x.com", "linkedin.", "lnkd.in", "pinterest.", "tiktok.", "youtube.", "youtu.be"];
// AI assistants that can recommend the site (checked before search engines, since
// e.g. gemini.google.com would otherwise read as Google).
const AI = ["chatgpt.com", "chat.openai.com", "openai.com", "perplexity.ai", "claude.ai", "gemini.google", "bard.google", "copilot.microsoft", "you.com", "poe.com", "phind.com"];
// Turn a referrer URL + UTM tag into a simple channel name.
function classifySource(ref?: string, utm?: string): string {
  const u = (utm || "").toLowerCase().trim();
  if (u) {
    if (["chatgpt", "openai", "perplexity", "claude", "gemini", "copilot", "phind"].some((s) => u.includes(s)) || u === "ai") return "AI";
    if (u.includes("google")) return "Google";
    if (u.includes("bing")) return "Bing";
    if (u.includes("email") || u.includes("newsletter")) return "Email";
    if (["facebook", "instagram", "tiktok", "twitter", "linkedin", "pinterest", "youtube", "social"].some((s) => u.includes(s))) return "Social";
    return u.charAt(0).toUpperCase() + u.slice(1);
  }
  const r = (ref || "").toLowerCase();
  if (!r) return "Direct";
  let host = "";
  try { host = new URL(r).hostname.replace(/^www\./, ""); } catch { return "Direct"; }
  if (!host || host.includes("jetcrust.com")) return "Direct";
  if (AI.some((s) => host.includes(s))) return "AI";
  if (host.includes("google.")) return "Google";
  if (host.includes("bing.")) return "Bing";
  if (host.includes("duckduckgo")) return "DuckDuckGo";
  if (host.includes("yahoo.")) return "Yahoo";
  if (SOCIAL.some((s) => host.includes(s))) return "Social";
  return "Referral";
}

export async function POST(req: Request) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const d = parsed.data;

  const session = await auth().catch(() => null);
  const userId = (session?.user as { id?: string } | undefined)?.id || null;

  const jar = await cookies();
  // Team members can opt out of their own visits (see /optout).
  if (jar.get("jc_noanalytics")?.value === "1") return NextResponse.json({ ok: true, skipped: true });
  let sid = jar.get("jc_sid")?.value || null;
  const res = NextResponse.json({ ok: true });
  if (!sid) {
    sid = crypto.randomUUID();
    res.cookies.set("jc_sid", sid, { httpOnly: true, sameSite: "lax", maxAge: 60 * 60 * 24 * 365, path: "/" });
  }

  await prisma.analyticsEvent.create({
    data: {
      type: d.type, slug: d.slug, userId, session: sid,
      source: classifySource(d.ref, d.utm),
      checkIn: d.checkIn ? new Date(d.checkIn + "T00:00:00Z") : null,
      checkOut: d.checkOut ? new Date(d.checkOut + "T00:00:00Z") : null,
    },
  }).catch(() => {});
  return res;
}
