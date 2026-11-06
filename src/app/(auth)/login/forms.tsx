"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

async function post(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Something went wrong.");
  return json as { redirect: string };
}

export function MemberLoginForm() {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      const fd = new FormData(e.currentTarget);
      try { const r = await post("/api/auth/member", { username: fd.get("username"), phone: fd.get("phone") }); router.push(r.redirect); router.refresh(); }
      catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed."); setBusy(false); }
    }}>
      <label className="label">Username<input className="input mt-2 username-badge" name="username" required autoCapitalize="none" autoComplete="username" placeholder="flaggrace101" /></label>
      <label className="label">Phone number<input className="input mt-2" name="phone" required inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" /></label>
      {error && <p className="alert alert-err">{error}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form>
  );
}

/** Development stand-in for Google sign-in (disabled in production). */
export function DevLoginForm({ intent, defaultEmail }: { intent: "admin" | "member" | "register"; defaultEmail?: string }) {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <details className="rounded-xl border border-dashed border-slate-200 p-4">
      <summary className="cursor-pointer text-xs font-semibold text-slate-500">Developer sign-in (no Google)</summary>
      <form className="mt-3 space-y-3" onSubmit={async (e) => {
        e.preventDefault(); setError(""); setBusy(true);
        const fd = new FormData(e.currentTarget);
        try { const r = await post("/api/auth/dev", { email: fd.get("email"), name: fd.get("name"), intent }); router.push(r.redirect); router.refresh(); }
        catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed."); setBusy(false); }
      }}>
        <input className="input" name="email" type="email" required placeholder="email" aria-label="Email" defaultValue={defaultEmail ?? (intent === "admin" ? "admin@flagupjesus.local" : "")} />
        {intent !== "admin" && <input className="input" name="name" placeholder="Full name" aria-label="Name" />}
        {error && <p className="alert alert-err">{error}</p>}
        <button className="btn btn-secondary w-full" disabled={busy}>{busy ? "…" : "Continue"}</button>
        {intent === "admin" && <p className="text-[11px] text-slate-400">Demo staff roles: admin@, pastor@, care@, finance@, usher@flagupjesus.local</p>}
      </form>
    </details>
  );
}
