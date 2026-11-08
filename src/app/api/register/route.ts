import { after, NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { registrationSchema } from "@/lib/validation/auth";
import { COOKIE, getIdentity } from "@/lib/auth/session";
import { checkInFromTicket, setMemberSession } from "@/lib/auth/identity";
import { createPerson, FriendlyError } from "@/lib/repo/people";
import { sendFirstTimerWelcome, startFirstTimer } from "@/lib/repo/first-timers";
import { addPartner, sendPartnerThanks } from "@/lib/repo/partners";
import { audit } from "@/lib/repo/audit";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { verifyOtp } from "@/lib/repo/otp";
import { env } from "@/lib/env";
import { db } from "@/lib/db";

/**
 * First-time registration: full name + phone + birthday + home address (+ optional email), or Google sign-in
 * followed by the same details. People also say whether it's their FIRST TIME at FlagUpJesus (first timers get
 * their own follow-up journey; existing members registering online don't) and can ask to become a FUJ Partner.
 * The person receives a unique "flag…" username and is checked in automatically if they arrived by
 * scanning the service QR. No paid SMS OTP by default: self-registered people are confirmed for free —
 * by Google, by their first in-person check-in (live QR or usher desk), or by an admin.
 * Set REGISTRATION_OTP=true (with Termii configured) to require an SMS code as well.
 */
export async function POST(request: NextRequest) {
  // Generous per-IP limit: on Sunday many new members share the church Wi-Fi.
  if (!rateLimit(`register:${clientIp(request.headers)}`, 40, 10 * 60000)) return NextResponse.json({ error: "Too many registrations from this network. Please wait." }, { status: 429 });
  const store = await cookies();
  const identity = await getIdentity();
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check your details." }, { status: 400 });
  const d = parsed.data;
  const otpUsed = !identity && env.registrationOtp;
  if (otpUsed) {
    if (!d.code) return NextResponse.json({ error: "Enter the code we sent to your phone, or continue with Google.", code: "otp_required" }, { status: 401 });
    if (!(await verifyOtp(d.phone, d.code))) return NextResponse.json({ error: "That code is wrong or has expired. Request a new one.", code: "otp_invalid" }, { status: 401 });
  }
  try {
    const person = await createPerson({
      full_name: d.fullName, phone: d.phone, email: d.email || identity?.email || null, status: "member",
      birthday: d.birthday, address: d.address, first_timer: d.firstTimer === "yes",
      auth_subject: identity ? `${identity.provider}:${identity.sub}` : null, avatar_url: identity?.avatar ?? null,
      verified_via: identity?.provider === "google" ? "google" : otpUsed ? "otp" : "registration"
    });
    store.delete(COOKIE.identity);
    await setMemberSession(person);
    const checkIn = await checkInFromTicket(person.id).catch(() => null);
    // Never let the follow-up workflows stop someone registering (e.g. database not yet updated).
    const journey = d.firstTimer === "yes"
      ? await startFirstTimer(person, { source: "registration", serviceId: checkIn?.attendance.service_id ?? null, firstVisitAt: checkIn?.attendance.checked_in_at ?? null })
        .then((r) => r.journey, (error) => { console.error("could not start first-timer follow-up", error); return null; })
      : null;
    const partner = d.partner
      ? await addPartner({ personId: person.id, source: "registration" }).then((r) => r.partner, (error) => { console.error("could not add partner", error); return null; })
      : null;
    await audit(null, "person.self_register", "people", person.id, { via: identity?.provider ?? (otpUsed ? "phone_otp" : "phone"), first_timer: d.firstTimer === "yes", partner: Boolean(partner) });
    // Welcome / thank-you messages go out after the response, so registering stays instant.
    if (journey || partner) {
      after(async () => {
        try {
          const fresh = (await db().get("people", { id: person.id })) ?? person;
          if (journey) await sendFirstTimerWelcome([{ journey, person: fresh }]);
          if (partner) await sendPartnerThanks([{ partner, person: fresh }]);
        } catch (error) {
          console.error("welcome / partner thank-you message failed", error);
        }
      });
    }
    return NextResponse.json({ username: person.username, name: person.full_name, checkedIn: Boolean(checkIn), firstTimer: Boolean(journey), partner: Boolean(partner) });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
