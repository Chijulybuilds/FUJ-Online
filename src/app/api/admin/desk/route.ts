import { after, NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createPerson, FriendlyError } from "@/lib/repo/people";
import { recordAttendance } from "@/lib/repo/services";
import { sendFirstTimerWelcome, startFirstTimer } from "@/lib/repo/first-timers";
import { audit } from "@/lib/repo/audit";
import { normalizePhone } from "@/lib/identity-utils";

async function staff() {
  const admin = await getAdminSession();
  return admin && can(admin.role, "attendance") ? admin : null;
}

/** GET ?serviceId=&q= → matching people (name, username or phone) with their check-in state. */
export async function GET(request: NextRequest) {
  if (!(await staff())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const serviceId = request.nextUrl.searchParams.get("serviceId") ?? "";
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const [people, attendance] = await Promise.all([db().list("people"), db().list("attendance", { where: { service_id: serviceId } })]);
  const present = new Map(attendance.map((a) => [a.person_id, a.checked_in_at]));
  const digits = q.replace(/\D/g, "");
  const words = q.split(/\s+/).filter(Boolean);
  const matches = q
    ? people.filter((p) => {
        const name = p.full_name.toLowerCase();
        return words.every((w) => name.includes(w)) || p.username?.includes(q) || (digits.length >= 4 && p.normalized_phone.replace(/\D/g, "").includes(digits.replace(/^0/, "")));
      })
    : people.filter((p) => present.has(p.id));
  const sorted = matches
    .sort((a, b) => Number(present.has(a.id)) - Number(present.has(b.id)) || a.full_name.localeCompare(b.full_name))
    .slice(0, 30)
    .map((p) => ({ id: p.id, name: p.full_name, username: p.username, phone: p.phone, status: p.status, checkedInAt: present.get(p.id) ?? null }));
  return NextResponse.json({ people: sorted, total: attendance.length });
}

/**
 * POST { serviceId, personId } → check in; or { serviceId, fullName, phone, firstTimer } → add a new member and
 * check in. firstTimer = it's their first time at FlagUpJesus: starts their first-timer follow-up.
 */
export async function POST(request: NextRequest) {
  const admin = await staff();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ serviceId: z.string().min(1), personId: z.string().optional(), fullName: z.string().trim().min(2).max(120).optional(), phone: z.string().trim().min(7).max(24).optional(), firstTimer: z.boolean().optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Missing details." }, { status: 400 });
  const service = await db().get("services", { id: body.data.serviceId }).catch(() => null);
  if (!service || service.status === "cancelled") return NextResponse.json({ error: "Choose an active service." }, { status: 409 });
  try {
    let person = body.data.personId ? await db().get("people", { id: body.data.personId }).catch(() => null) : null;
    let created = false;
    if (!person && body.data.fullName && body.data.phone) {
      person = (await db().get("people", { normalized_phone: normalizePhone(body.data.phone) })) ?? null;
      if (!person) {
        person = await createPerson({ full_name: body.data.fullName, phone: body.data.phone, status: "member", verified_via: "in_person", first_timer: body.data.firstTimer ? true : null });
        await audit(admin.name, "person.create_at_desk", "people", person.id, { first_timer: Boolean(body.data.firstTimer) });
        created = true;
      }
    }
    if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    const result = await recordAttendance({ person, serviceId: service.id, method: "manual", recordedBy: admin.name });
    if (created && body.data.firstTimer) {
      const newcomer = person;
      const journey = await startFirstTimer(newcomer, { source: "desk", serviceId: service.id, firstVisitAt: result.attendance.checked_in_at, assignee: null })
        .then((r) => r.journey, (error) => { console.error("could not start first-timer follow-up", error); return null; });
      if (journey) after(() => sendFirstTimerWelcome([{ journey, person: newcomer }]).then(() => undefined, (error) => console.error("first-timer welcome failed", error)));
    }
    return NextResponse.json({ status: result.status, created, person: { id: person.id, name: person.full_name, username: person.username }, checkedInAt: result.attendance.checked_in_at });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Check-in failed." }, { status: 500 });
  }
}
