import { PageHeading } from "@/components/ui/page-heading";
import { announcements } from "@/lib/demo-data";
export default function MemberAnnouncements(){return <><PageHeading title="Church updates" description="Announcements from your church community."/><div className="space-y-3">{announcements.filter(a=>a.status==="Published").map(a=><div key={a.title} className="card p-5"><p className="font-semibold">{a.title}</p><p className="mt-2 text-xs text-slate-500">{a.audience} · {a.date}</p></div>)}</div></>}
