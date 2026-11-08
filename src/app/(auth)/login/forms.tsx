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
  const [mode, setMode] = useState<"phone" | "password">("phone");
  const [forgot, setForgot] = useState(false);
  return (
    <div className="space-y-4">
      <div className="login-mode" role="tablist" aria-label="How do you want to sign in?">
        <button type="button" role="tab" aria-selected={mode === "phone"} className={mode === "phone" ? "on" : ""} onClick={() => { setMode("phone"); setError(""); }}>📱 Phone number</button>
        <button type="button" role="tab" aria-selected={mode === "password"} className={mode === "password" ? "on" : ""} onClick={() => { setMode("password"); setError(""); }}>🔐 Password</button>
      </div>
      {mode === "password" && forgot ? (
        <div>
          <p className="text-sm text-slate-500">Enter your username or email and we&apos;ll email you a link to set a new password.</p>
          <ForgotPasswordForm />
          <button type="button" className="mt-3 text-sm font-semibold text-blue-600" onClick={() => setForgot(false)}>← Back to sign in</button>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault(); setError(""); setBusy(true);
          const fd = new FormData(e.currentTarget);
          const body = mode === "phone" ? { username: fd.get("username"), phone: fd.get("phone") } : { login: fd.get("login"), password: fd.get("password") };
          try { const r = await post("/api/auth/member", body); router.push(r.redirect); router.refresh(); }
          catch (err) { setError(err instanceof Error ? err.message : "Sign-in failed."); setBusy(false); }
        }}>
          {mode === "phone" ? (
            <>
              <label className="label">Username<input className="input mt-2 username-badge" name="username" required autoCapitalize="none" autoComplete="username" placeholder="flagyourname123" /></label>
              <label className="label">Phone number<input className="input mt-2" name="phone" required inputMode="tel" autoComplete="tel" placeholder="080X XXX XXXX" /></label>
            </>
          ) : (
            <>
              <label className="label">Username or email<input className="input mt-2" name="login" required autoCapitalize="none" autoComplete="username" placeholder="flagyourname123" /></label>
              <label className="label">Password<input className="input mt-2" name="password" type="password" required autoComplete="current-password" /></label>
            </>
          )}
          {error && <p className="alert alert-err">{error}</p>}
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
          {mode === "password" && <p className="text-center text-sm"><button type="button" className="font-semibold text-blue-600" onClick={() => setForgot(true)}>Forgot your password?</button> <span className="text-slate-400">· No password yet? Use your phone number.</span></p>}
        </form>
      )}
    </div>
  );
}

/** "Forgot password" — emails a link to set a new one (the answer never says whether the account exists). */
export function ForgotPasswordForm() {
  const [sent, setSent] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  if (sent) return <p className="alert alert-ok mt-3" data-testid="forgot-sent">{sent}</p>;
  return (
    <form className="mt-3 space-y-3" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      const res = await fetch("/api/auth/password/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: new FormData(e.currentTarget).get("login") }) });
      const json = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) { setError(json.error ?? "Something went wrong."); return; }
      setSent(json.message);
    }}>
      <label className="label">Username or email<input className="input mt-2" name="login" required autoCapitalize="none" autoComplete="username" /></label>
      {error && <p className="alert alert-err">{error}</p>}
      <button className="btn btn-secondary w-full" disabled={busy}>{busy ? "Sending…" : "Email me a link"}</button>
    </form>
  );
}

/** The "Set my password" page form (token from the email link). */
export function SetPasswordForm({ token, username }: { token: string; username: string }) {
  const router = useRouter();
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  return (
    <form className="mt-5 space-y-4" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      const fd = new FormData(e.currentTarget);
      const res = await fetch("/api/auth/password/set", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: fd.get("password"), confirm: fd.get("confirm") }) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Couldn't set your password."); setBusy(false); return; }
      router.push(json.redirect); router.refresh();
    }}>
      <input type="hidden" name="username" value={username} autoComplete="username" />
      <label className="label">New password<span className="hint">At least 8 characters</span><input className="input mt-2" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
      <label className="label">Type it again<input className="input mt-2" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></label>
      {error && <p className="alert alert-err">{error}</p>}
      <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? "Saving…" : "Set my password"}</button>
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
        <input className="input" name="email" type="email" required placeholder="email" aria-label="Email" defaultValue={defaultEmail ?? ""} />
        {intent !== "admin" && <input className="input" name="name" placeholder="Full name" aria-label="Name" />}
        {error && <p className="alert alert-err">{error}</p>}
        <button className="btn btn-secondary w-full" disabled={busy}>{busy ? "…" : "Continue"}</button>
      </form>
    </details>
  );
}
