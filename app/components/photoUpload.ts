"use client";
import { compress } from "./StayFormBits";

// Compress a photo on the device and upload it to the property Blob store,
// returning the public proxy URL (/api/media?path=…) or null on failure.
// Shared by PropertyEditor (gallery) and GuidebookEditor.
export async function uploadPhoto(file: File): Promise<string | null> {
  try {
    const blob = await compress(file, 2000, 0.82);
    const fd = new FormData();
    fd.append("file", blob, "photo.jpg");
    const res = await fetch("/api/admin/properties/photo", { method: "POST", body: fd });
    const d = await res.json().catch(() => ({}));
    return res.ok && d.url ? (d.url as string) : null;
  } catch {
    return null;
  }
}
