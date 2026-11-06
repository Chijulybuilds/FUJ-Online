import Link from "next/link";
import { env } from "@/lib/env";
import { AuthCard, ERRORS, GoogleButton } from "../auth-card";
import { MemberLoginForm, DevLoginForm } from "./forms";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ as?: string; error?: string }> }) {
  const { as, error } = await searchParams;
  const staff = as === "staff";
  return (
    <AuthCard>
      <div className="tabs mb-6"><Link href="/login" className={`tab ${!staff ? "active" : ""}`}>Member</Link><Link href="/login?as=staff" className={`tab ${staff ? "active" : ""}`}>Church staff</Link></div>
      <h1 className="text-2xl font-bold">{staff ? "Staff sign in" : "Welcome back"}</h1>
      <p className="mt-2 text-sm text-slate-500">{staff ? "Sign in with the Google account registered by your church admin." : "Use your flag username and phone number — no OTP needed."}</p>
      {error && <p className="alert alert-err mt-5">{ERRORS[error] ?? "Sign-in failed."}</p>}
      <div className="mt-6 space-y-4">
        <GoogleButton intent={staff ? "admin" : "member"} enabled={env.googleEnabled} />
        {!staff && <>{env.googleEnabled && <p className="text-center text-xs text-slate-400">or</p>}<MemberLoginForm /></>}
        {staff && !env.googleEnabled && !env.devLoginEnabled && <p className="alert alert-warn">Google sign-in is not configured. Add CLIENT_ID and CLIENT_SECRET to .env.local.</p>}
        {env.devLoginEnabled && <DevLoginForm intent={staff ? "admin" : "member"} />}
      </div>
      {!staff && <p className="mt-6 text-center text-sm text-slate-500">First time? <Link className="font-semibold text-blue-600" href="/register">Register</Link></p>}
    </AuthCard>
  );
}
