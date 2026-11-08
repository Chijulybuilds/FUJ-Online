import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE, getIdentity } from "@/lib/auth/session";
import { verifyTicket } from "@/lib/security/qr-token";
import { AuthCard } from "../../auth-card";
import { RegisterForm } from "../register-form";

export const dynamic = "force-dynamic";

export default async function CompleteRegistration() {
  const identity = await getIdentity();
  if (!identity) redirect("/register");
  const ticket = verifyTicket((await cookies()).get(COOKIE.ticket)?.value);
  return (
    <AuthCard>
      <h1 className="text-2xl font-bold">Almost there{identity.name ? `, ${identity.name.split(" ")[0]}` : ""}!</h1>
      <p className="mt-2 text-sm text-slate-500">Signed in as {identity.email ?? "your account"}. Add your phone number, birthday and home address to get your flag username.</p>
      <RegisterForm verified defaults={{ name: identity.name, email: identity.email ?? "" }} checkInNote={ticket ? "You'll be checked in to today's service automatically." : undefined} />
    </AuthCard>
  );
}
