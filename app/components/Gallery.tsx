"use client";
import { useCallback, useEffect, useRef, useState } from "react";

export type GalleryImage = { src: string; srcSet?: string; caption: string };

export default function Gallery({ images }: { images: GalleryImage[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const touchX = useRef<number | null>(null);

  const close = useCallback(() => setOpen(null), []);
  const go = useCallback(
    (dir: number) => setOpen((i) => (i === null ? i : (i + dir + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, close, go]);

  return (
    <>
      <div className="gallery">
        {images.map((g, i) => (
          <figure className="g-item" key={g.src} onClick={() => setOpen(i)} style={{ cursor: "zoom-in" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.src} srcSet={g.srcSet} sizes="(max-width:620px) 100vw,(max-width:980px) 50vw,33vw" loading="lazy" alt={g.caption} />
            <figcaption>{g.caption}</figcaption>
          </figure>
        ))}
      </div>

      {open !== null && (
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
            <img className="lightbox__img" src={images[open].src} srcSet={images[open].srcSet} sizes="90vw" alt={images[open].caption} />
            <figcaption className="lightbox__cap">{images[open].caption}<span className="lightbox__count">{open + 1} / {images.length}</span></figcaption>
          </figure>
          <button className="lightbox__nav lightbox__next" aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1); }}>&#8250;</button>
        </div>
      )}
    </>
  );
}
