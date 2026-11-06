"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, QrCode, ScanLine, UserPlus } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type Status = { ticket: { service: { title: string; starts_at: string }; expiresAt: number } | null; member: { name: string; username: string | null } | null; checkedIn: { name: string; at: string } | null };
type Phase = "loading" | "need-scan" | "ready" | "done" | "error";

export function CheckInFlow() {
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("loading");
  const [status, setStatus] = useState<Status | null>(null);
  const [username, setUsername] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<{ firstName: string; status: string; service: string; username: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    // Run once: replacing the URL below updates searchParams, which must not re-trigger the scan.
    if (started.current) return;
    started.current = true;
    const run = async () => {
      try { setUsername(localStorage.getItem("fuj-username") ?? ""); } catch { /* ignore */ }
      const token = params.get("t") ?? params.get("token");
      if (token) {
        const res = await fetch("/api/check-in/scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
        window.history.replaceState(null, "", "/check-in");
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setMessage(j.error ?? "This QR code could not be used.");
          setPhase("error");
          return;
        }
      }
      const s = (await (await fetch("/api/check-in/status", { cache: "no-store" })).json()) as Status;
      setStatus(s);
      if (s.checkedIn) { setResult({ firstName: s.checkedIn.name, status: "already", service: s.ticket?.service.title ?? "", username: s.member?.username ?? null }); setPhase("done"); }
      else setPhase(s.ticket ? "ready" : "need-scan");
    };
    run().catch(() => { setMessage("Network problem. Please scan again."); setPhase("error"); });
  }, [params]);

  async function confirm(useSession: boolean) {
    setBusy(true); setMessage("");
    const res = await fetch("/api/check-in/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(useSession ? {} : { username }) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setMessage(j.error ?? "Check-in failed.");
      if (j.code === "no_ticket" || j.code === "closed") setPhase("need-scan");
      return;
    }
    try { if (j.username) localStorage.setItem("fuj-username", j.username); } catch { /* ignore */ }
    setResult(j); setPhase("done");
  }

  return (
    <main className="checkin-bg flex min-h-screen items-center justify-center p-5">
      <div className="card w-full max-w-md p-8 lp-fade">
        <div className="mb-6 flex items-center justify-between"><Link href="/" aria-label="FlagUpJesus home"><BrandLogo className="h-12 w-[72px] object-contain" /></Link><ThemeToggle /></div>

        {phase === "loading" && <p className="py-10 text-center text-sm text-slate-500">Checking your QR code…</p>}

        {phase === "error" && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-600"><ScanLine /></div>
            <h1 className="mt-4 text-xl font-bold">Let&apos;s try that again</h1>
            <p className="alert alert-warn mt-4" data-testid="checkin-error">{message}</p>
            <p className="mt-4 text-sm text-slate-500">Point your camera at the QR code on the screen — it refreshes every 20 seconds.</p>
          </div>
        )}

        {phase === "need-scan" && (
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><QrCode /></div>
            <h1 className="mt-4 text-2xl font-bold">Church check-in</h1>
            {message && <p className="alert alert-warn mt-4">{message}</p>}
            <p className="mt-3 text-sm text-slate-500">Scan the live QR code displayed in the auditorium with your phone camera to check in.</p>
            <Link href="/" className="btn btn-secondary mt-6">Back home</Link>
          </div>
        )}

        {phase === "ready" && status?.ticket && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600">You scanned in to</p>
            <h1 className="mt-1 text-2xl font-bold" data-testid="checkin-service">{status.ticket.service.title}</h1>
            {status.member && (
              <button className="btn btn-primary mt-6 w-full py-3" disabled={busy} onClick={() => confirm(true)}>Check in as {status.member.name.split(" ")[0]}</button>
            )}
            <form className="mt-6 space-y-3" onSubmit={(e) => { e.preventDefault(); void confirm(false); }}>
              <label className="label">{status.member ? "Or enter a username" : "Enter your username"}
                <input className="input username-badge mt-2 text-lg" value={username} onChange={(e) => setUsername(e.target.value)} required autoCapitalize="none" autoCorrect="off" spellCheck={false} placeholder="flagyourname123" aria-label="Username" />
              </label>
              {message && <p className="alert alert-err" data-testid="checkin-message">{message}</p>}
              <button className={`btn ${status.member ? "btn-secondary" : "btn-primary"} w-full py-3`} disabled={busy}>{busy ? "Checking in…" : "Check in"}</button>
            </form>
            <div className="mt-6 rounded-2xl border border-dashed border-slate-200 p-4 text-center">
              <p className="text-sm font-semibold">First time here? Welcome! 👋</p>
              <p className="mt-1 text-xs text-slate-500">Register in a minute and get your own flag username.</p>
              <Link href="/register" className="btn btn-secondary mt-3"><UserPlus size={15} /> Register now</Link>
            </div>
          </div>
        )}

        {phase === "done" && result && (
          <div className="text-center" data-testid="checkin-done">
            <div className="success-ring mx-auto"><CheckCircle2 size={42} /></div>
            <h1 className="mt-5 text-2xl font-bold">{result.status === "already" ? `You're already checked in, ${result.firstName}` : `Welcome, ${result.firstName}!`}</h1>
            <p className="mt-2 text-sm text-slate-500">{result.status === "already" ? "No need to check in again for this service." : `You're checked in to ${result.service}. Enjoy the service! 🙌`}</p>
            <div className="mt-6 grid gap-2">
              <Link href="/member" className="btn btn-primary">Open my portal</Link>
              <Link href="/member/prayer-requests" className="btn btn-secondary">Send a prayer request</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
