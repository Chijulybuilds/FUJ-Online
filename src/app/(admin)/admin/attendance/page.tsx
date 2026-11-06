import Link from "next/link";
import { Download, QrCode, UserCheck, Users, UserPlus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/lib/auth/session";
import { activeSessions, getService, serviceSummaries } from "@/lib/repo/services";
import { formatDate, formatDateTime } from "@/lib/utils";

export default async function AttendancePage() {
  await requireAdmin("attendance");
  const [summaries, sessions] = await Promise.all([serviceSummaries(20), activeSessions()]);
  const live = await Promise.all(sessions.map(async (s) => ({ session: s, service: await getService(s.service_id) })));
  const last = summaries.find((s) => s.total > 0);
  const avg = summaries.length ? Math.round(summaries.reduce((a, s) => a + s.total, 0) / summaries.length) : 0;
  return (
    <>
      <PageHeading title="Attendance" description="QR check-in rotates every 20 seconds. Returning members just type their flag username — no OTP."
        action={<><a href="/api/admin/export?type=attendance" className="btn btn-secondary"><Download size={16} /> Export all</a><Link href="/admin/attendance/display" className="btn btn-primary"><QrCode size={16} /> Open QR display</Link></>} />
      {live.length > 0 && (
        <div className="mb-6 space-y-2">
          {live.map(({ session, service }) => (
            <div key={session.id} className="alert alert-ok flex flex-wrap items-center justify-between gap-3">
              <span><span className="live-dot mr-2" /> <b>{service?.title}</b> — check-in open until {formatDateTime(session.closes_at)}</span>
              <Link className="btn btn-primary btn-sm" href={`/admin/attendance/display?service=${session.service_id}`}>Launch display</Link>
            </div>
          ))}
        </div>
      )}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Last service" value={last?.total ?? 0} change={last ? formatDate(last.service.starts_at) : "—"} icon={<Users size={18} />} />
        <StatCard label="Members present" value={last?.members ?? 0} change={last?.total ? `${Math.round((last.members / last.total) * 100)}% of attendance` : "—"} icon={<UserCheck size={18} />} tone="green" />
        <StatCard label="Visitors" value={last?.visitors ?? 0} change={`${last?.firstTimers ?? 0} first-timers`} icon={<UserPlus size={18} />} tone="violet" />
        <StatCard label="Average attendance" value={avg} change={`Across ${summaries.length} services`} icon={<Users size={18} />} tone="amber" />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Service</th><th>Date</th><th>Status</th><th>Total</th><th>Members</th><th>Visitors</th><th>First-timers</th></tr></thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.service.id}><td><Link className="font-semibold hover:text-blue-600" href={`/admin/services/${s.service.id}`}>{s.service.title}</Link></td><td>{formatDateTime(s.service.starts_at)}</td><td><StatusPill value={s.service.status} /></td><td><b>{s.total}</b></td><td>{s.members}</td><td>{s.visitors}</td><td>{s.firstTimers}</td></tr>
              ))}
              {!summaries.length && <tr><td colSpan={7} className="text-center text-slate-500">No services yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
