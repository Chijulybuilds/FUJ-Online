import Link from "next/link";
import type { ReactNode } from "react";
import { Check, MessageCircle, Phone, PhoneOff, Send, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { listFirstTimers, nextStep, SIMPLE_STATUSES, simpleStatus, type FirstTimerRow, type SimpleStatus } from "@/lib/repo/first-timers";
import { getSettings } from "@/lib/repo/settings";
import { deliveredVia, followUpChannels } from "@/lib/repo/contact-logs";
import { firstTimerQuickAction, runFirstTimerAction } from "@/lib/actions/admin";
import { firstName } from "@/lib/identity-utils";
import type { ChurchSettings } from "@/lib/db/types";
import { formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TONE: Record<SimpleStatus, string> = { to_call: "pill-amber", called: "pill-blue", came_back: "pill-green", removed: "pill-gray" };

/** A one-click button that records what happened (no page change). */
function Quick({ id, action, children, primary = false }: { id: string; action: string; children: ReactNode; primary?: boolean }) {
  return (
    <form action={firstTimerQuickAction}>
      <input type="hidden" name="id" value={id} /><input type="hidden" name="do" value={action} />
      <button type="submit" className={`btn btn-sm ${primary ? "btn-primary" : "btn-secondary"}`}>{children}</button>
    </form>
  );
}

export default async function FirstTimersPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const admin = await requireAdmin("first_timers");
  const { show = "to_call" } = await searchParams;
  let rows: FirstTimerRow[]; let settings: ChurchSettings;
  try {
    [rows, settings] = await Promise.all([listFirstTimers(), getSettings()]);
  } catch (error) {
    console.error("first timers unavailable", error);
    return (
      <>
        <PageHeading title="First timers" description="People worshipping with FlagUpJesus for the first time." />
        <div className="alert alert-warn" data-testid="first-timers-db-update">
          The database needs a one-time update before first timers can be followed up. In Supabase, open <b>SQL Editor → New query</b>, paste everything from
          <code className="mx-1">supabase/setup.sql</code>and click <b>Run</b>, then refresh this page.
        </div>
      </>
    );
  }
  const now = new Date();
  const count = (s: SimpleStatus) => rows.filter((r) => simpleStatus(r.stage) === s).length;
  const shown = show === "all" ? rows : rows.filter((r) => simpleStatus(r.stage) === show);
  const via = deliveredVia(followUpChannels(settings).filter((c) => c !== "email")).join(", ");
  const tabs = SIMPLE_STATUSES.filter((s) => s.value !== "removed");

  return (
    <>
      <PageHeading
        title="First timers"
        description="People worshipping with FlagUpJesus for the first time. Give each one a call to say welcome — the app sends the welcome message and Sunday invitations for you."
        action={can(admin.role, "messaging") && rows.length > 0 ? <Link href="/admin/messaging?audience=first_timers" className="btn btn-secondary"><Send size={16} /> Message first timers</Link> : undefined}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3" data-testid="first-timer-tabs">
        {tabs.map((s, i) => (
          <Link key={s.value} href={`/admin/first-timers?show=${s.value}`} data-testid={`show-${s.value}`}
            className={`card flex items-center gap-4 p-4 transition hover:-translate-y-0.5 ${show === s.value ? "ring-2 ring-[var(--accent)]" : ""}`}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-slate-100 font-bold text-slate-600">{i + 1}</span>
            <span className="min-w-0 flex-1"><b className="block">{s.label}</b><span className="block text-xs text-slate-500">{s.hint}</span></span>
            <b className="text-2xl">{count(s.value)}</b>
          </Link>
        ))}
      </div>

      <div className="card">
        <ul className="divide-y divide-slate-100" data-testid="first-timers-list">
          {shown.map((r) => {
            const status = simpleStatus(r.stage);
            const step = nextStep(r, settings, now);
            const wa = r.person.normalized_phone.replace(/^\+/, "");
            const hello = encodeURIComponent(`Hello ${firstName(r.person.full_name)}, this is FlagUpJesus Global Ministry. Thank you so much for worshipping with us! How did you enjoy the service? We'd love to see you again this Sunday.`);
            return (
              <li key={r.id} className="flex flex-wrap items-center gap-x-6 gap-y-3 p-4 sm:px-5" data-testid="first-timer-row">
                <div className="min-w-[14rem] flex-1">
                  <Link href={`/admin/first-timers/${r.id}`} className="font-semibold hover:text-blue-600">{r.person.full_name}</Link>
                  <span className={`pill ${TONE[status]} ml-2`}>{SIMPLE_STATUSES.find((s) => s.value === status)!.label}</span>
                  <span className="block text-xs text-slate-500">{r.person.phone} · first came {formatDate(r.first_visit_at, { weekday: "short", day: "numeric", month: "short" })}{r.service ? ` · ${r.service.title}` : r.source === "registration" ? " · registered online" : ""}</span>
                  <span className={`block text-xs ${step.overdue ? "font-semibold text-red-600" : "text-slate-400"}`}>{step.text}{step.overdue ? " · overdue" : ""}{r.last_contacted_at ? ` · last contact ${timeAgo(r.last_contacted_at)}` : ""}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {status !== "removed" && status !== "came_back" && <>
                    <a className="btn btn-secondary btn-sm" href={`tel:${r.person.normalized_phone}`} aria-label={`Call ${r.person.full_name}`}><Phone size={14} /> Call</a>
                    <a className="btn btn-secondary btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${hello}`}><MessageCircle size={14} /> WhatsApp</a>
                  </>}
                  {status === "to_call" && <>
                    <Quick id={r.id} action="reached" primary><Check size={14} /> Reached them</Quick>
                    <Quick id={r.id} action="no_answer"><PhoneOff size={14} /> No answer</Quick>
                  </>}
                  {status === "called" && <Quick id={r.id} action="came_back"><Sparkles size={14} /> Came back</Quick>}
                  {status === "removed" && <Quick id={r.id} action="restore">Put back on the list</Quick>}
                </div>
              </li>
            );
          })}
          {!shown.length && (
            <li className="py-12 text-center text-slate-500">
              <Sparkles className="mx-auto mb-2 text-[var(--accent)]" size={22} />
              {!rows.length ? "No first timers yet. When someone registers and says it's their first time, they appear here." : show === "to_call" ? "Everyone has been called. 🙌" : "No one here yet."}
            </li>
          )}
        </ul>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-500" data-testid="first-timer-automation">
        <span>
          {settings.first_timer_auto
            ? <>✅ <b>Automatic messages are on:</b> a welcome message as soon as they register ({via}), then a Sunday invitation each Saturday{settings.first_timer_max_invites ? ` (up to ${settings.first_timer_max_invites})` : ""} until they come back. Coming back is picked up when they check in.</>
            : <>⏸️ <b>Automatic messages are off</b> — first timers are still listed here for your team to call.</>}
        </span>
        <span className="flex flex-wrap gap-2">
          {settings.first_timer_auto && <ActionForm action={runFirstTimerAction}><SubmitButton className="btn btn-secondary btn-sm" pendingText="Sending…">Send due messages now</SubmitButton></ActionForm>}
          <Link href="/admin/settings#first-timers-partners" className="btn btn-secondary btn-sm">{settings.first_timer_auto ? "Change" : "Turn on"}</Link>
          <Link href="/admin/first-timers?show=all" className="btn btn-secondary btn-sm">Everyone ({rows.length})</Link>
          {count("removed") > 0 && <Link href="/admin/first-timers?show=removed" className="btn btn-secondary btn-sm">Removed ({count("removed")})</Link>}
        </span>
      </div>
    </>
  );
}
