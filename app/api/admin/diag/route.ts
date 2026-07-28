import { NextResponse } from "next/server";
import { auth } from "@/auth";

// Temporary admin-only diagnostic: is the Stripe key clean, and can this
// serverless function actually reach api.stripe.com? Remove after debugging.
export async function GET() {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const key = process.env.STRIPE_SECRET_KEY || "";
  const out: Record<string, unknown> = {
    keyPresent: !!key,
    keyPrefix: key.slice(0, 8),
    keyLen: key.length,
    keyHasWhitespace: /\s/.test(key),
  };
  try {
    const r = await fetch("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${key}` },
    });
    out.rawFetchStatus = r.status;
    out.rawFetchBody = (await r.text()).slice(0, 160);
  } catch (e) {
    out.rawFetchError = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    // Node fetch wraps the underlying cause
    const cause = (e as { cause?: unknown })?.cause;
    if (cause) out.rawFetchCause = cause instanceof Error ? `${cause.name}: ${cause.message}` : String(cause);
  }
  return NextResponse.json(out);
}
