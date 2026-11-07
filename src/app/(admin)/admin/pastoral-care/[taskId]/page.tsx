import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone, Send } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { getTask } from "@/lib/repo/care";
import { db } from "@/lib/db";
import { logContactAction, updateTaskAction } from "@/lib/actions/admin";
import { formatDate, formatDateTime } from "@/lib/utils";
import { firstName } from "@/lib/identity-utils";

export default async function FollowUpTask({ params }: { params: Promise<{ taskId: string }> }) {
  await requireAdmin("care");
  const { taskId } = await params;
  const task = await getTask(taskId).catch(() => null);
  if (!task) notFound();
  const staff = await db().list("admin_users", { where: { active: true } });
  const p = task.person;
  const wa = p?.normalized_phone.replace(/^\+/, "");
  const greeting = encodeURIComponent(`Hello ${p ? firstName(p.full_name) : ""}, this is FlagUpJesus Global Ministry. We missed you and wanted to check in on you. How are you doing?`);
  return (
    <>
      <PageHeading title={p?.full_name ?? "Follow-up"} description={<>{task.reason} · <StatusPill value={task.status} /> <StatusPill value={task.priority} /></>}
        action={p && <><a className="btn btn-secondary" href={`tel:${p.normalized_phone}`}><Phone size={15} /> Call</a><a className="btn btn-secondary" target="_blank" rel="noreferrer" href={`https://wa.me/${wa}?text=${greeting}`}><MessageCircle size={15} /> WhatsApp</a><Link className="btn btn-secondary" href={`/admin/messaging?to=${p.id}`}><Send size={15} /> In-app message</Link></>} />
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="card p-6">
          <h2 className="font-bold">Task</h2>
          {p && <dl className="kv mt-3"><dt>Phone</dt><dd>{p.phone}</dd><dt>Username</dt><dd className="username-badge">{p.username}</dd><dt>Status</dt><dd><StatusPill value={p.status} /></dd><dt>Last seen</dt><dd>{formatDate(p.last_seen_at)}</dd><dt>Profile</dt><dd><Link className="text-blue-600" href={`/admin/members/${p.id}`}>Open record →</Link></dd></dl>}
          <ActionForm action={updateTaskAction} className="mt-5 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="id" value={task.id} />
            <label className="label">Status<select className="input mt-1" name="status" defaultValue={task.status}><option value="open">Open</option><option value="in_progress">In progress</option><option value="completed">Completed</option><option value="dismissed">Dismissed</option></select></label>
            <label className="label">Priority<select className="input mt-1" name="priority" defaultValue={task.priority}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label>
            <label className="label sm:col-span-2">Assigned to<select className="input mt-1" name="assignee" defaultValue={task.assignee ?? ""}><option value="">Unassigned</option>{staff.map((s) => <option key={s.id} value={s.full_name}>{s.full_name}</option>)}</select></label>
            <label className="label sm:col-span-2">Notes (confidential)<textarea className="input mt-1" name="notes" defaultValue={task.notes ?? ""} /></label>
            <div><SubmitButton>Save task</SubmitButton></div>
          </ActionForm>
        </section>
        <section className="card p-6">
          <h2 className="font-bold">Log a contact</h2>
          <ActionForm action={logContactAction} className="mt-3 grid gap-3 sm:grid-cols-2" resetOnSuccess>
            <input type="hidden" name="task_id" value={task.id} />
            <label className="label">Channel<select className="input mt-1" name="channel"><option value="call">Phone call</option><option value="whatsapp">WhatsApp</option><option value="sms">SMS</option><option value="visit">Home visit</option><option value="email">Email</option><option value="note">Note</option></select></label>
            <label className="label">Outcome<select className="input mt-1" name="outcome"><option>Reached — doing well</option><option>Reached — needs prayer</option><option>Reached — will return</option><option>No answer</option><option>Wrong number</option><option>Other</option></select></label>
            <label className="label sm:col-span-2">Note<textarea className="input mt-1" name="note" placeholder="What did you discuss?" /></label>
            <div><SubmitButton className="btn btn-secondary">Log contact</SubmitButton></div>
          </ActionForm>
          <h3 className="mt-6 text-sm font-semibold">Contact history</h3>
          <ol className="mt-3 space-y-3 border-l-2 border-slate-100 pl-4">
            {task.logs.map((l) => <li key={l.id} className="text-sm"><p><b>{l.outcome}</b> <span className="text-slate-500">via {l.channel}</span></p>{l.note && <p className="mt-1 text-slate-600">{l.note}</p>}<p className="mt-1 text-xs text-slate-400">{l.author} · {formatDateTime(l.created_at)}</p></li>)}
            {!task.logs.length && <li className="text-sm text-slate-500">No contact logged yet.</li>}
          </ol>
        </section>
      </div>
    </>
  );
}
