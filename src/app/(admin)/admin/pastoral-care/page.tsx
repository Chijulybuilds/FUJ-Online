import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listTasks } from "@/lib/repo/care";
import { getSettings } from "@/lib/repo/settings";
import { followUpChannels, nextAutoMessageAt } from "@/lib/repo/auto-follow-up";
import { providers } from "@/lib/messaging/providers";
import { quickTaskStatusAction, runAnalysisAction } from "@/lib/actions/admin";
import { formatDate, timeAgo } from "@/lib/utils";

const CATS = [["", "All open"], ["absentee", "Absentees"], ["first_timer", "New members"], ["prayer", "Prayer"], ["broadcast", "Broadcast"], ["general", "General"], ["done", "Completed"]];

export default async function PastoralCarePage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireAdmin("care");
  const { cat = "" } = await searchParams;
  const [tasks, settings] = await Promise.all([listTasks(), getSettings()]);
  const label = (c: string) => (c === "sms" ? "SMS" : c === "email" ? "email" : "WhatsApp");
  const connected = (c: string) => (c === "whatsapp" ? providers.whatsapp : c === "sms" ? providers.sms : providers.email);
  const chosen = followUpChannels(settings);
  const via = ["app inbox", ...chosen.filter(connected).map(label)].join(" · ");
  const pending = chosen.filter((c) => !connected(c)).map(label);
  const isOpen = (s: string) => s === "open" || s === "in_progress";
  const shown = tasks.filter((t) => (cat === "done" ? !isOpen(t.status) : isOpen(t.status) && (!cat || t.category === cat)));
  const counts = { open: tasks.filter((t) => isOpen(t.status)).length, high: tasks.filter((t) => isOpen(t.status) && t.priority === "high").length, done: tasks.filter((t) => t.status === "completed").length };
  return (
    <>
      <PageHeading title="Pastoral care & follow-up" description="Absentees, new members and anyone who needs a personal check-in. Nothing here ever changes membership status automatically."
        action={<ActionForm action={runAnalysisAction}><SubmitButton pendingText="Checking…">Check absences now</SubmitButton></ActionForm>} />
      <div className={`alert mb-5 flex flex-wrap items-center justify-between gap-3 ${settings.auto_follow_up ? "alert-ok" : "alert-warn"}`} data-testid="auto-follow-up-status">
        {settings.auto_follow_up
          ? <span><b>Automatic follow-up is on.</b> Members who miss {settings.absence_threshold} Sundays in a row get a message ({via}), then a reminder every {settings.follow_up_every_days} days {settings.follow_up_max_messages ? `(up to ${settings.follow_up_max_messages} messages)` : "until they come back"}. It stops when they check in again, or when you mark their task completed or dismissed.{pending.length > 0 && <> <i>{pending.join(", ")} will be added once set up (Settings → Messaging channels).</i></>}</span>
          : <span><b>Automatic follow-up is off.</b> Absent members are still listed here, but no messages are sent automatically.</span>}
        <Link href="/admin/settings#follow-up" className="btn btn-secondary btn-sm">{settings.auto_follow_up ? "Change" : "Turn on"}</Link>
      </div>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <div className="card p-4"><p className="text-xs text-slate-500">Open tasks</p><p className="text-2xl font-bold">{counts.open}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">High priority</p><p className="text-2xl font-bold text-blue-600">{counts.high}</p></div>
        <div className="card p-4"><p className="text-xs text-slate-500">Completed</p><p className="text-2xl font-bold">{counts.done}</p></div>
      </div>
      <div className="tabs mb-4">{CATS.map(([v, l]) => <Link key={v} href={`/admin/pastoral-care?cat=${v}`} className={`tab ${cat === v ? "active" : ""}`}>{l}</Link>)}</div>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Person</th><th>Reason</th><th>Priority</th><th>Assigned</th><th>Due</th><th>Last contact</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {shown.map((t) => (
                <tr key={t.id}>
                  <td><Link href={`/admin/pastoral-care/${t.id}`} className="font-semibold hover:text-blue-600">{t.person?.full_name ?? "Unknown"}</Link><span className="block text-xs text-slate-400">{t.person?.phone}</span></td>
                  <td>{t.reason}<span className="block text-xs text-slate-400">{t.category === "first_timer" ? "new member" : t.category.replace("_", " ")}</span></td>
                  <td><StatusPill value={t.priority} /></td>
                  <td>{t.assignee ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td>{formatDate(t.due_at)}</td>
                  <td>{timeAgo(t.last_contacted_at)}{t.category === "absentee" && (t.auto_messages_sent ?? 0) > 0 && <span className="block text-xs text-slate-400">{t.auto_messages_sent} automatic message{t.auto_messages_sent === 1 ? "" : "s"}{(() => { const next = nextAutoMessageAt(t, settings); return next ? ` · next ${formatDate(next.toISOString())}` : ""; })()}</span>}</td>
                  <td><StatusPill value={t.status} /></td>
                  <td className="whitespace-nowrap">
                    <Link className="btn btn-secondary btn-sm" href={`/admin/pastoral-care/${t.id}`}>Open</Link>{" "}
                    {isOpen(t.status) && <form action={quickTaskStatusAction} className="inline"><input type="hidden" name="id" value={t.id} /><input type="hidden" name="status" value="completed" /><button className="btn btn-ghost btn-sm">Done</button></form>}
                  </td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={8} className="text-center text-slate-500">Nothing here — praise God! 🙌</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
