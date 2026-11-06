import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { env } from "@/lib/env";
import { getAdminSession } from "@/lib/auth/session";
import { AuthCard, ERRORS, GoogleButton } from "../../../(auth)/auth-card";
import { DevLoginForm } from "../../../(auth)/login/forms";
import { AdminLoginForm } from "./form";

export const dynamic = "force-dynamic";

export default async function AdminLoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  if (await getAdminSession()) redirect("/admin");
  const { error } = await searchParams;
  return (
    <AuthCard>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><ShieldCheck /></span>
      <h1 className="mt-5 text-2xl font-bold">FUJ Admin</h1>
      <p className="mt-2 text-sm text-slate-500">For FlagUpJesus ministry staff only.</p>
      {error && <p className="alert alert-err mt-5">{ERRORS[error] ?? "Sign-in failed."}</p>}
      <div className="mt-6 space-y-4">
        {env.sharedAdmin ? <AdminLoginForm /> : <p className="alert alert-warn">The FUJ admin login isn&apos;t set up yet. Add ADMIN_LOGIN_EMAIL and ADMIN_LOGIN_PASSWORD to the server environment.</p>}
        {env.googleEnabled && <><div className="flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or, if you have your own staff account<span className="h-px flex-1 bg-slate-200" /></div><GoogleButton intent="admin" label="Staff sign in with Google" enabled /></>}
        {env.devLoginEnabled && <DevLoginForm intent="admin" />}
      </div>
    </AuthCard>
  );
}
