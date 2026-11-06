"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";

/** verified = signed in with Google already (no SMS code needed). */
export function RegisterForm({ defaults, checkInNote, verified = false }: { defaults: { name?: string; email?: string }; checkInNote?: string; verified?: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(""); const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const [done, setDone] = useState<{ username: string; name: string; checkedIn: boolean } | null>(null);
  if (done) {
    return (
      <div className="text-center" data-testid="register-success">
        <div className="success-ring mx-auto"><CheckCircle2 size={40} /></div>
        <h1 className="mt-5 text-2xl font-bold">Welcome to the family, {done.name.split(" ")[0]}!</h1>
        {done.checkedIn && <p className="alert alert-ok mt-4">You&apos;re checked in for today&apos;s service. 🎉</p>}
        <p className="mt-5 text-sm text-slate-500">Your check-in username is</p>
        <p className="username-badge mt-2 text-3xl font-extrabold text-blue-600" data-testid="new-username">{done.username}</p>
        <div className="mt-3 flex justify-center"><CopyButton value={done.username} label="Copy username" /></div>
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">📸 Screenshot or save it. Next Sunday, just scan the QR on the screen and type this username — no code by SMS required.</p>
        <Link href="/member" className="btn btn-primary mt-6 w-full">Go to my portal</Link>
      </div>
    );
  }
  const needsOtp = !verified;
  async function sendCode(phone: string) {
    setError(""); setInfo(""); setSending(true);
    const res = await fetch("/api/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone }) });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(json.error ?? "Could not send the code."); return; }
    setCodeSent(true); setCooldown(60);
    setInfo(json.devCode ? `Development mode (no SMS provider): your code is ${json.devCode}` : "We sent a 6-digit code by SMS. It expires in 10 minutes.");
  }
  return (
    <form className="mt-6 grid gap-4" onSubmit={async (e) => {
      e.preventDefault(); setError("");
      const fd = new FormData(e.currentTarget);
      const phone = String(fd.get("phone") ?? "");
      if (needsOtp && !codeSent) { await sendCode(phone); return; }
      setBusy(true);
      const body = { fullName: String(fd.get("fullName") ?? ""), phone, email: String(fd.get("email") ?? ""), ...(needsOtp ? { code: String(fd.get("code") ?? "") } : {}) };
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Registration failed."); setBusy(false); return; }
      try { localStorage.setItem("fuj-username", json.username); } catch { /* private mode */ }
      setDone(json);
    }}>
      {checkInNote && <p className="alert alert-ok">{checkInNote}</p>}
      <label className="label">Full name<input className="input mt-2" name="fullName" required defaultValue={defaults.name} autoComplete="name" placeholder="e.g. Grace Okafor" /></label>
      <label className="label">Phone number<input className="input mt-2" name="phone" required inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" readOnly={codeSent} onChange={() => codeSent && setCodeSent(false)} /></label>
      <label className="label">Email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-2" name="email" type="email" defaultValue={defaults.email} autoComplete="email" /></label>
      {needsOtp && codeSent && (
        <label className="label">Verification code
          <input className="input mt-2 text-center text-2xl tracking-[.5em]" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="••••••" autoFocus />
          <span className="mt-2 flex items-center justify-between text-xs font-normal text-slate-500">
            <button type="button" className="font-semibold text-slate-500 underline" onClick={() => { setCodeSent(false); setInfo(""); }}>Change number</button>
            <button type="button" className="font-semibold text-blue-600 disabled:text-slate-400" disabled={cooldown > 0 || sending} onClick={(ev) => { const f = (ev.currentTarget as HTMLButtonElement).form; void sendCode(String(new FormData(f!).get("phone") ?? "")); }}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </span>
        </label>
      )}
      {info && <p className="alert alert-ok" data-testid="otp-info">{info}</p>}
      {error && <p className="alert alert-err">{error}</p>}
      <p className="text-xs text-slate-500">We use your details only to care for you as a church family (NDPA 2023).</p>
      <button className="btn btn-primary py-3" disabled={busy || sending}>
        {needsOtp && !codeSent ? (sending ? "Sending code…" : "Send OTP") : busy ? "Creating your account…" : needsOtp ? "Verify & create my account" : "Create my account"}
      </button>
    </form>
  );
}
