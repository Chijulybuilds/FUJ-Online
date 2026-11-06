import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdmin } from "@/lib/auth/session";
export const dynamic = "force-dynamic";
export default async function Layout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell name={admin.name} role={admin.role}>{children}</AdminShell>;
}
