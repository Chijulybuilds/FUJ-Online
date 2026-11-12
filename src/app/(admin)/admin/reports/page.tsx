import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { dashboardStats, monthlySeries } from "@/lib/repo/reports";
import { listBroadcasts } from "@/lib/repo/messaging";
import { formatCurrency, formatDate } from "@/lib/utils";

function Bars({ data, format = (v: number) => String(v) }: { data: { label: string; value: number }[]; format?: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return <div className="bar-chart">{data.map((d, i) => <div className="bar" key={d.label + i}><b>{format(d.value)}</b><span className="fill" style={{ height: `${(d.value / max) * 100}%`, animationDelay: `${i * 0.05}s` }} /><small>{d.label}</small></div>)}</div>;
}

export default async function ReportsPage() {
  const admin = await requireAdmin("reports");
  const [stats, months, broadcasts] = await Promise.all([dashboardStats(), monthlySeries(6), can(admin.role, "messaging") ? listBroadcasts() : Promise.resolve([])]);
  const services = [...stats.summaries].reverse();
  return (
    <>
      <PageHeading title="Reports & analytics" description="Attendance, growth, giving and engagement trends." action={<a className="btn btn-secondary" href="/api/admin/export?type=attendance">Export attendance CSV</a>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-6"><h2 className="mb-5 font-bold">Attendance per service</h2>{services.length ? <Bars data={services.map((s) => ({ label: formatDate(s.service.starts_at, { day: "2-digit", month: "short" }), value: s.total }))} /> : <p className="empty">No data</p>}</section>
        <section className="card p-6"><h2 className="mb-5 font-bold">New members per month</h2><Bars data={months.map((m) => ({ label: m.label, value: m.newPeople }))} /></section>
        <section className="card p-6"><h2 className="mb-5 font-bold">Check-ins per month</h2><Bars data={months.map((m) => ({ label: m.label, value: m.checkIns }))} /></section>
        {can(admin.role, "giving") && <section className="card p-6"><h2 className="mb-5 font-bold">Giving per month</h2><Bars data={months.map((m) => ({ label: m.label, value: m.giving }))} format={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} /><p className="mt-3 text-xs text-slate-500">This month: {formatCurrency(stats.givingThisMonth)}</p></section>}
        <section className="card p-6">
          <h2 className="mb-4 font-bold">Membership</h2>
          <dl className="kv"><dt>Active members</dt><dd>{stats.members}</dd><dt>Inactive / moved</dt><dd>{stats.inactive}</dd><dt>New this month</dt><dd>{stats.newThisMonth}</dd><dt>All-time check-ins</dt><dd>{stats.totalCheckIns}</dd></dl>
        </section>
        {broadcasts.length > 0 && (
          <section className="card p-6">
            <h2 className="mb-4 font-bold">Broadcast engagement</h2>
            <ul className="space-y-3 text-sm">{broadcasts.slice(0, 6).map((b) => <li key={b.id}><div className="flex justify-between gap-3"><span className="truncate">{b.title}</span><span className="text-slate-500">{b.stats.readRate}% read · {b.stats.responseRate}% replied</span></div><div className="progress mt-1"><span style={{ width: `${b.stats.readRate}%` }} /></div></li>)}</ul>
          </section>
        )}
      </div>
    </>
  );
}
