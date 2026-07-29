"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type GalleryImage = { src: string; srcSet?: string; caption: string; area?: string };

const isPlan = (a: string) => /floor.?plan|plan|layout/i.test(a);

export default function Gallery({ images }: { images: GalleryImage[] }) {
  const [filter, setFilter] = useState<string>("All");
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  // Area tabs, in first-appearance order, with any floor-plan area pushed last.
  const areas = useMemo(() => {
    const seen: string[] = [];
    for (const g of images) { const a = (g.area || "").trim(); if (a && !seen.includes(a)) seen.push(a); }
    seen.sort((a, b) => (isPlan(a) ? 1 : 0) - (isPlan(b) ? 1 : 0));
    return seen;
  }, [images]);

  const shown = useMemo(() => (filter === "All" ? images : images.filter((g) => (g.area || "").trim() === filter)), [images, filter]);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback((dir: number) => setOpen((i) => (i === null ? i : (i + dir + shown.length) % shown.length)), [shown.length]);

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = ""; };
  }, [open, close, go]);

  return (
    <>
      {areas.length > 0 && (
        <div className="g-tabs" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", marginBottom: "1.2rem", justifyContent: "center" }}>
          {["All", ...areas].map((a) => (
            <button key={a} className={`tag${filter === a ? " is-on" : ""}`}
              onClick={() => { setFilter(a); setOpen(null); }}
              style={{ cursor: "pointer", border: "1px solid var(--line)", background: filter === a ? "var(--forest, #253026)" : "transparent", color: filter === a ? "#fff" : "inherit", padding: "0.4rem 0.9rem", borderRadius: 999, fontSize: "0.82rem" }}>
              {a}
            </button>
          ))}
        </div>
      )}

      <div className="gallery">
        {shown.map((g, i) => (
          <figure className="g-item" key={g.src + i} onClick={() => setOpen(i)} style={{ cursor: "zoom-in" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} srcSet={g.srcSet} sizes="(max-width:620px) 100vw,(max-width:980px) 50vw,33vw" loading="lazy" alt={[g.area, g.caption].filter(Boolean).join(" — ") || g.caption} />
            <figcaption>{g.caption || g.area}</figcaption>
          </figure>
        ))}
      </div>

      {open !== null && shown[open] && (
        <div
          className="lightbox"
          onClick={close}
          onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            touchX.current = null;
          }}
        >
          <button className="lightbox__close" aria-label="Close" onClick={close}>&times;</button>
          <button className="lightbox__nav lightbox__prev" aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1); }}>&#8249;</button>
          <figure className="lightbox__stage" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="lightbox__img" src={shown[open].src} srcSet={shown[open].srcSet} sizes="90vw" alt={shown[open].caption} />
            <figcaption className="lightbox__cap">{[shown[open].area, shown[open].caption].filter(Boolean).join(" · ")}<span className="lightbox__count">{open + 1} / {shown.length}</span></figcaption>
          </figure>
          <button className="lightbox__nav lightbox__next" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1); }}>&#8250;</button>
        </div>
      )}
    </>
  );
}
