import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { findByUsername } from "@/lib/repo/people";
import { normalizePhone } from "@/lib/identity-utils";
import { setMemberSession } from "@/lib/auth/identity";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";

/** Member portal sign-in with flag username + registered phone number (no OTP). */
export async function POST(request: NextRequest) {
  if (!rateLimit(`member-login:${clientIp(request.headers)}`, 10, 10 * 60000)) {
    return NextResponse.json({ error: "Too many attempts. Please wait a few minutes." }, { status: 429 });
  }
  const parsed = z.object({ username: z.string().trim().min(3).max(40), phone: z.string().trim().min(7).max(24) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username and phone number." }, { status: 400 });
  const person = await findByUsername(parsed.data.username);
  if (!person || person.normalized_phone !== normalizePhone(parsed.data.phone)) {
    return NextResponse.json({ error: "That username and phone number don't match our records." }, { status: 401 });
  }
  await setMemberSession(person);
  return NextResponse.json({ redirect: "/member" });
}
