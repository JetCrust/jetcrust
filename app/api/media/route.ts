import { get } from "@vercel/blob";

// Public proxy for property MARKETING photos stored in the (private) Blob store.
// Restricted to the `property/` prefix so guest ID / condition photos (checkin/,
// checkout/) can never be served here — those stay behind their admin-gated route.
export async function GET(req: Request) {
  const path = new URL(req.url).searchParams.get("path");
  if (!path || !path.startsWith("property/")) return new Response("Not found", { status: 404 });
  if (!process.env.BLOB_READ_WRITE_TOKEN) return new Response("Storage not connected", { status: 503 });
  try {
    const result = await get(path, { access: "private", token: process.env.BLOB_READ_WRITE_TOKEN });
    if (!result || !result.stream) return new Response("Not found", { status: 404 });
    return new Response(result.stream, {
      headers: {
        "Content-Type": result.headers.get("content-type") || "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
