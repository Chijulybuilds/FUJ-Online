import Link from "next/link";
import { CalendarCheck, Megaphone, UserRound, Heart } from "lucide-react";
const shortcuts = [
  { label: "My attendance", href: "/member/attendance", Icon: CalendarCheck },
  { label: "Announcements", href: "/member/announcements", Icon: Megaphone },
  { label: "My profile", href: "/member/profile", Icon: UserRound },
  { label: "Prayer requests", href: "/member/prayer-requests", Icon: Heart }
];
export default function MemberHome() {
  return <><div className="brand-panel rounded-3xl p-8"><p className="text-sm text-blue-200">Welcome to FlagUpJesus</p><h1 className="mt-2 text-3xl font-bold">Your church family, closer.</h1><p className="mt-3 max-w-xl text-sm leading-6 text-slate-300">Stay informed, follow your attendance and remain connected with the ministry.</p></div><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{shortcuts.map(({Icon,label,href})=><Link key={href} href={href} className="card p-5 transition hover:-translate-y-1"><Icon className="text-blue-600"/><p className="mt-4 font-semibold">{label}</p><p className="mt-1 text-xs text-slate-500">View and manage</p></Link>)}</div><div className="card mt-6 p-6"><h2 className="font-bold">Next gathering</h2><p className="mt-2 text-sm text-slate-500">Sunday Celebration Service · Sunday, 08 November 2026 · 9:00 AM</p><Link href="/check-in" className="btn btn-primary mt-4">Go to check-in</Link></div></>;
}
