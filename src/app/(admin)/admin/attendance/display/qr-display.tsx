"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Maximize2, X } from "lucide-react";

type TokenResponse = { token: string; expiresIn: number; service: string; count: number; closesAt: string; recent: { name: string; at: string }[]; error?: string };

export function QrDisplay({ serviceId }: { serviceId: string }) {
  const [qr, setQr] = useState("");
  const [data, setData] = useState<TokenResponse | null>(null);
  const [seconds, setSeconds] = useState(20);
  const [ttl, setTtl] = useState(20);
  const [error, setError] = useState("");
  const [checkInUrl, setCheckInUrl] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/attendance/token?serviceId=${serviceId}`, { cache: "no-store" });
      const json = (await res.json()) as TokenResponse;
      if (!res.ok || !json.token) throw new Error(json.error ?? "Unable to load the QR code.");
      const url = `${window.location.origin}/check-in?t=${encodeURIComponent(json.token)}`;
      setQr(await QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: "M", color: { dark: "#170f10", light: "#ffffff" } }));
      setCheckInUrl(url);
      setData(json); setTtl(json.expiresIn); setSeconds(json.expiresIn); setError("");
      timer.current = setTimeout(refresh, json.expiresIn * 1000);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the QR code.");
      timer.current = setTimeout(refresh, 5000);
    }
  }, [serviceId]);

  useEffect(() => {
    void refresh();
    const tick = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => { clearInterval(tick); if (timer.current) clearTimeout(timer.current); };
  }, [refresh]);

  const R = 26; const C = 2 * Math.PI * R;
  return (
    <div className="qr-stage fixed inset-0 z-50 overflow-y-auto">
      <div className="mx-auto flex min-h-full max-w-6xl flex-col px-6 py-6">
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-semibold text-red-200"><span className="live-dot" /> LIVE CHECK-IN</p>
          <div className="flex gap-2">
            <button className="btn lp-btn-glass btn-sm" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={14} /> Fullscreen</button>
            <Link href={`/admin/services/${serviceId}`} className="btn lp-btn-glass btn-sm"><X size={14} /> Exit</Link>
          </div>
        </div>
        <div className="grid flex-1 items-center gap-10 py-6 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="text-sm uppercase tracking-[.2em] text-red-200">Flag of Jesus Global Ministry</p>
            <h1 className="mt-3 text-4xl font-extrabold leading-tight sm:text-6xl">Welcome to<br /><span className="font-display italic text-[#ffc7cb]">{data?.service ?? "church"}</span></h1>
            <ol className="mt-8 space-y-3 text-lg text-slate-200">
              <li><b className="text-white">1.</b> Open your phone camera &amp; scan the code</li>
              <li><b className="text-white">2.</b> Type your <b className="text-[#ffc7cb]">flag</b> username</li>
              <li><b className="text-white">3.</b> First time? Tap <i>Register</i> — it takes a minute</li>
              <li className="pt-2 text-base text-red-100/80">No smartphone? Just tell an usher your name 🙂</li>
            </ol>
            <div className="mt-10 flex items-end gap-8">
              <div><p className="text-6xl font-extrabold tabular-nums" data-testid="live-count">{data?.count ?? 0}</p><p className="text-sm text-slate-400">checked in</p></div>
              <ul className="space-y-1 text-sm text-slate-300">{data?.recent.map((r) => <li key={r.at + r.name} className="ticker-in">✓ {r.name}</li>)}</ul>
            </div>
          </div>
          <div className="flex flex-col items-center">
            <div className="qr-frame">
              {/* eslint-disable-next-line @next/next/no-img-element -- data: URL QR, regenerated every 20s */}
              {qr ? <img src={qr} alt="Attendance QR code" data-testid="qr-image" data-url={checkInUrl} /> : <div className="grid h-[300px] w-[300px] place-items-center text-sm text-slate-500">{error || "Loading…"}</div>}
            </div>
            <div className="mt-6 flex items-center gap-3">
              <svg width="64" height="64" className="countdown-ring" aria-hidden><circle cx="32" cy="32" r={R} stroke="rgba(255,255,255,.15)" strokeWidth="5" fill="none" /><circle cx="32" cy="32" r={R} stroke="#ff6b74" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - seconds / Math.max(1, ttl))} /></svg>
              <p className="text-sm text-slate-300">New code in <b className="text-white tabular-nums">{seconds}s</b></p>
            </div>
            {error && <p className="mt-3 rounded-xl bg-red-500/20 px-4 py-2 text-sm text-red-100">{error}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
