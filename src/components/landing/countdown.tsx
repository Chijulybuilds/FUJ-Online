"use client";
import { useEffect, useState } from "react";

export function Countdown({ target, live }: { target: string | null; live: boolean }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  if (!target) return null;
  const diff = Math.max(0, new Date(target).getTime() - (now ?? new Date(target).getTime()));
  if (live || (now !== null && diff === 0)) {
    return <p className="inline-flex items-center gap-3 rounded-2xl border border-white/15 bg-white/5 px-5 py-4 text-lg font-bold backdrop-blur"><span className="live-dot" /> We&apos;re live — join the service now</p>;
  }
  const parts = [[Math.floor(diff / 86400000), "DAYS"], [Math.floor(diff / 3600000) % 24, "HOURS"], [Math.floor(diff / 60000) % 60, "MINS"], [Math.floor(diff / 1000) % 60, "SECS"]] as const;
  return <div className="lp-count max-w-md" aria-label="Time until the next service">{parts.map(([v, l]) => <div key={l}><b suppressHydrationWarning>{now === null ? "--" : String(v).padStart(2, "0")}</b><small>{l}</small></div>)}</div>;
}
