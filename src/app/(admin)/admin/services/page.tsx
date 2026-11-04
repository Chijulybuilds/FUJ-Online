import { CalendarDays, Plus } from "lucide-react";
import Link from "next/link";
import { services } from "@/lib/demo-data";
import { PageHeading } from "@/components/ui/page-heading";
export default function ServicesPage() {
 return <><PageHeading title="Services & gatherings" description="Schedule worship services, Bible studies and ministry events." action={<Link href="/admin/services/new" className="btn btn-primary"><Plus size={16}/> Create service</Link>}/><div className="grid gap-4 md:grid-cols-2">{services.map(s=><article key={s.id} className="card p-5"><div className="flex items-start justify-between"><span className="rounded-xl bg-blue-50 p-3 text-blue-600"><CalendarDays/></span><span className={`pill ${s.status==="Upcoming"?"pill-green":"pill-gray"}`}>{s.status}</span></div><h2 className="mt-5 font-bold text-slate-900">{s.name}</h2><p className="mt-2 text-sm text-slate-500">{s.date} · {s.time}</p><div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-xs text-slate-500"><span>{s.id}</span><span>Attendance: {s.attendance}</span></div></article>)}</div></>;
}
