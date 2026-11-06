import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";
import { ROLE_ACCESS, ROLE_LABELS } from "@/lib/auth/roles";
import type { StaffRole } from "@/lib/db/types";

export function AdminShell({ children, name, role }: { children: ReactNode; name: string; role: StaffRole }) {
  const areas = ROLE_ACCESS[role];
  return (
    <div className="shell">
      <Sidebar areas={areas} name={name} roleLabel={ROLE_LABELS[role]} />
      <div className="main-area">
        <Topbar name={name} roleLabel={ROLE_LABELS[role]} areas={areas} />
        <main className="content">{children}<footer className="mt-10 border-t border-slate-200 pt-5 text-xs text-slate-400">© {new Date().getFullYear()} FlagUpJesus Global Ministry · FlagUpJesus</footer></main>
      </div>
    </div>
  );
}
