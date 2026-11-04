import { announcements } from "@/lib/demo-data";
import { PageHeading } from "@/components/ui/page-heading";
export default function Page() {
 return <><PageHeading title="Announcements" description="Create and publish updates for your church community."/><div className="card p-6"><div className="space-y-3">{announcements.map(a=><div key={a.title} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-100 p-4"><div><p className="font-semibold text-slate-800">{a.title}</p><p className="mt-1 text-xs text-slate-500">{a.audience} · {a.date}</p></div><span className={`pill ${a.status==="Published"?"pill-green":"pill-gray"}`}>{a.status}</span></div>)}</div></div></>;
}
