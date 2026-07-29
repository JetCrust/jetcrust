"use client";
import { useRef, useState } from "react";
import { uploadPhoto } from "./photoUpload";

export type GalleryImg = { file: string; caption: string; area?: string };

// Common area buckets suggested for any property; the editor also offers any
// areas already used on this property, so categorising is consistent everywhere.
const COMMON_AREAS = [
  "Pool & Spa", "Wellness", "Bedrooms", "Living", "Dining & Kitchen",
  "Cinema & Games", "Cellar & Bar", "Bathrooms", "Terrace", "Grounds & River",
  "Exterior", "The Area", "Floor plan",
];

function thumb(file: string, imgKey: string): string {
  if (/^(https?:\/\/|\/)/.test(file)) return file; // uploaded proxy URL or absolute path
  return `/assets/img/${imgKey}/${file}-800.webp`;
}

export default function GalleryEditor({ images, imgKey, onChange }: {
  images: GalleryImg[]; imgKey: string; onChange: (imgs: GalleryImg[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const areas = [...new Set([...COMMON_AREAS, ...images.map((i) => i.area).filter(Boolean) as string[]])];

  const set = (i: number, patch: Partial<GalleryImg>) => onChange(images.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  const remove = (i: number) => onChange(images.filter((_, j) => j !== i));
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= images.length) return;
    const next = [...images]; [next[i], next[j]] = [next[j], next[i]]; onChange(next);
  };

  async function upload(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const added: GalleryImg[] = [];
    for (const f of Array.from(list)) { const url = await uploadPhoto(f); if (url) added.push({ file: url, caption: "", area: "" }); }
    setBusy(false);
    if (added.length) onChange([...images, ...added]);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div>
      <datalist id="gallery-areas">{areas.map((a) => <option key={a} value={a} />)}</datalist>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {images.map((g, i) => (
          <div key={i} style={{ display: "flex", gap: "0.7rem", alignItems: "center", border: "1px solid var(--line)", borderRadius: 10, padding: "0.5rem" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={thumb(g.file, imgKey)} alt="" style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8, flex: "0 0 auto", background: "#eee" }} />
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 180px", gap: "0.5rem" }}>
              <input value={g.caption} onChange={(e) => set(i, { caption: e.target.value })} placeholder="Caption (also used as image alt text)" />
              <input value={g.area || ""} onChange={(e) => set(i, { area: e.target.value })} list="gallery-areas" placeholder="Area (tab)" />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <button type="button" className="chip" onClick={() => move(i, -1)} disabled={i === 0} style={{ padding: "0.1rem 0.4rem" }}>↑</button>
              <button type="button" className="chip" onClick={() => move(i, 1)} disabled={i === images.length - 1} style={{ padding: "0.1rem 0.4rem" }}>↓</button>
            </div>
            <button type="button" onClick={() => remove(i)} title="Remove" style={{ border: "none", background: "none", color: "#a3412e", cursor: "pointer", fontSize: "1.1rem" }}>×</button>
          </div>
        ))}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button type="button" className="btn btn--ghost" style={{ marginTop: "0.8rem" }} disabled={busy} onClick={() => fileRef.current?.click()}>
        {busy ? "Uploading…" : "＋ Upload photos"}
      </button>
      <p className="panel__hint" style={{ marginBottom: 0, marginTop: "0.5rem" }}>Upload photos (compressed on the device), then give each a caption and an area. Photos with the same area group under one tab on the property page. Use area &ldquo;Floor plan&rdquo; for layouts.</p>
    </div>
  );
}
