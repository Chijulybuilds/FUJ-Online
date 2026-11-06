import Link from "next/link";
import { ArrowUpRight, CalendarCheck, CircleDollarSign, HeartHandshake, MessageSquare, QrCode, UserPlus, Users } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { dashboardStats } from "@/lib/repo/reports";
import { listTasks } from "@/lib/repo/care";
import { upcomingService } from "@/lib/repo/services";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<{ denied?: string }> }) {
  const admin = await requireAdmin();
  const { denied } = await searchParams;
  const [stats, tasks, next] = await Promise.all([dashboardStats(), listTasks(), upcomingService()]);
  const last = stats.summaries.find((s) => s.service.status === "completed" || s.service.status === "active");
  const chart = [...stats.summaries].reverse().slice(-8);
  const max = Math.max(1, ...chart.map((c) => c.total));
  const open = tasks.filter((t) => t.status === "open" || t.status === "in_progress").slice(0, 5);
  return (
    <>
      <PageHeading title={`Welcome, ${admin.name.split(" ")[0]}`} description="Here's what's happening in your church community."
        action={can(admin.role, "services") ? <Link href="/admin/services/new" className="btn btn-primary">+ Create service</Link> : undefined} />
      {denied && <p className="alert alert-warn mb-5">Your role doesn&apos;t have access to “{denied}”. Ask a super admin if you need it.</p>}
      {next && can(admin.role, "attendance") && (
        <div className="brand-panel mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl p-5">
          <div>
            <p className="text-xs text-red-200">{next.status === "active" ? "Check-in is open" : "Next service"}</p>
            <p className="mt-1 text-lg font-bold">{next.title}</p>
            <p className="text-sm text-slate-300">{formatDateTime(next.starts_at)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/services/${next.id}`} className="btn lp-btn-glass">Manage service</Link>
            <Link href={`/admin/attendance/desk?service=${next.id}`} className="btn lp-btn-glass">Check in by name</Link>
            <Link href={`/admin/attendance/display?service=${next.id}`} className="btn lp-btn-light"><QrCode size={16} /> Launch QR display</Link>
          </div>
        </div>
      )}
      <div className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total people" value={stats.totalPeople.toLocaleString()} change={`${stats.members} members · ${stats.visitors} visitors`} icon={<Users size={20} />} />
        <StatCard label="Last service" value={last?.total ?? 0} change={last ? `${last.service.title} · ${formatDate(last.service.starts_at)}` : "No services yet"} icon={<CalendarCheck size={20} />} tone="green" />
        <StatCard label="New this month" value={stats.newThisMonth} change={`${last?.firstTimers ?? 0} first-timers last service`} icon={<UserPlus size={20} />} tone="violet" />
        {can(admin.role, "giving")
          ? <StatCard label="Giving this month" value={formatCurrency(stats.givingThisMonth)} change="Verified records only" icon={<CircleDollarSign size={20} />} tone="amber" />
          : <StatCard label="Open follow-ups" value={stats.openTasks} change="Pastoral care queue" icon={<HeartHandshake size={20} />} tone="amber" />}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-6">
          <div className="mb-5 flex items-center justify-between"><h2 className="font-bold">Attendance — recent services</h2>{can(admin.role, "reports") && <Link href="/admin/reports" className="text-xs font-semibold text-blue-600">Reports <ArrowUpRight className="inline" size={13} /></Link>}</div>
          {chart.length ? (
            <div className="bar-chart">{chart.map((c, i) => (
              <div className="bar" key={c.service.id}><b>{c.total}</b><span className="fill" style={{ height: `${(c.total / max) * 100}%`, animationDelay: `${i * 0.06}s` }} /><small>{formatDate(c.service.starts_at, { day: "2-digit", month: "short" })}</small></div>
            ))}</div>
          ) : <p className="empty">No attendance yet.</p>}
        </section>
        <section className="card p-6">
          <h2 className="mb-4 font-bold">Needs attention</h2>
          <ul className="space-y-3 text-sm">
            {can(admin.role, "care") && <li className="flex items-center justify-between"><Link href="/admin/pastoral-care" className="flex items-center gap-2"><HeartHandshake size={16} className="text-blue-600" /> Open follow-ups</Link><b>{stats.openTasks}</b></li>}
            {can(admin.role, "prayer") && <li className="flex items-center justify-between"><Link href="/admin/prayer-requests" className="flex items-center gap-2"><MessageSquare size={16} className="text-blue-600" /> New prayer requests</Link><b>{stats.pendingPrayers}</b></li>}
            {can(admin.role, "testimonies") && <li className="flex items-center justify-between"><Link href="/admin/testimonies" className="flex items-center gap-2"><ArrowUpRight size={16} className="text-blue-600" /> Testimonies to review</Link><b>{stats.pendingTestimonies}</b></li>}
          </ul>
          {can(admin.role, "care") && open.length > 0 && (
            <div className="mt-6 space-y-2">
              {open.map((t) => (
                <Link key={t.id} href={`/admin/pastoral-care/${t.id}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50">
                  <span><b>{t.person?.full_name ?? "Unknown"}</b><span className="block text-xs text-slate-500">{t.reason}</span></span><StatusPill value={t.priority} />
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
