"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
export function CopyButton({ value, label = "Copy", className = "btn btn-secondary btn-sm" }: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className={className} onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1800); } catch { /* clipboard unavailable */ } }}>
      {done ? <Check size={14} /> : <Copy size={14} />} {done ? "Copied" : label}
    </button>
  );
}
