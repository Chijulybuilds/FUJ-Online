"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Search, UserPlus } from "lucide-react";

type Row = { id: string; name: string; username: string | null; phone: string; status: string; checkedInAt: string | null };
const time = (v: string) => new Date(v).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" });

export function Desk({ serviceId, serviceTitle }: { serviceId: string; serviceTitle: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ ok: boolean; text: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async (term: string) => {
    const res = await fetch(`/api/admin/desk?serviceId=${serviceId}&q=${encodeURIComponent(term)}`, { cache: "no-store" });
    if (!res.ok) return;
    const json = await res.json(); setRows(json.people); setTotal(json.total);
  }, [serviceId]);

  useEffect(() => { const t = setTimeout(() => void load(q), 180); return () => clearTimeout(t); }, [q, load]);

  async function checkIn(body: Record<string, string>) {
    setBusy(body.personId ?? "new"); setFlash(null);
    const res = await fetch("/api/admin/desk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ serviceId, ...body }) });
    const json = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) { setFlash({ ok: false, text: json.error ?? "Check-in failed." }); return false; }
    const first = json.person.name.split(" ")[0];
    setFlash({ ok: true, text: json.status === "already" ? `${json.person.name} was already checked in.` : json.created ? `Welcome ${first}! Added as a first-timer (username ${json.person.username}) and checked in.` : `${json.person.name} checked in ✓` });
    setQ(""); input.current?.focus(); await load("");
    return true;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <section className="card p-6">
        <div className="flex items-center justify-between gap-3"><h2 className="font-bold">{serviceTitle}</h2><span className="pill pill-green" data-testid="desk-total">{total} checked in</span></div>
        <div className="relative mt-4">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input ref={input} className="input py-4 pl-11 text-lg" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a name, username or phone…" aria-label="Search member" autoFocus />
        </div>
        {flash && <p role="status" className={`alert mt-4 ${flash.ok ? "alert-ok" : "alert-err"}`}>{flash.text}</p>}
        <p className="mb-2 mt-5 text-xs font-bold uppercase tracking-widest text-slate-400">{q ? "Matches" : "Checked in so far"}</p>
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 py-3" data-testid="desk-row">
              <div className="min-w-0"><p className="truncate font-semibold">{r.name}</p><p className="text-xs text-slate-500">{r.username} · {r.phone} · {r.status}</p></div>
              {r.checkedInAt
                ? <span className="pill pill-green whitespace-nowrap"><Check size={12} className="mr-1" /> {time(r.checkedInAt)}</span>
                : <button className="btn btn-primary btn-sm whitespace-nowrap" disabled={busy === r.id} onClick={() => checkIn({ personId: r.id })}>{busy === r.id ? "…" : "Check in"}</button>}
            </li>
          ))}
          {!rows.length && <li className="py-6 text-center text-sm text-slate-500">{q ? "No one matches. Add them as a first-timer →" : "No one checked in yet."}</li>}
        </ul>
      </section>
      <section className="card h-fit p-6">
        <h2 className="flex items-center gap-2 font-bold"><UserPlus size={18} className="text-blue-600" /> First-timer?</h2>
        <p className="mt-1 text-xs text-slate-500">Add them in seconds — they get a flag username and a welcome follow-up task.</p>
        <form className="mt-4 space-y-3" onSubmit={async (e) => {
          e.preventDefault(); setAdding(true);
          const fd = new FormData(e.currentTarget); const form = e.currentTarget;
          const ok = await checkIn({ fullName: String(fd.get("fullName")), phone: String(fd.get("phone")) });
          setAdding(false); if (ok) form.reset();
        }}>
          <input className="input" name="fullName" required placeholder="Full name" aria-label="First-timer full name" defaultValue={q && !rows.length ? q : undefined} key={rows.length ? "x" : q} />
          <input className="input" name="phone" required inputMode="tel" placeholder="Phone number" aria-label="First-timer phone" />
          <button className="btn btn-secondary w-full" disabled={adding}>{adding ? "Adding…" : "Add & check in"}</button>
        </form>
      </section>
    </div>
  );
}
