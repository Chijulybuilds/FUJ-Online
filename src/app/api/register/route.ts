import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { registrationSchema } from "@/lib/validation/auth";
import { COOKIE, getIdentity } from "@/lib/auth/session";
import { checkInFromTicket, setMemberSession } from "@/lib/auth/identity";
import { createPerson, FriendlyError } from "@/lib/repo/people";
import { createTask } from "@/lib/repo/care";
import { audit } from "@/lib/repo/audit";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { verifyOtp } from "@/lib/repo/otp";

/**
 * First-time registration: full name + phone (verified by SMS code) + optional email, or Google sign-in
 * followed by name + phone. The person receives a unique "flag…" username, and is checked in
 * automatically if they arrived by scanning the service QR.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`register:${clientIp(request.headers)}`, 20, 10 * 60000)) return NextResponse.json({ error: "Too many registrations from this network. Please wait." }, { status: 429 });
  const store = await cookies();
  const identity = await getIdentity();
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
  const d = parsed.data;
  if (!identity) {
    if (!d.code) return NextResponse.json({ error: "Enter the code we sent to your phone, or continue with Google.", code: "otp_required" }, { status: 401 });
    if (!(await verifyOtp(d.phone, d.code))) return NextResponse.json({ error: "That code is wrong or has expired. Request a new one.", code: "otp_invalid" }, { status: 401 });
  }
  try {
    const person = await createPerson({
      full_name: d.fullName, phone: d.phone, email: d.email || identity?.email || null, status: "visitor",
      auth_subject: identity ? `${identity.provider}:${identity.sub}` : null, avatar_url: identity?.avatar ?? null
    });
    store.delete(COOKIE.identity);
    await setMemberSession(person);
    const checkIn = await checkInFromTicket(person.id).catch(() => null);
    await createTask({ person_id: person.id, category: "first_timer", reason: "New registration — welcome call within 48 hours", due_at: new Date(Date.now() + 2 * 86400000).toISOString() });
    await audit(null, "person.self_register", "people", person.id, { via: identity?.provider ?? "phone_otp" });
    return NextResponse.json({ username: person.username, name: person.full_name, checkedIn: Boolean(checkIn) });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
