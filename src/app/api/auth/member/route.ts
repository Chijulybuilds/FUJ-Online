import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findByUsername } from "@/lib/repo/people";
import { normalizePhone } from "@/lib/identity-utils";
import { setMemberSession } from "@/lib/auth/identity";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { sendWelcomeEmail, signInWithPassword } from "@/lib/repo/accounts";

const schema = z.union([
  z.object({ username: z.string().trim().min(3).max(40), phone: z.string().trim().min(7).max(24) }),
  z.object({ login: z.string().trim().min(3).max(120), password: z.string().min(1).max(200) })
]);

/**
 * Member portal sign-in: flag username + registered phone number (no OTP), or username / email + password
 * (for members who set one from their welcome email or profile).
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`member-login:${clientIp(request.headers)}`, 10, 10 * 60000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username and phone number (or password)." }, { status: 400 });
  const d = parsed.data;
  let person = null;
  if ("password" in d) {
    if (!rateLimit(`member-password:${d.login.toLowerCase()}`, 8, 15 * 60000)) return NextResponse.json({ error: "Too many attempts for this account. Please wait 15 minutes." }, { status: 429 });
    person = await signInWithPassword(d.login, d.password);
    if (!person) return NextResponse.json({ error: "That username or email and password don't match. Try your phone number instead, or reset your password." }, { status: 401 });
  } else {
    person = await findByUsername(d.username);
    if (!person || person.normalized_phone !== normalizePhone(d.phone)) {
      return NextResponse.json({ error: "That username and phone number don't match our records." }, { status: 401 });
    }
  }
  await setMemberSession(person);
  // Registered before welcome emails existed? Their flag username + password link goes out now.
  if (person.email && !person.welcome_email_sent_at) {
    const who = person;
    after(() => sendWelcomeEmail(who).then(() => undefined, (error) => console.error("welcome email failed", error)));
  }
  return NextResponse.json({ redirect: "/member" });
}
