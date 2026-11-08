"use client";
import { useRef, useState } from "react";
import { CheckCircle2, UserPlus } from "lucide-react";
import { CopyButton } from "@/components/shared/copy-button";
import { RELATIONSHIPS } from "@/lib/children";

type Done = { username: string; name: string; checkedIn: boolean; guardianLinked: boolean; guardianName: string };
type Guardian = { guardianName: string; relationship: string; phone: string; email: string; address: string };

/**
 * "My child" registration: for children who don't have a phone. The parent's / guardian's number is used; the child
 * gets their own flag username for check-in. After registering, the parent can add another child without retyping
 * their own details.
 */
export function ChildRegisterForm({ checkInNote, onRegisterSelf }: { checkInNote?: string; onRegisterSelf?: (g: Guardian) => void }) {
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<Done | null>(null);
  const [registered, setRegistered] = useState<Done[]>([]);
  const [guardian, setGuardian] = useState<Guardian | null>(null);
  const formKey = useRef(0);

  if (done) {
    const first = done.name.split(" ")[0];
    return (
      <div className="text-center" data-testid="child-register-success">
        <div className="success-ring mx-auto"><CheckCircle2 size={40} /></div>
        <h1 className="mt-5 text-2xl font-bold">Welcome to the family, {first}! 🎈</h1>
        {done.checkedIn && <p className="alert alert-ok mt-4">{first} is checked in for today&apos;s service. 🎉</p>}
        <p className="mt-5 text-sm text-slate-500">{first}&apos;s check-in username is</p>
        <p className="username-badge mt-2 text-3xl font-extrabold text-blue-600" data-testid="child-username">{done.username}</p>
        <div className="mt-3 flex justify-center"><CopyButton value={done.username} label="Copy username" /></div>
        <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-sm text-slate-600">
          <p>📸 Save this username. Each Sunday, scan the QR code and type it — or check yourself in first and tap <b>Check in your children</b>.</p>
          <p>📱 Messages for {first} come to <b>your</b> phone. {first} can open their own portal with this username and your phone number.</p>
          {done.guardianLinked && <p data-testid="guardian-linked">✅ Linked to <b>{done.guardianName}</b>&apos;s member record.</p>}
        </div>
        {registered.length > 1 && <p className="mt-4 text-sm text-slate-500">Registered today: {registered.map((r) => r.name.split(" ")[0]).join(", ")}</p>}
        <div className="mt-6 grid gap-2">
          <button type="button" className="btn btn-primary" onClick={() => { formKey.current++; setDone(null); setError(""); }}><UserPlus size={16} /> Register another child</button>
          {!done.guardianLinked && guardian && onRegisterSelf && <button type="button" className="btn btn-secondary" onClick={() => onRegisterSelf(guardian)}>Register yourself too</button>}
        </div>
      </div>
    );
  }

  return (
    <form key={formKey.current} className="mt-6 grid gap-4" data-testid="child-register-form" onSubmit={async (e) => {
      e.preventDefault(); setError(""); setBusy(true);
      const fd = new FormData(e.currentTarget);
      const g: Guardian = { guardianName: String(fd.get("guardianName") ?? ""), relationship: String(fd.get("relationship") ?? ""), phone: String(fd.get("phone") ?? ""), email: String(fd.get("email") ?? ""), address: String(fd.get("address") ?? "") };
      const body = {
        fullName: String(fd.get("fullName") ?? ""), birthday: String(fd.get("birthday") ?? ""), gender: String(fd.get("gender") ?? ""),
        careNotes: String(fd.get("careNotes") ?? ""), firstTimer: String(fd.get("firstTimer") ?? ""), consent: fd.get("consent") === "on", ...g
      };
      const res = await fetch("/api/register/child", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({}));
      setBusy(false);
      if (!res.ok) { setError(json.error ?? "Registration failed."); return; }
      setGuardian(g); setRegistered((r) => [...r, json]); setDone(json);
    }}>
      {checkInNote && <p className="alert alert-ok">{checkInNote.replace("You'll be", "Your child will be")}</p>}
      <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-600">🧒 For children who don&apos;t have a phone. Use <b>your</b> phone number — your child gets their own username for check-in, and messages come to you.</p>

      <p className="text-xs font-bold tracking-[.12em] text-slate-500">YOUR CHILD</p>
      <label className="label">Child&apos;s full name<input className="input mt-2" name="fullName" required autoComplete="off" placeholder="e.g. Tobi Adeyemi" /></label>
      <label className="label">Child&apos;s birthday<input className="input mt-2" name="birthday" type="date" required min="2000-01-01" /></label>
      <fieldset className="label">
        <legend>Boy or girl? <span className="font-normal text-slate-400">(optional)</span></legend>
        <div className="choice-grid">
          <label className="choice"><input type="radio" name="gender" value="male" /><span>👦 Boy</span></label>
          <label className="choice"><input type="radio" name="gender" value="female" /><span>👧 Girl</span></label>
        </div>
      </fieldset>
      <label className="label">Anything we should know? <span className="font-normal text-slate-400">(optional)</span><span className="hint">Allergies, medical needs, who may pick them up… Only the children&apos;s church team sees this.</span><textarea className="input mt-2 min-h-[4rem]" name="careNotes" maxLength={500} rows={2} placeholder="e.g. Allergic to peanuts" /></label>
      <fieldset className="label">
        <legend>Is this their first time at FlagUpJesus?</legend>
        <div className="choice-grid">
          <label className="choice"><input type="radio" name="firstTimer" value="yes" required /><span>🎉 Yes, first time</span></label>
          <label className="choice"><input type="radio" name="firstTimer" value="no" required /><span>🙌 No, been before</span></label>
        </div>
      </fieldset>

      <p className="mt-1 text-xs font-bold tracking-[.12em] text-slate-500">PARENT OR GUARDIAN</p>
      <label className="label">Your full name<input className="input mt-2" name="guardianName" required autoComplete="name" defaultValue={guardian?.guardianName} placeholder="Parent or guardian" /></label>
      <label className="label">You are the child&apos;s<select className="input mt-2" name="relationship" required defaultValue={guardian?.relationship ?? ""}><option value="" disabled>Choose…</option>{RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
      <label className="label">Your phone number<span className="hint">Your child signs in with their username and this number. If you&apos;re registered with it, we link your child to you.</span><input className="input mt-2" name="phone" required inputMode="tel" autoComplete="tel" defaultValue={guardian?.phone} placeholder="080X XXX XXXX" /></label>
      <label className="label">Your email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-2" name="email" type="email" autoComplete="email" defaultValue={guardian?.email} /></label>
      <label className="label">Home address<textarea className="input mt-2 min-h-[4rem]" name="address" required minLength={5} maxLength={300} rows={2} autoComplete="street-address" defaultValue={guardian?.address} placeholder="House number, street, area, city" /></label>
      <label className="partner-opt">
        <input type="checkbox" name="consent" required />
        <span><b>I&apos;m this child&apos;s parent or guardian</b><small>and I agree to FlagUpJesus keeping these details to care for them (NDPA 2023).</small></span>
      </label>
      {error && <p className="alert alert-err">{error}</p>}
      <button className="btn btn-primary py-3" disabled={busy}>{busy ? "Registering…" : "Register my child"}</button>
    </form>
  );
}
