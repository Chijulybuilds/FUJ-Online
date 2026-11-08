import "server-only";
import { db, DuplicateError } from "@/lib/db";
import type { Person, PersonStatus } from "@/lib/db/types";
import { generateUsername, normalizePhone, usernameCandidates } from "@/lib/identity-utils";
import { nowIso, uid } from "@/lib/utils";

export class FriendlyError extends Error {}

export async function findByUsername(input: string): Promise<Person | null> {
  for (const candidate of usernameCandidates(input)) {
    const person = await db().get("people", { username: candidate });
    if (person) return person;
  }
  return null;
}

export async function findByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized ? db().get("people", { normalized_phone: normalized }) : null;
}

export async function findByEmail(email: string) {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const direct = await db().get("people", { email: target });
  if (direct) return direct;
  return (await db().list("people")).find((p) => p.email?.toLowerCase() === target) ?? null;
}

export type NewPerson = {
  full_name: string; phone: string; email?: string | null; status?: PersonStatus; gender?: string | null; birthday?: string | null;
  address?: string | null; how_heard?: string | null; auth_subject?: string | null; avatar_url?: string | null; notes?: string | null;
  verified_via?: Person["verified_via"];
  /** "Is this your first time at FlagUpJesus?" — false = an existing member registering online. */
  first_timer?: boolean | null;
};

async function nextPersonCode() {
  const people = await db().list("people");
  const max = people.reduce((m, p) => Math.max(m, Number(p.person_code?.replace(/\D/g, "") ?? 0) || 0), 0);
  return `FOJ-${String(max + 1).padStart(4, "0")}`;
}

/** Saves a new person; if the database hasn't been updated with the newest column yet, saves without it. */
async function insertPerson(row: Person) {
  try {
    return await db().insert("people", row);
  } catch (error) {
    if (!(error instanceof DuplicateError) && error instanceof Error && /first_timer/.test(error.message)) {
      console.error("people.first_timer is missing — re-run supabase/setup.sql. Saving without it.");
      const { first_timer: _skip, ...rest } = row;
      void _skip;
      return await db().insert("people", rest as Person);
    }
    throw error;
  }
}

/** Creates the church person record and assigns a unique "flag…" username. */
export async function createPerson(input: NewPerson): Promise<Person> {
  const normalized = normalizePhone(input.phone);
  if (!normalized || normalized.length < 8) throw new FriendlyError("Enter a valid phone number.");
  const existing = await db().get("people", { normalized_phone: normalized });
  if (existing) throw new FriendlyError("This phone number is already registered. Sign in with your username instead.");
  const now = nowIso();
  for (let attempt = 0; attempt < 25; attempt++) {
    const username = generateUsername(input.full_name);
    if (await db().get("people", { username })) continue;
    try {
      return await insertPerson({
        id: uid(), person_code: await nextPersonCode(), username, full_name: input.full_name.trim(), phone: input.phone.trim(),
        normalized_phone: normalized, email: input.email?.trim().toLowerCase() || null, status: input.status ?? "member",
        // An existing member registering online wasn't here for the first time today.
        first_visit_at: input.first_timer === false ? null : now, joined_at: now, notes: input.notes ?? null,
        first_timer: input.first_timer ?? null,
        auth_subject: input.auth_subject ?? null, avatar_url: input.avatar_url ?? null, gender: input.gender || null,
        birthday: input.birthday || null, address: input.address || null, how_heard: input.how_heard || null,
        last_seen_at: null, whatsapp: "unknown", whatsapp_checked_at: null,
        verified_via: input.verified_via ?? "registration", verified_at: now, created_at: now, updated_at: now
      });
    } catch (error) {
      if (error instanceof DuplicateError && /username|person_code/.test(error.message)) continue;
      if (error instanceof DuplicateError) throw new FriendlyError("This phone number or account is already registered.");
      throw error;
    }
  }
  throw new Error("Could not allocate a unique username");
}

export async function updatePerson(id: string, patch: Partial<Person>) {
  if (patch.phone) {
    patch.normalized_phone = normalizePhone(patch.phone);
    const other = await db().get("people", { normalized_phone: patch.normalized_phone });
    if (other && other.id !== id) throw new FriendlyError("Another person already uses this phone number.");
  }
  if (patch.status === "member") {
    const current = await db().get("people", { id });
    if (current && !current.joined_at) patch.joined_at = nowIso();
  }
  const [row] = await db().update("people", { id }, { ...patch, updated_at: nowIso() });
  return row;
}

export async function listPeople() {
  return db().list("people", { order: { column: "full_name" } });
}

export async function peopleById(ids?: string[]) {
  let rows: Person[];
  if (!ids) rows = await db().list("people");
  else if (!ids.length) rows = [];
  else if (ids.length <= 100) rows = await db().list("people", { where: { id: ids } });
  else { const set = new Set(ids); rows = (await db().list("people")).filter((p) => set.has(p.id)); }
  return new Map(rows.map((p) => [p.id, p]));
}

