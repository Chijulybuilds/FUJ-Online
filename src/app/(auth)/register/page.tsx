import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { env } from "@/lib/env";
import { COOKIE, getIdentity, getMemberSession } from "@/lib/auth/session";
import { verifyTicket } from "@/lib/security/qr-token";
import { db } from "@/lib/db";
import { AuthCard, GoogleButton } from "../auth-card";
import { DevLoginForm } from "../login/forms";
import { RegisterTabs } from "./register-tabs";

export const dynamic = "force-dynamic";

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { child } = await searchParams;
  // Signed-in parents add their children from their portal.
  if (await getMemberSession()) redirect(child ? "/member/children" : "/member");
  if (await getIdentity()) redirect("/register/complete");
  const ticket = verifyTicket((await cookies()).get(COOKIE.ticket)?.value);
  const service = ticket ? await db().get("services", { id: ticket.svc }) : null;
  return (
    <AuthCard>
      <h1 className="text-2xl font-bold">Join our church family</h1>
      <p className="mt-2 text-sm text-slate-500">Register once and get your personal <b>flag</b> username — after that, checking in is just scan → type username.</p>
      <RegisterTabs
        initial={child ? "child" : "self"} otp={env.registrationOtp}
        checkInNote={ticket && service ? `You'll be checked in to ${service.title} automatically.` : undefined}
        google={<>
          <GoogleButton intent="register" label="Continue with Google" enabled={env.googleEnabled} />
          {env.googleEnabled && <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />or register with your phone<span className="h-px flex-1 bg-slate-200" /></div>}
        </>}
        dev={env.devLoginEnabled ? <div className="mt-4"><DevLoginForm intent="register" /></div> : undefined}
      />
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-blue-600" href="/login">Sign in</Link></p>
    </AuthCard>
  );
}
