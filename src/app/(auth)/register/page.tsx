import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { QrCode } from "lucide-react";
import { env } from "@/lib/env";
import { COOKIE, getIdentity, getMemberSession } from "@/lib/auth/session";
import { verifyTicket } from "@/lib/security/qr-token";
import { db } from "@/lib/db";
import { AuthCard, GoogleButton } from "../auth-card";
import { DevLoginForm } from "../login/forms";
import { RegisterForm } from "./register-form";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  if (await getMemberSession()) redirect("/member");
  if (await getIdentity()) redirect("/register/complete");
  const ticket = verifyTicket((await cookies()).get(COOKIE.ticket)?.value);
  const service = ticket ? await db().get("services", { id: ticket.svc }) : null;
  return (
    <AuthCard wide>
      <h1 className="text-2xl font-bold">Join our church family</h1>
      <p className="mt-2 text-sm text-slate-500">Register once and you&apos;ll get a personal <b>flag</b> username. After that, checking in is just scan → type username.</p>
      {ticket ? (
        <RegisterForm defaults={{}} checkInNote={service ? `You'll be checked in to ${service.title} automatically.` : undefined} />
      ) : (
        <div className="mt-6 space-y-4">
          <GoogleButton intent="register" label="Register with Google" enabled={env.googleEnabled} />
          <div className="flex items-start gap-3 rounded-xl bg-slate-50 p-4 text-sm text-slate-600"><QrCode className="mt-0.5 shrink-0 text-blue-600" size={18} /><p>At church right now? Scan the QR code on the screen and tap <b>Register</b> — no Google account needed.</p></div>
          {env.devLoginEnabled && <DevLoginForm intent="register" />}
        </div>
      )}
      <p className="mt-6 text-center text-sm text-slate-500">Already registered? <Link className="font-semibold text-blue-600" href="/login">Sign in</Link></p>
    </AuthCard>
  );
}
