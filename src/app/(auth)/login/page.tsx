import Link from "next/link";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { AuthCard, ERRORS, GoogleButton } from "../auth-card";
import { MemberLoginForm, DevLoginForm } from "./forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; error?: string }> }) {
  const { as, error } = await searchParams;
  if (as === "staff") redirect("/admin/login"); // old links
  return (
    <AuthCard>
      <h1 className="text-2xl font-bold">Welcome back</h1>
      <p className="mt-2 text-sm text-slate-500">Sign in with Google, or your flag username and phone number.</p>
      {error && <p className="alert alert-err mt-5">{ERRORS[error] ?? "Sign-in failed."}</p>}
      <div className="mt-6 space-y-4">
        <GoogleButton intent="member" enabled={env.googleEnabled} />
        {env.googleEnabled && <p className="text-center text-xs text-slate-400">or</p>}
        <MemberLoginForm />
        {env.devLoginEnabled && <DevLoginForm intent="member" />}
      </div>
      <p className="mt-6 text-center text-sm text-slate-500">First time? <Link className="font-semibold text-blue-600" href="/register">Register</Link></p>
    </AuthCard>
  );
}
