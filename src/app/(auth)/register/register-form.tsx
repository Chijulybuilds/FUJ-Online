"use client";
import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";

export function RegisterForm({ defaults, checkInNote }: { defaults: { name?: string; email?: string }; checkInNote?: string }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
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
  return (
    <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      const fd = new FormData(e.currentTarget);
      const body = Object.fromEntries(["fullName", "phone", "email", "status", "gender", "birthday", "address", "howHeard"].map((k) => [k, String(fd.get(k) ?? "")]));
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Registration failed."); setBusy(false); return; }
      try { localStorage.setItem("fuj-username", json.username); } catch { /* private mode */ }
      setDone(json);
    }}>
      {checkInNote && <p className="alert alert-ok sm:col-span-2">{checkInNote}</p>}
      <label className="label sm:col-span-2">Full name<input className="input mt-2" name="fullName" required defaultValue={defaults.name} autoComplete="name" /></label>
      <label className="label">Phone number<input className="input mt-2" name="phone" required inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" /></label>
      <label className="label">Email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-2" name="email" type="email" defaultValue={defaults.email} autoComplete="email" /></label>
      <label className="label">I am<select className="input mt-2" name="status"><option value="visitor">New here / visiting</option><option value="member">Already a member</option></select></label>
      <label className="label">Gender<select className="input mt-2" name="gender"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option></select></label>
      <label className="label">Birthday <span className="font-normal text-slate-400">(optional)</span><input className="input mt-2" name="birthday" type="date" /></label>
      <label className="label">How did you hear about us?<select className="input mt-2" name="howHeard"><option value="">—</option><option>Friend or family</option><option>Social media</option><option>Online service</option><option>Walked in</option><option>Other</option></select></label>
      <label className="label sm:col-span-2">Area / address <span className="font-normal text-slate-400">(optional)</span><input className="input mt-2" name="address" autoComplete="street-address" /></label>
      <p className="text-xs text-slate-500 sm:col-span-2">We use your details only to care for you as a church family (NDPA 2023). You can ask us to update or delete them anytime.</p>
      {error && <p className="alert alert-err sm:col-span-2">{error}</p>}
      <button className="btn btn-primary sm:col-span-2" disabled={busy}>{busy ? "Creating your account…" : "Register & get my username"}</button>
    </form>
  );
}
