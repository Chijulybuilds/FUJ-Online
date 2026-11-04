"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, CalendarDays, CircleDollarSign, HeartHandshake, Home, Megaphone, MessageSquare, Settings, ShieldCheck, Users, QrCode } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
const groups = [
 { label:"OVERVIEW", links:[["Dashboard","/admin",Home],["Members","/admin/members",Users],["Services","/admin/services",CalendarDays],["Attendance","/admin/attendance",QrCode]] },
 { label:"MINISTRY", links:[["Pastoral care","/admin/pastoral-care",HeartHandshake],["Departments","/admin/departments",ShieldCheck],["Announcements","/admin/announcements",Megaphone],["Prayer requests","/admin/prayer-requests",MessageSquare],["Testimonies","/admin/testimonies",BookOpen]] },
 { label:"MANAGEMENT", links:[["Giving","/admin/giving",CircleDollarSign],["Reports","/admin/reports",BarChart3],["Settings","/admin/settings",Settings]] }
] as const;
export function Sidebar() {
 const pathname=usePathname();
 return <aside className="sidebar"><Link href="/admin" className="flex h-[76px] items-center gap-3 border-b border-white/10 px-4"><span className="flex h-12 w-[68px] shrink-0 items-center justify-center rounded-lg bg-white px-1"><BrandLogo className="h-full w-full object-contain"/></span><span className="brand-text"><span className="block text-base font-bold text-white">FlagUpJesus</span><span className="block text-[10px] text-slate-400">ONLINE CHURCH</span></span></Link><nav className="flex-1 space-y-7 overflow-y-auto px-3 py-7">{groups.map(group=><div key={group.label}><p className="side-caption mb-2 px-3 text-[10px] font-bold tracking-[.15em] text-slate-500">{group.label}</p><div className="space-y-1">{group.links.map(([label,href,Icon])=><Link key={href} href={href} className={`nav-link ${pathname===href || (href!=="/admin" && pathname.startsWith(href)) ? "active":""}`}><Icon size={18}/><span className="nav-label">{label}</span></Link>)}</div></div>)}</nav><div className="border-t border-white/10 p-4"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-700 text-xs font-bold text-white">FOJ</div><div className="profile-copy"><p className="text-xs font-semibold text-white">Church Admin</p><p className="text-[10px] text-slate-400">Administrator</p></div></div></div></aside>;
}
