import Link from "next/link";
import { CalendarDays, MapPin, Plus } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatusPill } from "@/components/ui/status-pill";
import { requireAdmin } from "@/lib/auth/session";
import { serviceSummaries, listServices } from "@/lib/repo/services";
import { formatDateTime } from "@/lib/utils";

export default async function ServicesPage() {
  await requireAdmin("services");
  const [services, summaries] = await Promise.all([listServices(), serviceSummaries(50)]);
  const counts = new Map(summaries.map((s) => [s.service.id, s.total]));
  return (
    <>
      <PageHeading title="Services & gatherings" description="Schedule services, open QR check-in and review attendance." action={<Link href="/admin/services/new" className="btn btn-primary"><Plus size={16} /> Create service</Link>} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {services.map((s) => (
          <Link key={s.id} href={`/admin/services/${s.id}`} className="card block p-5 transition hover:-translate-y-1">
            <div className="flex items-start justify-between"><span className="rounded-xl bg-blue-50 p-3 text-blue-600"><CalendarDays /></span><StatusPill value={s.status} /></div>
            <h2 className="mt-5 font-bold">{s.title}</h2>
            <p className="mt-1 text-sm text-slate-500">{formatDateTime(s.starts_at)}</p>
            {s.location && <p className="mt-1 flex items-center gap-1 text-xs text-slate-400"><MapPin size={12} /> {s.location}</p>}
            <p className="mt-4 text-sm"><b>{counts.get(s.id) ?? 0}</b> <span className="text-slate-500">checked in · {s.category}</span></p>
          </Link>
        ))}
        {!services.length && <p className="empty md:col-span-2">No services yet. Create your first service.</p>}
      </div>
    </>
  );
}
