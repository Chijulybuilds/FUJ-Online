"use client";
import { useEffect, useState } from "react";

/** Fixed progress rail showing which of the five story layers is on screen. */
export function LayerRail({ layers }: { layers: { id: string; label: string }[] }) {
  const [active, setActive] = useState(layers[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive(visible.target.id);
    }, { threshold: [0.25, 0.5, 0.75] });
    layers.forEach((l) => { const el = document.getElementById(l.id); if (el) io.observe(el); });
    return () => io.disconnect();
  }, [layers]);
  return (
    <nav className="layer-rail" aria-label="Page sections">
      {layers.map((l, i) => (
        <a key={l.id} href={`#${l.id}`} className={active === l.id ? "on" : ""} aria-current={active === l.id ? "true" : undefined}>
          <span className="num">{String(i + 1).padStart(2, "0")}</span><span className="lbl">{l.label}</span><span className="bar" />
        </a>
      ))}
    </nav>
  );
}
