import "server-only";
import { db } from "@/lib/db";
import type { Leader, Person } from "@/lib/db/types";
import { normalizePhone } from "@/lib/identity-utils";
import { nowIso, uid } from "@/lib/utils";
import { createPerson, findByPhone, FriendlyError, peopleById, updatePerson } from "./people";

export type LeaderRow = Leader & { person: Person };

/** Tidies a unit name so "choir " and "Choir" end up as the same unit. */
export function cleanUnit(unit: string) {
  const t = unit.replace(/\s+/g, " ").trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : "";
}
const sameUnit = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function listLeaders(): Promise<LeaderRow[]> {
  const leaders = await db().list("leaders");
  const people = await peopleById(leaders.map((l) => l.person_id));
  return leaders
    .flatMap((l) => { const person = people.get(l.person_id); return person ? [{ ...l, person }] : []; })
    .sort((a, b) => a.unit.localeCompare(b.unit) || a.person.full_name.localeCompare(b.person.full_name));
}

/** Distinct units with how many leaders each has, A–Z. */
export async function leaderUnits(): Promise<{ unit: string; count: number }[]> {
  const counts = new Map<string, { unit: string; count: number }>();
  for (const l of await db().list("leaders")) {
    const key = l.unit.trim().toLowerCase();
    counts.set(key, { unit: counts.get(key)?.unit ?? l.unit, count: (counts.get(key)?.count ?? 0) + 1 });
  }
  return [...counts.values()].sort((a, b) => a.unit.localeCompare(b.unit));
}

/** People on the leaders list — all of them, or one unit's. Used by broadcasts. */
export async function leaderPeople(unit?: string): Promise<Person[]> {
  const leaders = (await db().list("leaders")).filter((l) => !unit || sameUnit(l.unit, unit));
  return [...(await peopleById(leaders.map((l) => l.person_id))).values()];
}

export type LeaderInput = { full_name: string; unit: string; phone: string; email?: string | null };

function validate(input: LeaderInput) {
  const full_name = input.full_name.replace(/\s+/g, " ").trim();
  const unit = cleanUnit(input.unit);
  const email = input.email?.trim().toLowerCase() || null;
  if (full_name.length < 2) throw new FriendlyError("Enter the leader's full name.");
  if (!unit) throw new FriendlyError("Enter the unit they lead (e.g. Choir).");
  if (unit.length > 60) throw new FriendlyError("Keep the unit name under 60 characters.");
  const normalized = normalizePhone(input.phone);
  if (!normalized || normalized.length < 8) throw new FriendlyError("Enter a valid WhatsApp number, e.g. 0803 000 0000.");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new FriendlyError("That email address doesn't look right.");
  return { full_name, unit, phone: input.phone.trim(), normalized, email };
}

/**
 * Adds a leader. If someone already registered with this WhatsApp number, that member record is
 * reused (so their messages also reach their member portal); otherwise a member record is created.
 */
export async function addLeader(input: LeaderInput, actor: string): Promise<{ leader: Leader; person: Person; linked: boolean }> {
  const v = validate(input);
  let person = await findByPhone(v.normalized);
  const linked = Boolean(person);
  if (person) {
    const existing = await db().get("leaders", { person_id: person.id });
    if (existing) throw new FriendlyError(`${person.full_name} is already on the leaders list (${existing.unit}).`);
    const patch: Partial<Person> = {};
    if (v.email && !person.email) patch.email = v.email;
    if (person.status !== "member") patch.status = "member";
    if (Object.keys(patch).length) person = await updatePerson(person.id, patch);
  } else {
    person = await createPerson({ full_name: v.full_name, phone: v.phone, email: v.email, status: "member", verified_via: "admin" });
  }
  const now = nowIso();
  const leader = await db().insert("leaders", { id: uid(), person_id: person.id, unit: v.unit, added_by: actor, created_at: now, updated_at: now });
  return { leader, person, linked };
}

/** Edits a leader's name, unit, WhatsApp number and email (contact details live on their member record). */
export async function updateLeader(id: string, input: LeaderInput) {
  const leader = await db().get("leaders", { id });
  if (!leader) throw new FriendlyError("That leader was not found — refresh the page.");
  const v = validate(input);
  await updatePerson(leader.person_id, { full_name: v.full_name, phone: v.phone, email: v.email });
  const [row] = await db().update("leaders", { id }, { unit: v.unit, updated_at: nowIso() });
  return row;
}

/** Takes someone off the leaders list. Their member record (and message history) stays. */
export async function removeLeader(id: string) {
  const leader = await db().get("leaders", { id });
  if (!leader) return null;
  const person = await db().get("people", { id: leader.person_id });
  await db().remove("leaders", { id });
  return { ...leader, name: person?.full_name ?? "The leader" };
}
