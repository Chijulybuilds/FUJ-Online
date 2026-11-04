import Link from "next/link";
import { CalendarCheck, QrCode, Users, UserCheck } from "lucide-react";
import { PageHeading } from "@/components/ui/page-heading";
import { StatCard } from "@/components/ui/stat-card";
import { services } from "@/lib/demo-data";
export default function AttendancePage() {
 return <><PageHeading title="Attendance" description="Monitor service attendance and manage check-in." action={<Link href="/admin/attendance/display" className="btn btn-primary"><QrCode size={16}/> Open QR display</Link>}/><div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><StatCard label="Last service" value="248" change="Sunday, 01 November" icon={<Users/>}/><StatCard label="Members present" value="219" change="88.3% of attendance" icon={<UserCheck/>} tone="green"/><StatCard label="Visitors" value="29" change="11.7% of attendance" icon={<Users/>} tone="violet"/><StatCard label="Attendance rate" value="82.4%" change="Last 4 services" icon={<CalendarCheck/>} tone="amber"/></div><div className="card"><div className="border-b border-slate-100 p-5"><h2 className="font-bold">Recent services</h2></div><div className="table-wrap"><table className="data-table"><thead><tr><th>Service</th><th>Date</th><th>Time</th><th>Attendance</th><th>Status</th></tr></thead><tbody>{services.map(s=><tr key={s.id}><td className="font-semibold">{s.name}</td><td>{s.date}</td><td>{s.time}</td><td>{s.attendance}</td><td><span className={`pill ${s.status==="Upcoming"?"pill-green":"pill-gray"}`}>{s.status}</span></td></tr>)}</tbody></table></div></div></>;
}
