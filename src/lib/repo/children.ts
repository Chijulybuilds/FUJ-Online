import "server-only";
import { db } from "@/lib/db";
import type { Person } from "@/lib/db/types";
import { ADULT_AGE, ageGroupOf, ageOf, nextBirthday } from "@/lib/children";
import { childrenOf, createPerson, findByPhone, FriendlyError } from "./people";

/**
 * Children's registration. A child without a phone registers with a parent's / guardian's number: they get their
 * own record and flag username (for check-in and attendance) and are linked to the parent when the parent is a
 * registered member with that number (or becomes one later). Their WhatsApp / SMS / email go to the parent.
 */
export type ChildInput = {
  full_name: string; birthday: string; gender?: string | null; phone: string; email?: string | null; address?: string | null;
  guardian_name?: string | null; guardian_relationship?: string | null; care_notes?: string | null; first_timer?: boolean | null;
  /** The parent's member record when they're signed in / chosen by staff. */
  guardian?: Person | null; verified_via?: Person["verified_via"];
};

export async function registerChild(input: ChildInput) {
  const age = ageOf(input.birthday);
  if (age === null) throw new FriendlyError("Enter the child's birthday.");
  if (age >= ADULT_AGE) throw new FriendlyError("Children's registration is for under-18s. Register as yourself instead.");
  const guardian = input.guardian ?? await findByPhone(input.phone);
  if (guardian?.is_child) throw new FriendlyError("Use a parent's or guardian's phone number.");
  const guardianName = guardian?.full_name ?? input.guardian_name?.trim();
  if (!guardianName || guardianName.length < 2) throw new FriendlyError("Enter the parent's or guardian's full name.");
  const child = await createPerson({
    full_name: input.full_name, phone: guardian?.phone ?? input.phone, email: input.email || guardian?.email || null, status: "member",
    birthday: input.birthday, gender: input.gender || null, address: input.address || guardian?.address || null,
    is_child: true, guardian_id: guardian?.id ?? null, guardian_name: guardianName, guardian_relationship: input.guardian_relationship || null,
    care_notes: input.care_notes || null, first_timer: input.first_timer ?? null, verified_via: input.verified_via ?? "registration"
  });
  return { child, guardian };
}

export type ChildRow = Person & {
  age: number | null; group: ReturnType<typeof ageGroupOf>; guardian: Person | null;
  visits: number; lastSeen: string | null; birthdayIn: number | null; turning: number | null; inToday: boolean;
};

/** Every registered child with their parent, age group, attendance and next birthday (for the admin page). */
export async function listChildren(now = new Date()): Promise<ChildRow[]> {
  const people = await db().list("people", { order: { column: "full_name" } });
  const kids = people.filter((p) => p.is_child);
  if (!kids.length) return [];
  const byId = new Map(people.map((p) => [p.id, p]));
  const adultByPhone = new Map(people.filter((p) => !p.is_child).map((p) => [p.normalized_phone, p]));
  const attendance = await db().list("attendance", { where: { person_id: kids.map((k) => k.id) } });
  const lagosToday = new Date(now.getTime() + 3600000).toISOString().slice(0, 10);
  return kids.map((k) => {
    const mine = attendance.filter((a) => a.person_id === k.id);
    const last = mine.reduce<string | null>((m, a) => (!m || a.checked_in_at > m ? a.checked_in_at : m), null);
    const age = ageOf(k.birthday, now);
    const next = nextBirthday(k.birthday, now);
    return {
      ...k, age, group: ageGroupOf(age), guardian: (k.guardian_id ? byId.get(k.guardian_id) : adultByPhone.get(k.normalized_phone)) ?? null,
      visits: mine.length, lastSeen: last, birthdayIn: next?.days ?? null, turning: next?.turning ?? null,
      inToday: mine.some((a) => new Date(new Date(a.checked_in_at).getTime() + 3600000).toISOString().slice(0, 10) === lagosToday)
    };
  });
}

/** A parent's children with their check-in state for one service (family check-in). */
export async function familyForCheckIn(parent: Person, serviceId: string) {
  const kids = await childrenOf(parent);
  if (!kids.length) return [];
  const present = new Set((await db().list("attendance", { where: { service_id: serviceId, person_id: kids.map((k) => k.id) } })).map((a) => a.person_id));
  return kids.map((k) => ({ id: k.id, name: k.full_name, firstName: k.full_name.split(/\s+/)[0], username: k.username, age: ageOf(k.birthday), checkedIn: present.has(k.id) }));
}
