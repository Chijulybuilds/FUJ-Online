import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, QrCode, Square, XCircle } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { StatCard } from "@/components/ui/stat-card";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { requireAdmin } from "@/lib/auth/session";
import { activeSessionForService, attendanceForService, getService } from "@/lib/repo/services";
import { cancelServiceAction, closeCheckInAction, manualCheckInAction, openCheckInAction } from "@/lib/actions/admin";
import { formatDateTime } from "@/lib/utils";

export default async function ServiceDetails({ params }: { params: Promise<{ serviceId: string }> }) {
  await requireAdmin("services");
  const { serviceId } = await params;
  const service = await getService(serviceId).catch(() => null);
  if (!service) notFound();
  const [session, rows] = await Promise.all([activeSessionForService(service.id), attendanceForService(service.id)]);
  const visitors = rows.filter((r) => r.person?.status === "visitor").length;
  return (
    <>
      <PageHeading title={service.title} description={<>{formatDateTime(service.starts_at)} · {service.category} · <StatusPill value={service.status} /></>}
        action={<a className="btn btn-secondary" href={`/api/admin/export?type=attendance&serviceId=${service.id}`}><Download size={15} /> Export</a>} />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Checked in" value={rows.length} icon={<QrCode size={18} />} />
        <StatCard label="Members" value={rows.length - visitors} icon={<QrCode size={18} />} tone="green" />
        <StatCard label="Visitors" value={visitors} icon={<QrCode size={18} />} tone="violet" />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
        <section className="card p-6">
          <h2 className="font-bold">QR check-in</h2>
          {session ? (
            <>
              <p className="alert alert-ok mt-3"><span className="live-dot mr-2" /> Check-in is open until {formatDateTime(session.closes_at)}. The QR rotates every 20 seconds.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/admin/attendance/display?service=${service.id}`} className="btn btn-primary"><QrCode size={16} /> Open QR display</Link>
                <form action={closeCheckInAction}><input type="hidden" name="service_id" value={service.id} /><button className="btn btn-secondary"><Square size={14} /> Close check-in</button></form>
              </div>
              <p className="mt-2 text-xs text-slate-500">Closing check-in marks the service completed and runs the absence follow-up analysis.</p>
            </>
          ) : service.status === "cancelled" ? <p className="mt-3 text-sm text-slate-500">This service was cancelled.</p> : (
            <form action={openCheckInAction} className="mt-4 space-y-3">
              <input type="hidden" name="service_id" value={service.id} /><input type="hidden" name="then" value="display" />
              <label className="label">Keep check-in open for<select className="input mt-1" name="minutes" defaultValue="240"><option value="60">1 hour</option><option value="120">2 hours</option><option value="240">4 hours</option><option value="480">8 hours</option></select></label>
              <button className="btn btn-primary"><QrCode size={16} /> Open check-in &amp; launch display</button>
            </form>
          )}
          <hr className="my-6 border-slate-100" />
          <h3 className="font-semibold">Usher check-in</h3>
          <p className="mt-1 text-xs text-slate-500">Check people in by name — or open the full <Link className="font-semibold text-blue-600" href={`/admin/attendance/desk?service=${service.id}`}>check-in desk</Link> with live search.</p>
          <ActionForm action={manualCheckInAction} className="mt-3 flex gap-2" resetOnSuccess>
            <input type="hidden" name="service_id" value={service.id} />
            <input className="input" name="person" placeholder="flaggrace101 or 0803…" required aria-label="Person" />
            <SubmitButton className="btn btn-secondary" pendingText="…">Check in</SubmitButton>
          </ActionForm>
          {service.status !== "cancelled" && service.status !== "completed" && (
            <form action={cancelServiceAction} className="mt-6"><input type="hidden" name="service_id" value={service.id} /><button className="btn btn-danger btn-sm"><XCircle size={14} /> Cancel service</button></form>
          )}
        </section>
        <section className="card">
          <div className="border-b border-slate-100 p-5"><h2 className="font-bold">Attendance ({rows.length})</h2></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Name</th><th>Username</th><th>Status</th><th>Time</th><th>Method</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}><td>{r.person ? <Link className="font-semibold hover:text-blue-600" href={`/admin/members/${r.person.id}`}>{r.person.full_name}</Link> : "—"}</td><td className="username-badge">{r.person?.username}</td><td><StatusPill value={r.person?.status} /></td><td>{formatDateTime(r.checked_in_at)}</td><td>{r.check_in_method}{r.recorded_by ? ` · ${r.recorded_by}` : ""}</td></tr>
                ))}
                {!rows.length && <tr><td colSpan={5} className="text-center text-slate-500">No check-ins yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
