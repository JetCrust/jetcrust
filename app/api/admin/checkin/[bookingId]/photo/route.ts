import { NextResponse } from "next/server";
import { put, get } from "@vercel/blob";
import { auth } from "@/auth";

async function requireAdmin() {
  const session = await auth();
  return (session?.user as { role?: string } | undefined)?.role === "ADMIN";
}

// Store a check-in photo (ID / arrival) PRIVATELY in Vercel Blob and return a
// proxy URL. Same private-storage approach as the check-out photos.
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
    const blob = await put(`checkin/${bookingId}/${crypto.randomUUID()}.jpg`, file, {
      access: "private",
      addRandomSuffix: false,
      contentType: "image/jpeg",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    const url = `/api/admin/checkin/${bookingId}/photo?path=${encodeURIComponent(blob.pathname)}`;
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

// Stream a private check-in photo to an authenticated admin.
export async function GET(req: Request) {
  if (!(await requireAdmin())) return new Response("Not authorized", { status: 403 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return new Response("Storage not connected", { status: 503 });
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("checkin/")) return new Response("Bad request", { status: 400 });
  try {
    const result = await get(path, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || !result.stream) return new Response("Not found", { status: 404 });
    return new Response(result.stream, {
      headers: { "Content-Type": result.headers.get("content-type") || "image/jpeg", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
