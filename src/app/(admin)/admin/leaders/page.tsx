import Link from "next/link";
import { Download, Mail, MessageCircle, Send, UserPlus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { leaderUnits, listLeaders, type LeaderRow } from "@/lib/repo/leaders";
import { addLeaderAction, removeLeaderAction, updateLeaderAction } from "@/lib/actions/admin";

export const dynamic = "force-dynamic";

const messageHref = (unit?: string) => `/admin/messaging?audience=${encodeURIComponent(unit ? `leaders:${unit}` : "leaders")}`;

function LeaderFields({ leader }: { leader?: LeaderRow }) {
  return (
    <>
      <label className="label">Full name<input className="input mt-1" name="full_name" required defaultValue={leader?.person.full_name} placeholder="Leader's full name" /></label>
      <label className="label">Unit<span className="hint">The unit or ministry they lead</span><input className="input mt-1" name="unit" required list="leader-units" defaultValue={leader?.unit} placeholder="e.g. Choir" maxLength={60} /></label>
      <label className="label">WhatsApp number<span className="hint">Broadcasts go here on WhatsApp (SMS if they&apos;re not on WhatsApp)</span><input className="input mt-1" name="phone" required inputMode="tel" defaultValue={leader?.person.phone} placeholder="0803 000 0000" /></label>
      <label className="label">Email <span className="font-normal text-slate-400">(optional)</span><input className="input mt-1" name="email" type="email" defaultValue={leader?.person.email ?? ""} placeholder="name@example.com" /></label>
    </>
  );
}

export default async function LeadersPage({ searchParams }: { searchParams: Promise<{ unit?: string; removed?: string }> }) {
  const admin = await requireAdmin("leaders");
  const { unit = "", removed } = await searchParams;
  let data: { leaders: LeaderRow[]; units: { unit: string; count: number }[] };
  try {
    const [leaders, units] = await Promise.all([listLeaders(), leaderUnits()]);
    data = { leaders, units };
  } catch (error) {
    console.error("leaders unavailable", error);
    return (
      <>
        <PageHeading title="Leaders" description="Add the church's leaders so you can message them all at once." />
        <div className="alert alert-warn" data-testid="leaders-db-update">
          The database needs a one-time update before leaders can be saved. In Supabase, open <b>SQL Editor → New query</b>, paste everything from
          <code className="mx-1">supabase/setup.sql</code>and click <b>Run</b>, then refresh this page.
        </div>
      </>
    );
  }
  const { leaders, units } = data;
  const activeUnit = units.find((u) => u.unit.toLowerCase() === unit.toLowerCase())?.unit ?? "";
  const shown = activeUnit ? leaders.filter((l) => l.unit.toLowerCase() === activeUnit.toLowerCase()) : leaders;
  const canMessage = can(admin.role, "messaging");

  return (
    <>
      <PageHeading
        title="Leaders"
        description="Admins add the church's leaders here — leaders don't sign up themselves. Message every leader, or one unit's leaders, on WhatsApp, SMS, email and in the app."
        action={leaders.length ? (
          <>
            <a href="/api/admin/export?type=leaders_vcf" className="btn btn-secondary" title="Import into the church phone to make a WhatsApp broadcast list for free"><Download size={16} /> Leaders&apos; contacts (.vcf)</a>
            {canMessage && <Link href={messageHref()} className="btn btn-primary" data-testid="message-all-leaders"><Send size={16} /> Message all leaders</Link>}
          </>
        ) : undefined}
      />
      {removed && <p className="alert alert-ok mb-5" role="status">{removed.slice(0, 80)} was removed from the leaders list. They&apos;re still in Members.</p>}
      <datalist id="leader-units">{units.map((u) => <option key={u.unit} value={u.unit} />)}</datalist>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]">
        <section className="card h-fit p-6">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><UserPlus size={18} className="text-[var(--accent,#c8102e)]" /> Add a leader</h2>
          <p className="mb-4 text-xs text-slate-500">If they&apos;ve already registered with this number, their member record is linked automatically.</p>
          <ActionForm action={addLeaderAction} className="grid gap-4" resetOnSuccess>
            <LeaderFields />
            <div><SubmitButton pendingText="Adding…">Add leader</SubmitButton></div>
          </ActionForm>
        </section>

        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <h2 className="font-bold">{activeUnit ? `${activeUnit} leaders` : "All leaders"} <span className="text-sm font-normal text-slate-500">({shown.length})</span></h2>
            {activeUnit && canMessage && <Link href={messageHref(activeUnit)} className="btn btn-secondary btn-sm" data-testid="message-unit-leaders"><Send size={14} /> Message {activeUnit} leaders</Link>}
          </div>
          {units.length > 0 && (
            <div className="tabs flex-wrap border-b border-slate-100 px-5 py-3">
              <Link href="/admin/leaders" className={`tab ${!activeUnit ? "active" : ""}`}>All ({leaders.length})</Link>
              {units.map((u) => <Link key={u.unit} href={`/admin/leaders?unit=${encodeURIComponent(u.unit)}`} className={`tab ${activeUnit === u.unit ? "active" : ""}`}>{u.unit} ({u.count})</Link>)}
            </div>
          )}
          <ul className="divide-y divide-slate-100" data-testid="leaders-list">
            {shown.map((l) => {
              const wa = l.person.normalized_phone.replace(/^\+/, "");
              return (
                <li key={l.id} className="p-5" data-testid="leader-row">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/admin/members/${l.person.id}`} className="font-semibold hover:text-[var(--accent,#c8102e)]">{l.person.full_name}</Link>
                      <span className="pill pill-blue ml-2 align-middle">{l.unit}</span>
                      <p className="mt-1 text-sm text-slate-500">{l.person.phone}{l.person.whatsapp === "no" ? " · not on WhatsApp (gets SMS)" : ""}{l.person.email ? ` · ${l.person.email}` : ""}</p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}`} aria-label={`WhatsApp ${l.person.full_name}`}><MessageCircle size={14} /> WhatsApp</a>
                      {l.person.email && <a className="btn btn-secondary btn-sm" href={`mailto:${l.person.email}`} aria-label={`Email ${l.person.full_name}`}><Mail size={14} /></a>}
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-slate-600">Edit or remove</summary>
                    <ActionForm action={updateLeaderAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                      <input type="hidden" name="id" value={l.id} />
                      <LeaderFields leader={l} />
                      <div className="sm:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
                    </ActionForm>
                    <ActionForm action={removeLeaderAction} className="mt-3">
                      <input type="hidden" name="id" value={l.id} />
                      <SubmitButton className="btn btn-ghost btn-sm text-red-600" pendingText="Removing…">Remove from leaders</SubmitButton>
                    </ActionForm>
                  </details>
                </li>
              );
            })}
            {!shown.length && <li className="p-6 text-center text-sm text-slate-500">No leaders yet. Add your first leader with the form.</li>}
          </ul>
        </section>
      </div>
    </>
  );
}
