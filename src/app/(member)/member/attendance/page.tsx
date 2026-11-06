import { PageHeading } from "@/components/ui/page-heading";
import { requireMember } from "@/lib/auth/session";
import { attendanceForPerson } from "@/lib/repo/services";
import { formatDateTime } from "@/lib/utils";

export default async function MemberAttendance() {
  const me = await requireMember();
  const rows = await attendanceForPerson(me.personId);
  const thisYear = rows.filter((r) => new Date(r.checked_in_at).getFullYear() === new Date().getFullYear()).length;
  return (
    <>
      <PageHeading title="My attendance" description={`${rows.length} services attended · ${thisYear} this year`} />
      <div className="card divide-y divide-slate-100">
        {rows.map((r) => <div key={r.id} className="flex justify-between gap-3 p-4 text-sm"><span className="font-semibold">{r.service?.title}</span><span className="text-slate-500">{formatDateTime(r.checked_in_at)}</span></div>)}
        {!rows.length && <p className="p-8 text-center text-sm text-slate-500">No attendance yet — scan the QR at your next service!</p>}
      </div>
    </>
  );
}
