import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
export function AdminShell({ children }: { children:ReactNode }) {
 return <div className="shell"><Sidebar/><div className="main-area"><Topbar/><main className="content">{children}<footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">© {new Date().getFullYear()} Flag of Jesus Global Ministry · FlagUpJesus</footer></main></div></div>;
}
