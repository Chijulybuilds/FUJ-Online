"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

export function AdminLoginForm() {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [show, setShow] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: fd.get("email"), password: fd.get("password"), name: fd.get("name") }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Sign-in failed."); setBusy(false); return; }
      router.push(json.redirect); router.refresh();
    }}>
      <label className="label">Admin email<input className="input mt-2" name="email" type="email" required autoComplete="username" placeholder="Admin email" /></label>
      <label className="label">Password
        <span className="relative mt-2 block">
          <input className="input pr-11" name="password" type={show ? "text" : "password"} required autoComplete="current-password" />
          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </span>
      </label>
      <label className="label">Your name <span className="font-normal text-slate-400">(recorded on what you do)</span><input className="input mt-2" name="name" placeholder="Your name" autoComplete="name" /></label>
      {error && <p className="alert alert-err">{error}</p>}
      <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? "Signing in…" : "Sign in to admin"}</button>
    </form>
  );
}
