"use client";
import { useState } from "react";
import { HeartHandshake } from "lucide-react";

export function PrayerForm({ guest = false, dark = false }: { guest?: boolean; dark?: boolean }) {
  const [state, setState] = useState<{ ok?: boolean; msg?: string }>({});
  const [busy, setBusy] = useState(false);
  const inputCls = dark ? "input !border-white/15 !bg-white/5 !text-white placeholder:text-white/40" : "input";
  if (state.ok) {
    return <div className={`rounded-2xl p-6 text-center ${dark ? "bg-white/5" : "bg-emerald-50"}`} data-testid="prayer-sent"><HeartHandshake className="mx-auto text-red-400" size={36} /><p className="mt-3 font-semibold">We&apos;re standing with you in prayer.</p><p className={`mt-1 text-sm ${dark ? "text-white/60" : "text-slate-500"}`}>{state.msg}</p><button className="btn btn-secondary btn-sm mt-4" onClick={() => setState({})}>Send another</button></div>;
  }
  return (
    <form className="grid gap-3" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/prayer", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request: fd.get("request"), name: fd.get("name") ?? undefined, contact: fd.get("contact") ?? undefined, visibility: fd.get("visibility"), anonymous: fd.get("anonymous") === "on" }) });
      const j = await res.json().catch(() => ({}));
      setBusy(false);
      setState(res.ok ? { ok: true, msg: "Our prayer team has received your request." } : { msg: j.error ?? "Could not send your request." });
    }}>
      {guest && <div className="grid gap-3 sm:grid-cols-2"><input className={inputCls} name="name" placeholder="Your name (optional)" aria-label="Your name" /><input className={inputCls} name="contact" placeholder="Phone or email (optional)" aria-label="Contact" /></div>}
      <textarea className={`${inputCls} min-h-32`} name="request" required placeholder="How can we pray with you?" aria-label="Prayer request" />
      <select className={inputCls} name="visibility" defaultValue="pastoral" aria-label="Who can see this">
        <option value="pastoral">Share with the pastoral team only</option>
        <option value="private">Senior pastor only (confidential)</option>
        <option value="public">It&apos;s okay to share on the prayer wall</option>
      </select>
      <label className={`checkbox ${dark ? "!text-white/80" : ""}`}><input type="checkbox" name="anonymous" /> Hide my name if shared</label>
      {state.msg && <p className="alert alert-err">{state.msg}</p>}
      <button className={`btn ${dark ? "lp-btn-light" : "btn-primary"}`} disabled={busy}>{busy ? "Sending…" : "Send prayer request"}</button>
    </form>
  );
}

export function PrayedButton({ id, count }: { id: string; count: number }) {
  const [n, setN] = useState(count); const [done, setDone] = useState(false);
  return (
    <button className={`btn btn-sm ${done ? "btn-primary" : "btn-secondary"}`} disabled={done} onClick={async () => { setDone(true); setN((v) => v + 1); await fetch("/api/prayer", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) }); }}>
      🙏 {done ? "Prayed" : "I prayed"} · {n}
    </button>
  );
}
