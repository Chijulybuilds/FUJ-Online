import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { checkPasswordLink, setPassword } from "@/lib/repo/accounts";
import { FriendlyError } from "@/lib/repo/people";
import { setMemberSession } from "@/lib/auth/identity";
import { audit } from "@/lib/repo/audit";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

const LINK_ERRORS = {
  invalid: "This link isn't valid. Ask for a new one on the sign-in page (Forgot password).",
  expired: "This link has expired. Ask for a new one on the sign-in page (Forgot password).",
  used: "This link has already been used. Sign in with your password, or ask for a new link."
} as const;

/** POST { token, password } — from the "Set my password" link in the welcome / reset email. Signs them in. */
export async function POST(request: NextRequest) {
  if (!rateLimit(`set-password:${clientIp(request.headers)}`, 20, 10 * 60000)) return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  const parsed = z.object({ token: z.string().min(10).max(2000), password: z.string().max(200), confirm: z.string().max(200) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your new password twice." }, { status: 400 });
  if (parsed.data.password !== parsed.data.confirm) return NextResponse.json({ error: "The two passwords don't match." }, { status: 400 });
  const link = await checkPasswordLink(parsed.data.token);
  if (!link.ok) return NextResponse.json({ error: LINK_ERRORS[link.reason], code: link.reason }, { status: 410 });
  try {
    await setPassword(link.person.id, parsed.data.password);
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  await setMemberSession(link.person);
  await audit(null, "member.password_set", "people", link.person.id, { via: "email_link" });
  return NextResponse.json({ redirect: "/member?password=set" });
}
