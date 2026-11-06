import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/auth/session";
import { can } from "@/lib/auth/roles";
import { createPerson, FriendlyError } from "@/lib/repo/people";
import { recordAttendance } from "@/lib/repo/services";
import { createTask } from "@/lib/repo/care";
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

/** POST { serviceId, personId } → check in; or { serviceId, fullName, phone } → add a first-timer and check in. */
export async function POST(request: NextRequest) {
  const admin = await staff();
  if (!admin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = z.object({ serviceId: z.string().min(1), personId: z.string().optional(), fullName: z.string().trim().min(2).max(120).optional(), phone: z.string().trim().min(7).max(24).optional() }).safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Missing details." }, { status: 400 });
  const service = await db().get("services", { id: body.data.serviceId }).catch(() => null);
  if (!service || service.status === "cancelled") return NextResponse.json({ error: "Choose an active service." }, { status: 409 });
  try {
    let person = body.data.personId ? await db().get("people", { id: body.data.personId }).catch(() => null) : null;
    let created = false;
    if (!person && body.data.fullName && body.data.phone) {
      person = (await db().get("people", { normalized_phone: normalizePhone(body.data.phone) })) ?? null;
      if (!person) {
        person = await createPerson({ full_name: body.data.fullName, phone: body.data.phone, status: "visitor" });
        await createTask({ person_id: person.id, category: "first_timer", reason: "First-timer added at the check-in desk — welcome call" });
        await audit(admin.name, "person.create_at_desk", "people", person.id);
        created = true;
      }
    }
    if (!person) return NextResponse.json({ error: "Person not found." }, { status: 404 });
    const result = await recordAttendance({ person, serviceId: service.id, method: "manual", recordedBy: admin.name });
    return NextResponse.json({ status: result.status, created, person: { id: person.id, name: person.full_name, username: person.username }, checkedInAt: result.attendance.checked_in_at });
  } catch (error) {
    if (error instanceof FriendlyError) return NextResponse.json({ error: error.message }, { status: 409 });
    console.error(error);
    return NextResponse.json({ error: "Check-in failed." }, { status: 500 });
  }
}
