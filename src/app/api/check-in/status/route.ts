import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { verifyTicket } from "@/lib/security/qr-token";
import { COOKIE, getMemberSession } from "@/lib/auth/session";
import { familyForCheckIn } from "@/lib/repo/children";

export async function GET() {
  const store = await cookies();
  const ticket = verifyTicket(store.get(COOKIE.ticket)?.value);
  const member = await getMemberSession();
  const person = member ? await db().get("people", { id: member.pid }) : null;
  const service = ticket ? await db().get("services", { id: ticket.svc }) : null;
  const deviceId = store.get(COOKIE.device)?.value;
  let checkedIn: { name: string; at: string } | null = null;
  let family: Awaited<ReturnType<typeof familyForCheckIn>> = [];
  if (ticket) {
    const row = person
      ? await db().get("attendance", { person_id: person.id, service_id: ticket.svc })
      : deviceId ? await db().get("attendance", { service_id: ticket.svc, device_id: deviceId }) : null;
    if (row) {
      const who = person ?? (await db().get("people", { id: row.person_id }));
      checkedIn = { name: who?.full_name.split(" ")[0] ?? "", at: row.checked_in_at };
      if (who && !who.is_child) family = await familyForCheckIn(who, ticket.svc).catch(() => []);
    }
  }
  return NextResponse.json({
    ticket: ticket && service ? { service: { title: service.title, starts_at: service.starts_at }, expiresAt: ticket.exp } : null,
    member: person ? { name: person.full_name, username: person.username } : null,
    checkedIn, family
  });
}
