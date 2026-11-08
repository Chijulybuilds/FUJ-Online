import { NextResponse, type NextRequest } from "next/server";
import { childRegistrationSchema } from "@/lib/validation/auth";
import { getMemberSession } from "@/lib/auth/session";
import { checkInFromTicket } from "@/lib/auth/identity";
import { db } from "@/lib/db";
import { FriendlyError } from "@/lib/repo/people";
import { registerChild } from "@/lib/repo/children";
import { audit } from "@/lib/repo/audit";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { normalizePhone } from "@/lib/identity-utils";

/**
 * "My child" registration: a child who doesn't have a phone registers with a parent's / guardian's number.
 * The child gets their own flag username (checked in automatically when registering from the service QR) and is
 * linked to the parent if the parent is already registered with that number. Nobody is signed in or out.
 */
export async function POST(request: NextRequest) {
  if (!rateLimit(`register:${clientIp(request.headers)}`, 40, 10 * 60000)) return NextResponse.json({ error: "Too many registrations from this network. Please wait." }, { status: 429 });
  const parsed = childRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Check the details." }, { status: 400 });
  const d = parsed.data;
  try {
    // A signed-in parent registering with their own number is linked directly.
    const session = await getMemberSession();
    const me = session ? await db().get("people", { id: session.pid }) : null;
    const guardian = me && !me.is_child && me.normalized_phone === normalizePhone(d.phone) ? me : null;
    const { child, guardian: linked } = await registerChild({
      full_name: d.fullName, birthday: d.birthday, gender: d.gender || null, phone: d.phone, email: d.email || null, address: d.address,
      guardian_name: d.guardianName, guardian_relationship: d.relationship, care_notes: d.careNotes || null, first_timer: d.firstTimer === "yes", guardian
    });
    const checkIn = await checkInFromTicket(child.id).catch(() => null);
    await audit(null, "person.register_child", "people", child.id, { guardian_linked: Boolean(linked), first_timer: d.firstTimer === "yes" });
    return NextResponse.json({
      username: child.username, name: child.full_name, checkedIn: Boolean(checkIn), guardianLinked: Boolean(linked),
      guardianName: linked?.full_name ?? d.guardianName
    });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Registration failed. Please try again." }, { status: 500 });
  }
}
