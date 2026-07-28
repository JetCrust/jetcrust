import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Receives an already-compressed image from the device and stores it PRIVATELY
// in Vercel Blob (condition photos, and later guest ID photos, must not sit
// behind a public URL). The client shrinks + re-encodes each photo first, so
// files stay small. We return a proxy URL (the GET below) rather than the raw
// blob URL, because private blobs require authentication to read.
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Photo storage isn't connected yet. Enable Blob storage in the Vercel dashboard." }, { status: 503 });
  }
  const { bookingId } = await params;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No image received." }, { status: 400 });
  if (file.size > 8 * 1024 * 1024) return NextResponse.json({ error: "Image too large." }, { status: 400 });

  try {
    const blob = await put(`checkout/${bookingId}/${crypto.randomUUID()}.jpg`, file, {
      access: "private",
      addRandomSuffix: false,
      contentType: "image/jpeg",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    // Serve it back through our admin-gated proxy, not the raw (private) blob URL.
    const url = `/api/admin/checkout/${bookingId}/photo?path=${encodeURIComponent(blob.pathname)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Stream a private condition photo to an authenticated admin. The admin's
// browser carries their session cookie on the <img> request, so this gates it.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return new Response("Not authorized", { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return new Response("Storage not connected", { status: 503 });
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("checkout/")) return new Response("Bad request", { status: 400 });
  try {
    const result = await get(path, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || !result.stream) return new Response("Not found", { status: 404 });
    return new Response(result.stream, {
      headers: {
        "Content-Type": result.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
