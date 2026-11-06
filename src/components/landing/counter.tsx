"use client";
import { useEffect, useRef, useState } from "react";

/** Counts up from 0 when scrolled into view. */
export function Counter({ value, suffix = "" }: { value: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now(); const dur = 1600;
      const step = (t: number) => { const p = Math.min(1, (t - start) / dur); setN(Math.round(value * (1 - Math.pow(1 - p, 3)))); if (p < 1) requestAnimationFrame(step); };
      requestAnimationFrame(step);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return <span ref={ref}>{n.toLocaleString()}{suffix}</span>;
}
