import Image from "next/image";
import type { Photo } from "./photos";

/** Infinite, hover-pausable strip of outreach photos. */
export function PhotoMarquee({ photos, reverse = false, height = 220 }: { photos: Photo[]; reverse?: boolean; height?: number }) {
  // Four copies: each half of the track is wider than any viewport, so the loop never shows a gap.
  const row = [...photos, ...photos, ...photos, ...photos];
  return (
    <div className="photo-marquee" aria-hidden>
      <div className={`track ${reverse ? "rev" : ""}`}>
        {row.map((p, k) => (
          <div key={k} className="tile" style={{ height, width: Math.round((p.w / p.h) * height) }}>
            <Image src={p.src} alt="" fill sizes="400px" className="object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}
