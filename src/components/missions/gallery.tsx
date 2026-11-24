"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import type { MissionPhoto } from "@/lib/missions";

/** A photo grid; tapping a photo opens it full size (arrows / swipe-free keyboard: ← → Esc). */
export function Gallery({ photos, title }: { photos: MissionPhoto[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  // Big outreaches load 24 photos at a time.
  const [limit, setLimit] = useState(24);
  useEffect(() => {
    if (open === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight") setOpen((i) => (i === null ? i : (i + 1) % photos.length));
      if (e.key === "ArrowLeft") setOpen((i) => (i === null ? i : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, photos.length]);
  const shown = open === null ? null : photos[open];
  return (
    <>
      <div className="mission-grid" data-testid="mission-gallery">
        {photos.slice(0, limit).map((p, i) => (
          <button key={p.src} type="button" className="mission-thumb" onClick={() => setOpen(i)} aria-label={`Open photo ${i + 1} of ${photos.length}: ${p.alt}`}>
            <Image src={p.src} alt={p.alt} fill sizes="(max-width: 640px) 50vw, 25vw" className="object-cover" />
          </button>
        ))}
      </div>
      {photos.length > limit && <div className="mt-4 text-center"><button type="button" className="btn btn-secondary" onClick={() => setLimit((n) => n + 48)}>Show more photos ({photos.length - limit} more)</button></div>}
      {shown && (
        <div className="mission-lightbox" role="dialog" aria-modal="true" aria-label={title} onClick={() => setOpen(null)}>
          <button type="button" className="mission-lb-btn right-4 top-4" aria-label="Close" onClick={() => setOpen(null)}><X size={20} /></button>
          {photos.length > 1 && <button type="button" className="mission-lb-btn left-4 top-1/2 -translate-y-1/2" aria-label="Previous photo" onClick={(e) => { e.stopPropagation(); setOpen((open! - 1 + photos.length) % photos.length); }}><ChevronLeft size={22} /></button>}
          <figure className="relative max-h-[85vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            <Image src={shown.src} alt={shown.alt} width={shown.w} height={shown.h} sizes="92vw" className="max-h-[80vh] w-auto rounded-xl object-contain" />
            <figcaption className="mt-3 text-center text-sm text-white/80">{shown.alt} · {open! + 1}/{photos.length}</figcaption>
          </figure>
          {photos.length > 1 && <button type="button" className="mission-lb-btn right-4 top-1/2 -translate-y-1/2" aria-label="Next photo" onClick={(e) => { e.stopPropagation(); setOpen((open! + 1) % photos.length); }}><ChevronRight size={22} /></button>}
        </div>
      )}
    </>
  );
}
