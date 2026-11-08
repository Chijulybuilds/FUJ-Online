import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { COOKIE, getIdentity, getMemberSession } from "@/lib/auth/session";
import { verifyTicket } from "@/lib/security/qr-token";
import { db } from "@/lib/db";
import { AuthCard, GoogleButton } from "../auth-card";
import { DevLoginForm } from "../login/forms";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  // Someone signed in on this phone (e.g. a parent) can still register someone new — like their child.
  const session = await getMemberSession();
  const signedIn = session ? await db().get("people", { id: session.pid }).catch(() => null) : null;
  if (!signedIn && await getIdentity()) redirect("/register/complete");
  const ticket = verifyTicket((await cookies()).get(COOKIE.ticket)?.value);
  const service = ticket ? await db().get("services", { id: ticket.svc }) : null;
  return (
    <AuthCard>
      <h1 className="text-2xl font-bold">Join our church family</h1>
      <p className="mt-2 text-sm text-slate-500">Register once and get your personal <b>flag</b> username — after that, checking in is just scan → type username.</p>
      {signedIn && <p className="alert alert-ok mt-4 text-sm" data-testid="signed-in-note">You&apos;re signed in as <b>{signedIn.full_name.split(" ")[0]}</b>. This form registers someone new — for example your child. <Link href="/member" className="font-semibold underline">Go to my portal</Link></p>}
      <div className="mt-6"><GoogleButton intent="register" label="Continue with Google" enabled={env.googleEnabled} /></div>
      {env.googleEnabled && <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or register with your phone<span className="h-px flex-1 bg-slate-200" /></div>}
      <RegisterForm otp={env.registrationOtp} defaults={{}} checkInNote={ticket && service ? `You'll be checked in to ${service.title} automatically.` : undefined} />
      {env.devLoginEnabled && <div className="mt-4"><DevLoginForm intent="register" /></div>}
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-blue-600" href="/login">Sign in</Link></p>
    </AuthCard>
  );
}
