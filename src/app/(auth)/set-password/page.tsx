import Link from "next/link";
import { AuthCard } from "../auth-card";
import { checkPasswordLink } from "@/lib/repo/accounts";
import { SetPasswordForm, ForgotPasswordForm } from "../login/forms";

export const dynamic = "force-dynamic";

const PROBLEM = {
  invalid: "This link isn't valid — it may have been copied incompletely.",
  expired: "This link has expired.",
  used: "This link has already been used to set a password."
} as const;

/** Opened from the "Set my password" button in the welcome email (or a forgot-password email). */
export default async function SetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const link = await checkPasswordLink(token);
  return (
    <AuthCard>
      {link.ok ? (
        <>
          <h1 className="text-2xl font-bold">Set your password, {link.person.full_name.split(" ")[0]} 🔐</h1>
          <p className="mt-2 text-sm text-slate-500">Then you can sign in to your membership dashboard with your username (or email) and this password — or keep using your phone number. Your check-in username stays the same.</p>
          <div className="mt-5 flex items-center justify-between rounded-xl bg-slate-50 p-4">
            <span className="text-xs text-slate-500">Your username</span>
            <b className="username-badge text-lg text-blue-600" data-testid="set-password-username">{link.person.username}</b>
          </div>
          <SetPasswordForm token={token!} username={link.person.username ?? ""} />
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold">Let&apos;s get you a new link</h1>
          <p className="alert alert-warn mt-4" data-testid="set-password-problem">{PROBLEM[link.reason]}</p>
          <p className="mt-4 text-sm text-slate-500">Enter your username or email and we&apos;ll email you a fresh link.</p>
          <ForgotPasswordForm />
          <p className="mt-6 text-center text-sm text-slate-500"><Link className="font-semibold text-blue-600" href="/login">Back to sign in</Link></p>
        </>
      )}
    </AuthCard>
  );
}
