"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Award, BarChart3, BookOpen, UserCheck, CalendarDays, CircleDollarSign, HandCoins, HeartHandshake, Home, Inbox, Megaphone, MessageSquare, QrCode, Send, Settings, ShieldCheck, Sparkles, Users } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { NAV_GROUPS } from "./nav-config";
import type { Area } from "@/lib/auth/roles";

const ICONS = { check: UserCheck, home: Home, users: Users, leaders: Award, calendar: CalendarDays, qr: QrCode, heart: HeartHandshake, sparkles: Sparkles, partner: HandCoins, send: Send, inbox: Inbox, megaphone: Megaphone, message: MessageSquare, book: BookOpen, shield: ShieldCheck, money: CircleDollarSign, chart: BarChart3, settings: Settings };

export function NavLinks({ areas, onNavigate }: { areas: Area[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-7 overflow-y-auto px-3 py-7">
      {NAV_GROUPS.map((group) => {
        const links = group.links.filter((l) => areas.includes(l.area));
        if (!links.length) return null;
        return (
          <div key={group.label}>
            <p className="side-caption mb-2 px-3 text-[10px] font-bold tracking-[.15em] text-slate-500">{group.label}</p>
            <div className="space-y-1">
              {links.map(({ label, href, icon }) => {
                const Icon = ICONS[icon as keyof typeof ICONS];
                const active = pathname === href || (href !== "/admin" && pathname.startsWith(href) && !(href === "/admin/attendance" && pathname.startsWith("/admin/attendance/desk")));
                return <Link key={href} href={href} prefetch={false} onClick={onNavigate} className={`nav-link ${active ? "active" : ""}`}><Icon size={18} /><span className="nav-label">{label}</span></Link>;
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}

export function Sidebar({ areas, name, roleLabel }: { areas: Area[]; name: string; roleLabel: string }) {
  return (
    <aside className="sidebar">
      <Link href="/admin" className="flex h-[76px] items-center gap-3 border-b border-white/10 px-4">
        <span className="logo-chip flex h-12 w-[68px] shrink-0 items-center justify-center rounded-lg px-1"><BrandLogo className="h-full w-full object-contain" /></span>
        <span className="brand-text"><span className="block text-base font-bold text-white">FlagUpJesus</span><span className="block text-[10px] text-slate-400">ONLINE CHURCH</span></span>
      </Link>
      <NavLinks areas={areas} />
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-700 text-xs font-bold text-white">{name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}</div>
          <div className="profile-copy min-w-0"><p className="truncate text-xs font-semibold text-white">{name}</p><p className="text-[10px] text-slate-400">{roleLabel}</p></div>
        </div>
      </div>
    </aside>
  );
}
