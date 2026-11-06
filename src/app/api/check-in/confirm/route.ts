import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyTicket } from "@/lib/security/qr-token";
import { COOKIE, getMemberSession } from "@/lib/auth/session";
import { deviceId } from "@/lib/auth/identity";
import { findByUsername, FriendlyError } from "@/lib/repo/people";
import { recordAttendance } from "@/lib/repo/services";
import { clientIp, rateLimit } from "@/lib/security/rate-limit";
import { firstName } from "@/lib/identity-utils";

/** Second step of QR check-in: the member types their flag username (no OTP needed). */
export async function POST(request: NextRequest) {
  const store = await cookies();
  const ticket = verifyTicket(store.get(COOKIE.ticket)?.value);
  if (!ticket) return NextResponse.json({ error: "Please scan the QR code on the screen first.", code: "no_ticket" }, { status: 401 });
  const device = await deviceId();
  if (!rateLimit(`confirm:${device}`, 8, 10 * 60000) || !rateLimit(`confirm-ip:${clientIp(request.headers)}`, 120, 60000)) {
    return NextResponse.json({ error: "Too many attempts from this device. Please see an usher." }, { status: 429 });
  }
  const parsed = z.object({ username: z.string().trim().max(40).optional() }).safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Enter your username." }, { status: 400 });
  const session = await db().get("qr_sessions", { id: ticket.sid });
  if (!session || session.status !== "active") return NextResponse.json({ error: "Check-in for this service is closed.", code: "closed" }, { status: 409 });

  let person = null;
  if (parsed.data.username) person = await findByUsername(parsed.data.username);
  else {
    const member = await getMemberSession();
    person = member ? await db().get("people", { id: member.pid }) : null;
  }
  if (!person) return NextResponse.json({ error: "We couldn't find that username. Check the spelling, or register if this is your first time.", code: "unknown_username" }, { status: 404 });

  try {
    const result = await recordAttendance({ person, serviceId: ticket.svc, method: "qr", deviceId: device });
    const service = await db().get("services", { id: ticket.svc });
    return NextResponse.json({
      status: result.status, firstName: firstName(person.full_name), username: person.username,
      checkedInAt: result.attendance.checked_in_at, service: service?.title ?? "Service"
    });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message, code: "device_used" }, { status: 409 });
    return NextResponse.json({ error: "Check-in could not be recorded. Please try again." }, { status: 500 });
  }
}
