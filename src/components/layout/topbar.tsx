import { Bell, ChevronDown, Search } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";
export function Topbar() {
 return <header className="topbar"><div className="hidden items-center gap-2 text-sm text-slate-400 sm:flex"><Search size={16}/><span>Search members, services...</span></div><div className="ml-auto flex items-center gap-4"><ThemeToggle/><button aria-label="Notifications" className="relative text-slate-500"><Bell size={19}/><span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500"/></button><div className="flex items-center gap-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-xs font-bold text-red-800">CA</div><div className="hidden sm:block"><p className="text-xs font-semibold text-slate-800">Church Admin</p><p className="text-[10px] text-slate-400">Administrator</p></div><ChevronDown size={14} className="text-slate-400"/></div></div></header>;
}
