import Link from "next/link";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
export function MemberShell({ children }: { children:React.ReactNode }) {
 return <div className="min-h-screen bg-slate-50"><header className="border-b bg-white"><div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-2"><Link href="/member" aria-label="FlagUpJesus member home"><BrandLogo className="h-14 w-20 object-contain"/></Link><div className="flex items-center gap-5"><nav className="flex gap-4 text-sm text-slate-600"><Link href="/member">Home</Link><Link href="/member/attendance">Attendance</Link><Link href="/member/announcements">Updates</Link><Link href="/member/profile">Profile</Link></nav><ThemeToggle/></div></div></header><main className="mx-auto max-w-6xl px-5 py-8">{children}</main></div>;
}
