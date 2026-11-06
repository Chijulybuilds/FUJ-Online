import Link from "next/link";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { listTasks } from "@/lib/repo/care";
import { quickTaskStatusAction, runAnalysisAction } from "@/lib/actions/admin";
import { formatDate, timeAgo } from "@/lib/utils";

const CATS = [["", "All open"], ["absentee", "Absentees"], ["first_timer", "First-timers"], ["prayer", "Prayer"], ["broadcast", "Broadcast"], ["general", "General"], ["done", "Completed"]];

export default async function PastoralCarePage({ searchParams }: { searchParams: Promise<{ cat?: string }> }) {
  await requireAdmin("care");
  const { cat = "" } = await searchParams;
  const tasks = await listTasks();
  const isOpen = (s: string) => s === "open" || s === "in_progress";
  const shown = tasks.filter((t) => (cat === "done" ? !isOpen(t.status) : isOpen(t.status) && (!cat || t.category === cat)));
  const counts = { open: tasks.filter((t) => isOpen(t.status)).length, high: tasks.filter((t) => isOpen(t.status) && t.priority === "high").length, done: tasks.filter((t) => t.status === "completed").length };
  return (
    <>
      <PageHeading title="Pastoral care & follow-up" description="Absentees, first-timers and anyone who needs a personal check-in. Analysis never changes membership status automatically."
        action={<ActionForm action={runAnalysisAction}><SubmitButton pendingText="Analysing…">Run absence analysis</SubmitButton></ActionForm>} />
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
                  <td>{t.reason}<span className="block text-xs text-slate-400">{t.category.replace("_", " ")}</span></td>
                  <td><StatusPill value={t.priority} /></td>
                  <td>{t.assignee ?? <span className="text-slate-400">Unassigned</span>}</td>
                  <td>{formatDate(t.due_at)}</td>
                  <td>{timeAgo(t.last_contacted_at)}</td>
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
