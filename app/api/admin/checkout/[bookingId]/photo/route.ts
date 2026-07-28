import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

// Receives an already-compressed image from the device and stores it in Vercel
// Blob. The client shrinks and re-encodes each photo before upload, so files
// stay small; here we just persist and return the URL.
export async function POST(req: Request, { params }: { params: Promise<{ bookingId: string }> }) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
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
      access: "public",
      addRandomSuffix: false,
      contentType: "image/jpeg",
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });
    return NextResponse.json({ ok: true, url: blob.url });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
