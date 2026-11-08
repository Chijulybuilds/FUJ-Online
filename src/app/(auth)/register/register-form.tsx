"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { ADULT_AGE, ageOf, RELATIONSHIPS } from "@/lib/children";

/**
 * verified = signed in with Google already. otp = require an SMS code (off by default: REGISTRATION_OTP=true).
 * Without OTP, the person is confirmed for free at their first in-person check-in.
 * Under 18 (from the birthday): they say whether the phone number is their own or a parent's / guardian's —
 * children without a phone register with their parent's number.
 */
export function RegisterForm({ defaults, checkInNote, verified = false, otp = false }: { defaults: { name?: string; email?: string; phone?: string; address?: string }; checkInNote?: string; verified?: boolean; otp?: boolean }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [info, setInfo] = useState(""); const [sending, setSending] = useState(false);
  const [codeSent, setCodeSent] = useState(false); const [cooldown, setCooldown] = useState(0);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown((c) => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);
  const [age, setAge] = useState<number | null>(null);
  const [phoneOwner, setPhoneOwner] = useState<"" | "self" | "parent">("");
  const minor = age !== null && age >= 0 && age < ADULT_AGE;
  const parentsPhone = minor && phoneOwner === "parent";
  const [done, setDone] = useState<{ username: string; name: string; checkedIn: boolean; firstTimer?: boolean; partner?: boolean; parentsPhone?: boolean; guardianName?: string | null } | null>(null);
  if (done) {
    return (
      <div className="text-center" data-testid="register-success">
        <div className="success-ring mx-auto"><CheckCircle2 size={40} /></div>
        <h1 className="mt-5 text-2xl font-bold">Welcome to the family, {done.name.split(" ")[0]}!</h1>
        {done.checkedIn && <p className="alert alert-ok mt-4">You&apos;re checked in for today&apos;s service. 🎉</p>}
        {done.firstTimer && <p className="mt-3 text-sm text-slate-600">We&apos;re so glad you came! Someone from our team will reach out to you this week. 🤗</p>}
        {done.partner && <p className="mt-3 text-sm text-slate-600" data-testid="partner-thanks">💛 Thank you for choosing to partner with us — our partnership team will be in touch.</p>}
        <p className="mt-5 text-sm text-slate-500">Your check-in username is</p>
        <p className="username-badge mt-2 text-3xl font-extrabold text-blue-600" data-testid="new-username">{done.username}</p>
        <div className="mt-3 flex justify-center"><CopyButton value={done.username} label="Copy username" /></div>
        <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">📸 Screenshot or save it. Next Sunday, just scan the QR on the screen and type this username. No smartphone? Tell an usher your name at the door.</p>
        {done.parentsPhone && <p className="mt-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600" data-testid="parents-phone-note">📱 You registered with {done.guardianName ? <b>{done.guardianName}</b> : "your parent"}&apos;s phone number. Sign in with your username and that number — messages for you come to their phone.</p>}
        <Link href="/member" className="btn btn-primary mt-6 w-full">Go to my portal</Link>
      </div>
    );
  }
  const needsOtp = otp && !verified;
  async function sendCode(phone: string, parents = false) {
    setError(""); setInfo(""); setSending(true);
    const res = await fetch("/api/otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, parentsPhone: parents }) });
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
      if (needsOtp && !codeSent) { await sendCode(phone, parentsPhone); return; }
      setBusy(true);
      const body = {
        fullName: String(fd.get("fullName") ?? ""), phone, email: String(fd.get("email") ?? ""),
        birthday: String(fd.get("birthday") ?? ""), address: String(fd.get("address") ?? ""),
        firstTimer: String(fd.get("firstTimer") ?? ""), partner: !minor && fd.get("partner") === "on",
        ...(minor ? { phoneOwner, guardianName: String(fd.get("guardianName") ?? ""), relationship: String(fd.get("relationship") ?? ""), guardianConsent: fd.get("guardianConsent") === "on" } : {}),
        ...(needsOtp ? { code: String(fd.get("code") ?? "") } : {})
      };
      const res = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? "Registration failed."); setBusy(false); return; }
      try { localStorage.setItem("fuj-username", json.username); } catch { /* private mode */ }
      setDone(json);
    }}>
      {checkInNote && <p className="alert alert-ok">{checkInNote}</p>}
      <label className="label">Full name<input className="input mt-2" name="fullName" required defaultValue={defaults.name} autoComplete="name" placeholder="Your full name" /></label>
      <label className="label">Phone number{minor && <span className="hint">{parentsPhone ? "Your parent's or guardian's number" : "Under 18 with no phone? Use your parent's or guardian's number"}</span>}<input className="input mt-2" name="phone" required inputMode="tel" autoComplete="tel" placeholder="080X XXX XXXX" defaultValue={defaults.phone} readOnly={codeSent} onChange={() => codeSent && setCodeSent(false)} /></label>
      <label className="label">Email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-2" name="email" type="email" defaultValue={defaults.email} autoComplete="email" /></label>
      <label className="label">Birthday<input className="input mt-2" name="birthday" type="date" required min="1900-01-01" autoComplete="bday" onChange={(e) => setAge(ageOf(e.target.value))} /></label>
      {minor && (
        <div className="minor-box" data-testid="under-18">
          <p className="text-sm"><b>🎈 You&apos;re under 18 — welcome!</b> Whose phone number did you enter?</p>
          <div className="choice-grid">
            <label className="choice"><input type="radio" name="phoneOwner" value="self" required checked={phoneOwner === "self"} onChange={() => setPhoneOwner("self")} /><span>📱 My own phone</span><small>I have my own number</small></label>
            <label className="choice"><input type="radio" name="phoneOwner" value="parent" required checked={phoneOwner === "parent"} onChange={() => setPhoneOwner("parent")} /><span>👨‍👩‍👧 My parent&apos;s or guardian&apos;s</span><small>I don&apos;t have a phone</small></label>
          </div>
          {parentsPhone && (
            <div className="grid gap-3">
              <label className="label">Parent or guardian&apos;s full name<input className="input mt-2" name="guardianName" required autoComplete="off" placeholder="e.g. Funke Adeyemi" /></label>
              <label className="label">They are my<select className="input mt-2" name="relationship" required defaultValue=""><option value="" disabled>Choose…</option>{RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
              <p className="text-xs text-slate-500">You&apos;ll sign in with your own username and this number. Messages for you go to their phone, and you&apos;re linked to them if they&apos;re registered.</p>
            </div>
          )}
          {phoneOwner && (
            <label className="checkbox"><input type="checkbox" name="guardianConsent" required /> <span>My parent or guardian knows I&apos;m registering with FlagUpJesus</span></label>
          )}
        </div>
      )}
      <label className="label">Home address<textarea className="input mt-2 min-h-[4.5rem]" name="address" required minLength={5} maxLength={300} rows={2} autoComplete="street-address" placeholder="House number, street, area, city" defaultValue={defaults.address} /></label>
      <fieldset className="label" data-testid="first-timer-question">
        <legend>Is this your first time worshipping with FlagUpJesus?</legend>
        <div className="choice-grid">
          <label className="choice"><input type="radio" name="firstTimer" value="yes" required /><span>🎉 Yes, it&apos;s my first time</span><small>Welcome! We&apos;d love to get to know you.</small></label>
          <label className="choice"><input type="radio" name="firstTimer" value="no" required /><span>🙌 No, I&apos;ve been here before</span><small>I&apos;m already part of the family.</small></label>
        </div>
      </fieldset>
      {!minor && (
        <label className="partner-opt">
          <input type="checkbox" name="partner" />
          <span><b>💛 I&apos;d like to become a FUJ Partner</b><small>Partners support the work of the ministry — outreaches, missions and the gospel — with regular giving. Tick this and our partnership team will reach out to you.</small></span>
        </label>
      )}
      {needsOtp && codeSent && (
        <label className="label">Verification code
          <input className="input mt-2 text-center text-2xl tracking-[.5em]" name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="••••••" autoFocus />
          <span className="mt-2 flex items-center justify-between text-xs font-normal text-slate-500">
            <button type="button" className="font-semibold text-slate-500 underline" onClick={() => { setCodeSent(false); setInfo(""); }}>Change number</button>
            <button type="button" className="font-semibold text-blue-600 disabled:text-slate-400" disabled={cooldown > 0 || sending} onClick={(ev) => { const f = (ev.currentTarget as HTMLButtonElement).form; void sendCode(String(new FormData(f!).get("phone") ?? ""), parentsPhone); }}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </span>
        </label>
      )}
      {info && <p className="alert alert-ok" data-testid="otp-info">{info}</p>}
      {error && <p className="alert alert-err">{error}</p>}
      <p className="text-xs text-slate-500">We use your details only to care for you as a church family (NDPA 2023).</p>
      <button className="btn btn-primary py-3" disabled={busy || sending}>
        {needsOtp && !codeSent ? (sending ? "Sending code…" : "Send OTP") : busy ? "Creating your account…" : needsOtp ? "Verify & create my account" : "Register & get my username"}
      </button>
    </form>
  );
}
