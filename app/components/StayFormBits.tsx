"use client";
import { useEffect, useRef, forwardRef, useImperativeHandle } from "react";

// Shared building blocks for the tablet-first check-in / check-out forms.

// Shrink + re-encode a photo on the device before upload: cap the long edge and
// drop to JPEG so the stored file is small but still clearly readable.
export async function compress(file: File, maxDim = 1400, quality = 0.6): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res) => canvas.toBlob((b) => res(b || file), "image/jpeg", quality));
}

// Finger / stylus signature pad. Exposes export() → PNG data URL (or undefined if untouched).
export const SignaturePad = forwardRef<{ export: () => string | undefined }, { initial?: string }>(
  function SignaturePad({ initial }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const drawing = useRef(false);
    const dirty = useRef(false);

    useEffect(() => {
      const c = canvasRef.current; if (!c) return;
      const ratio = window.devicePixelRatio || 1;
      c.width = c.offsetWidth * ratio; c.height = c.offsetHeight * ratio;
      const ctx = c.getContext("2d")!;
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.strokeStyle = "#17160F";
      if (initial) { const img = new Image(); img.onload = () => ctx.drawImage(img, 0, 0, c.offsetWidth, c.offsetHeight); img.src = initial; dirty.current = true; }
    }, [initial]);

    const pos = (e: React.PointerEvent) => {
      const r = canvasRef.current!.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const down = (e: React.PointerEvent) => { drawing.current = true; dirty.current = true; const ctx = canvasRef.current!.getContext("2d")!; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); (e.target as HTMLElement).setPointerCapture(e.pointerId); };
    const move = (e: React.PointerEvent) => { if (!drawing.current) return; const ctx = canvasRef.current!.getContext("2d")!; const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
    const up = () => { drawing.current = false; };
    const clear = () => { const c = canvasRef.current!; c.getContext("2d")!.clearRect(0, 0, c.width, c.height); dirty.current = false; };

    useImperativeHandle(ref, () => ({ export: () => (dirty.current ? canvasRef.current!.toDataURL("image/png") : undefined) }));

    return (
      <div>
        <canvas ref={canvasRef} className="co-sigpad" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
        <button className="chip" style={{ marginTop: "0.5rem" }} onClick={clear}>Clear signature</button>
      </div>
    );
  }
);
