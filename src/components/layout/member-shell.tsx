"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const LINKS = [
  ["Home", "/member"], ["Messages", "/member/messages"], ["Updates", "/member/announcements"], ["Prayer", "/member/prayer-requests"],
  ["Testimonies", "/member/testimonies"], ["Attendance", "/member/attendance"], ["Giving", "/member/giving"], ["Profile", "/member/profile"]
] as const;

export function MemberShell({ children, unread, name }: { children: React.ReactNode; unread: number; name: string }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2">
          <Link href="/member" aria-label="FlagUpJesus member home"><BrandLogo className="h-12 w-[72px] object-contain" /></Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-slate-500 sm:inline">Hi, {name.split(" ")[0]}</span>
            <ThemeToggle />
            <form action="/api/auth/logout?who=member" method="post"><button className="btn btn-ghost btn-sm" aria-label="Sign out"><LogOut size={15} /></button></form>
          </div>
        </div>
        <div className="mx-auto max-w-6xl px-3 pb-2">
          <nav className="member-nav" aria-label="Member">
            {LINKS.map(([label, href]) => (
              <Link key={href} href={href} prefetch={false} className={pathname === href || (href !== "/member" && pathname.startsWith(href)) ? "active" : ""}>
                {label}{label === "Messages" && unread > 0 && <span className="dot" aria-label={`${unread} unread`}>{unread}</span>}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}
