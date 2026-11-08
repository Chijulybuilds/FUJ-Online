import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyTicket } from "@/lib/security/qr-token";
import { COOKIE } from "@/lib/auth/session";
import { deviceId } from "@/lib/auth/identity";
import { FriendlyError, sameFamily } from "@/lib/repo/people";
import { recordAttendance } from "@/lib/repo/services";
import { familyForCheckIn } from "@/lib/repo/children";
import { firstName } from "@/lib/identity-utils";

/**
 * Family check-in: right after a parent checks in on their phone, they can check in their children (who use the
 * parent's number) with one tap. Only works on the same phone, for the same service, for that parent's children.
 */
export async function POST(request: NextRequest) {
  const ticket = verifyTicket((await cookies()).get(COOKIE.ticket)?.value);
  if (!ticket) return NextResponse.json({ error: "Please scan the QR code on the screen first.", code: "no_ticket" }, { status: 401 });
  const parsed = z.object({ personId: z.string().min(1).max(64) }).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Choose a child to check in." }, { status: 400 });
  const session = await db().get("qr_sessions", { id: ticket.sid });
  if (!session || session.status !== "active") return NextResponse.json({ error: "Check-in for this service is closed.", code: "closed" }, { status: 409 });
  const device = await deviceId();
  const mine = await db().list("attendance", { where: { service_id: ticket.svc, device_id: device } });
  const people = mine.length ? await db().list("people", { where: { id: mine.map((a) => a.person_id) } }) : [];
  const parent = people.find((p) => !p.is_child);
  const child = await db().get("people", { id: parsed.data.personId }).catch(() => null);
  if (!parent || !child || !child.is_child || !sameFamily(parent, child)) {
    return NextResponse.json({ error: "Check yourself in first — then you can check in your children.", code: "not_family" }, { status: 403 });
  }
  try {
    const result = await recordAttendance({ person: child, serviceId: ticket.svc, method: "qr", deviceId: device });
    return NextResponse.json({ status: result.status, firstName: firstName(child.full_name), family: await familyForCheckIn(parent, ticket.svc) });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    return NextResponse.json({ error: "Check-in could not be recorded. Please try again." }, { status: 500 });
  }
}
