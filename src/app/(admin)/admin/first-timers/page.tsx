import Link from "next/link";
import { Send, Sparkles } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { listFirstTimers, nextStep, STAGES, type FirstTimerRow } from "@/lib/repo/first-timers";
import { getSettings } from "@/lib/repo/settings";
import { followUpChannels } from "@/lib/repo/auto-follow-up";
import { deliveredVia } from "@/lib/repo/contact-logs";
import { runFirstTimerAction } from "@/lib/actions/admin";
import type { ChurchSettings } from "@/lib/db/types";
import { formatDate, timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

const ACTIVE = new Set(["new", "welcomed", "returned"]);

export default async function FirstTimersPage({ searchParams }: { searchParams: Promise<{ stage?: string }> }) {
  const admin = await requireAdmin("care");
  const { stage = "" } = await searchParams;
  let rows: FirstTimerRow[]; let settings: ChurchSettings;
  try {
    [rows, settings] = await Promise.all([listFirstTimers(), getSettings()]);
  } catch (error) {
    console.error("first timers unavailable", error);
    return (
      <>
        <PageHeading title="First timers" description="Welcome first timers, invite them back and help them settle in." />
        <div className="alert alert-warn" data-testid="first-timers-db-update">
          The database needs a one-time update before first timers can be followed up. In Supabase, open <b>SQL Editor → New query</b>, paste everything from
          <code className="mx-1">supabase/setup.sql</code>and click <b>Run</b>, then refresh this page.
        </div>
      </>
    );
  }
  const now = new Date();
  const count = (s: string) => rows.filter((r) => r.stage === s).length;
  const following = rows.filter((r) => ACTIVE.has(r.stage));
  const shown = stage === "all" ? rows : stage ? rows.filter((r) => r.stage === stage) : following;
  const via = deliveredVia(followUpChannels(settings)).join(" · ");
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1) - 3600000);
  const thisMonth = rows.filter((r) => new Date(r.first_visit_at) >= monthStart).length;

  return (
    <>
      <PageHeading
        title="First timers"
        description="People who told us it was their first time at FlagUpJesus — separate from members who simply register online. Welcome them, invite them back and help them settle in."
        action={<>
          {can(admin.role, "messaging") && following.length > 0 && <Link href="/admin/messaging?audience=first_timers" className="btn btn-secondary"><Send size={16} /> Message first timers</Link>}
          <ActionForm action={runFirstTimerAction}><SubmitButton pendingText="Sending…">Send due messages</SubmitButton></ActionForm>
        </>}
      />
      <div className={`alert mb-5 flex flex-wrap items-center justify-between gap-3 ${settings.first_timer_auto ? "alert-ok" : "alert-warn"}`} data-testid="first-timer-automation">
        {settings.first_timer_auto
          ? <span><b>Automatic first-timer follow-up is on.</b> Every first timer gets a welcome message straight away ({via}), then an invitation every Saturday for Sunday service{settings.first_timer_max_invites ? ` (up to ${settings.first_timer_max_invites})` : ""} until they come back. Coming back is noticed automatically when they check in.</span>
          : <span><b>Automatic first-timer messages are off.</b> First timers are still listed here for your team to call.</span>}
        <Link href="/admin/settings#first-timers-partners" className="btn btn-secondary btn-sm">{settings.first_timer_auto ? "Change" : "Turn on"}</Link>
      </div>

      <div className="mb-5 grid gap-3 sm:grid-cols-3 xl:grid-cols-6">
        <div className="card p-4"><p className="text-xs text-slate-500">New this month</p><p className="text-2xl font-bold">{thisMonth}</p></div>
        {STAGES.map((s) => (
          <Link key={s.value} href={`/admin/first-timers?stage=${s.value}`} className={`card p-4 transition hover:-translate-y-0.5 ${stage === s.value ? "ring-2 ring-[var(--accent)]" : ""}`} title={s.hint} data-testid={`stage-${s.value}`}>
            <p className="text-xs text-slate-500">{s.label}</p><p className="text-2xl font-bold">{count(s.value)}</p>
          </Link>
        ))}
      </div>

      <div className="tabs mb-4 flex-wrap">
        <Link href="/admin/first-timers" className={`tab ${!stage ? "active" : ""}`}>Being followed up ({following.length})</Link>
        {STAGES.map((s) => <Link key={s.value} href={`/admin/first-timers?stage=${s.value}`} className={`tab ${stage === s.value ? "active" : ""}`}>{s.label}</Link>)}
        <Link href="/admin/first-timers?stage=all" className={`tab ${stage === "all" ? "active" : ""}`}>All ({rows.length})</Link>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table" data-testid="first-timers-table">
            <thead><tr><th>Person</th><th>First visit</th><th>Stage</th><th>Services</th><th>Next step</th><th>Assigned</th><th>Last contact</th></tr></thead>
            <tbody>
              {shown.map((r) => {
                const step = nextStep(r, settings, now);
                return (
                  <tr key={r.id}>
                    <td><Link href={`/admin/first-timers/${r.id}`} className="font-semibold hover:text-blue-600">{r.person.full_name}</Link><span className="block text-xs text-slate-400">{r.person.phone}</span></td>
                    <td>{formatDate(r.first_visit_at)}<span className="block text-xs text-slate-400">{r.service?.title ?? (r.source === "registration" ? "Registered online" : r.source === "desk" ? "Check-in desk" : "Added by staff")}</span></td>
                    <td><StatusPill value={r.stage} /></td>
                    <td>{r.visits}</td>
                    <td className={step.overdue ? "font-semibold text-red-600" : ""}>{step.text}{step.overdue && <span className="block text-xs">Overdue</span>}</td>
                    <td>{r.assignee ?? <span className="text-slate-400">Unassigned</span>}</td>
                    <td>{timeAgo(r.last_contacted_at)}</td>
                  </tr>
                );
              })}
              {!shown.length && (
                <tr><td colSpan={7} className="py-10 text-center text-slate-500">
                  <Sparkles className="mx-auto mb-2 text-[var(--accent)]" size={22} />
                  {rows.length ? "No one at this stage." : "No first timers yet. When someone registers and says it's their first time, they appear here."}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
