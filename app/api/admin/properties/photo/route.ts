import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { auth } from "@/auth";

// Upload a property (marketing) photo. These are shown on the public site, so
// they're stored PUBLIC. The client compresses before upload.
export async function POST(req: Request) {
  const session = await auth();
  if ((session?.user as { role?: string } | undefined)?.role !== "ADMIN") {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return NextResponse.json({ error: "Photo storage isn't connected. Enable Blob storage in Vercel." }, { status: 503 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "No image received." }, { status: 400 });
  if (file.size > 12 * 1024 * 1024) return NextResponse.json({ error: "Image too large." }, { status: 400 });
  try {
    const blob = await put(`property/${crypto.randomUUID()}.jpg`, file, {
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
