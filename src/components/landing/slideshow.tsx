"use client";
import Image from "next/image";
import { useEffect, useState } from "react";
import type { Photo } from "./photos";

/** Story-style crossfading slideshow with Ken Burns motion and progress bars. */
export function Slideshow({ slides, interval = 5200 }: { slides: { photo: Photo; caption: string; kicker: string }[]; interval?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const t = setTimeout(() => setI((v) => (v + 1) % slides.length), interval);
    return () => clearTimeout(t);
  }, [i, paused, interval, slides.length]);
  return (
    <div className="slideshow" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      {slides.map((s, k) => (
        <figure key={s.photo.src} className={`slide ${k === i ? "on" : ""}`} aria-hidden={k !== i}>
          <Image src={s.photo.src} alt={s.photo.alt} fill sizes="(max-width: 1024px) 100vw, 55vw" className="object-cover" priority={k === 0} />
          <figcaption><span className="kicker">{s.kicker}</span><span className="cap">{s.caption}</span></figcaption>
        </figure>
      ))}
      <div className="bars">
        {slides.map((s, k) => (
          <button key={s.photo.src} aria-label={`Show slide ${k + 1}`} onClick={() => setI(k)} className={k < i ? "done" : k === i ? (paused ? "on paused" : "on") : ""}>
            <span style={{ animationDuration: `${interval}ms` }} />
          </button>
        ))}
      </div>
    </div>
  );
}
