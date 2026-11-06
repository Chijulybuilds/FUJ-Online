import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { getBroadcast } from "@/lib/repo/messaging";
import { providers } from "@/lib/messaging/providers";
import { nonResponderTasksAction } from "@/lib/actions/admin";
import { formatDateTime, timeAgo } from "@/lib/utils";
import { Compose } from "../compose";
import { Eye, MessageSquareReply, Send, Users } from "lucide-react";

export default async function BroadcastTracking({ params, searchParams }: { params: Promise<{ broadcastId: string }>; searchParams: Promise<{ sent?: string; filter?: string }> }) {
  const admin = await requireAdmin("messaging");
  const { broadcastId } = await params;
  const { sent, filter = "" } = await searchParams;
  const b = await getBroadcast(broadcastId).catch(() => null);
  if (!b) notFound();
  const rows = b.recipients.filter((r) => filter === "unread" ? !r.read_at : filter === "unresponded" ? !r.responded_at : filter === "responded" ? r.responded_at : true);
  return (
    <>
      <PageHeading title={b.title} description={<>{b.audienceLabel} · sent {formatDateTime(b.sent_at)} by {b.created_by} · channels: {b.channels.join(", ")}</>} action={<Link href="/admin/messaging" className="btn btn-secondary">All broadcasts</Link>} />
      {sent && <p className="alert alert-ok mb-5">Broadcast sent to {b.stats.total} people. Their responses will appear below and in the inbox.</p>}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recipients" value={b.stats.total} icon={<Users size={18} />} />
        <StatCard label="Read" value={`${b.stats.read} (${b.stats.readRate}%)`} icon={<Eye size={18} />} tone="green" />
        <StatCard label="Responded" value={`${b.stats.responded} (${b.stats.responseRate}%)`} icon={<MessageSquareReply size={18} />} tone="violet" />
        <StatCard label="Not yet read" value={b.stats.unread} icon={<Send size={18} />} tone="amber" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5">
            <p className="whitespace-pre-line text-sm text-slate-600">{b.body}</p>
            <div className="tabs">{[["", "All"], ["unread", "Unread"], ["unresponded", "No response"], ["responded", "Responded"]].map(([v, l]) => <Link key={v} href={`/admin/messaging/${b.id}?filter=${v}`} className={`tab ${filter === v ? "active" : ""}`}>{l}</Link>)}</div>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Recipient</th><th>Read</th><th>Response</th>{b.channels.includes("sms") && <th>SMS</th>}{b.channels.includes("email") && <th>Email</th>}</tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-testid="recipient-row">
                    <td><Link className="font-semibold hover:text-blue-600" href={`/admin/inbox/${r.person_id}`}>{r.person?.full_name ?? "—"}</Link><span className="block text-xs text-slate-400">{r.person?.phone}</span></td>
                    <td>{r.read_at ? <span className="pill pill-green">read {timeAgo(r.read_at)}</span> : <span className="pill pill-gray">unread</span>}</td>
                    <td className="max-w-xs">{r.response ? <span className="whitespace-pre-line">{r.response}</span> : <span className="text-slate-400">—</span>}</td>
                    {b.channels.includes("sms") && <td><StatusPill value={r.sms_status} /></td>}
                    {b.channels.includes("email") && <td><StatusPill value={r.email_status} /></td>}
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={5} className="text-center text-slate-500">No recipients in this view.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">Follow-up broadcast</h2>
            <p className="mt-1 text-xs text-slate-500">Re-send to people who haven&apos;t read or responded — tracked separately.</p>
            <div className="mt-4">
              <Compose parentId={b.id} defaultKind="follow_up" defaultTitle={`Following up: ${b.title}`} sms={providers.sms} email={providers.email} defaultAudience={`followup:${b.id}:unresponded`}
                audiences={[{ value: `followup:${b.id}:unresponded`, label: `Haven't responded (${b.stats.total - b.stats.responded})` }, { value: `followup:${b.id}:unread`, label: `Haven't read (${b.stats.unread})` }]} />
            </div>
          </section>
          {can(admin.role, "care") && (
            <section className="card p-6">
              <h2 className="font-bold">Hand over to pastoral care</h2>
              <p className="mt-1 text-xs text-slate-500">Create a follow-up task for every recipient who hasn&apos;t responded.</p>
              <ActionForm action={nonResponderTasksAction} className="mt-3"><input type="hidden" name="broadcast_id" value={b.id} /><SubmitButton className="btn btn-secondary" pendingText="Creating…">Create care tasks</SubmitButton></ActionForm>
            </section>
          )}
          {b.followUps.length > 0 && (
            <section className="card p-6"><h2 className="font-bold">Follow-ups sent</h2><ul className="mt-3 space-y-2 text-sm">{b.followUps.map((f) => <li key={f.id}><Link className="flex justify-between gap-3 hover:text-blue-600" href={`/admin/messaging/${f.id}`}><span>{f.title}</span><span className="text-slate-500">{f.stats.read}/{f.stats.total} read · {f.stats.responded} replied</span></Link></li>)}</ul></section>
          )}
        </div>
      </div>
    </>
  );
}
