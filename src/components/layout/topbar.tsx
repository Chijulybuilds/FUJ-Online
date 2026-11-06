"use client";
import Link from "next/link";
import { useRef } from "react";
import { LogOut, Menu, QrCode, UserCheck } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NavLinks } from "./sidebar";
import type { Area } from "@/lib/auth/roles";

export function Topbar({ name, roleLabel, areas }: { name: string; roleLabel: string; areas: Area[] }) {
  const menu = useRef<HTMLDetailsElement>(null);
  return (
    <header className="topbar">
      <details ref={menu} className="mobile-nav mr-3">
        <summary aria-label="Open menu" className="btn btn-secondary btn-sm"><Menu size={16} /></summary>
        <div className="mobile-nav-panel"><NavLinks areas={areas} onNavigate={() => menu.current?.removeAttribute("open")} /></div>
      </details>
      {areas.includes("attendance") && <><Link href="/admin/attendance/desk" className="btn btn-secondary btn-sm hidden sm:inline-flex"><UserCheck size={14} /> Check-in desk</Link><Link href="/admin/attendance/display" className="btn btn-secondary btn-sm ml-2 hidden sm:inline-flex"><QrCode size={14} /> QR display</Link></>}
      <div className="ml-auto flex items-center gap-3">
        <ThemeToggle />
        <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-slate-800">{name}</p><p className="text-[10px] text-slate-400">{roleLabel}</p></div>
        <form action="/api/auth/logout?who=admin" method="post"><button className="btn btn-ghost btn-sm" aria-label="Sign out"><LogOut size={15} /><span className="hidden sm:inline">Sign out</span></button></form>
      </div>
    </header>
  );
}
