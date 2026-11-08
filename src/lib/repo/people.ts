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

/** Everyone registered with this phone number: the adult who owns it, and any children using it. */
export async function peopleByPhone(phone: string) {
  const normalized = normalizePhone(phone);
  return normalized ? db().list("people", { where: { normalized_phone: normalized } }) : [];
}

/** The adult who owns this phone number (children registered with a parent's number are skipped). */
export async function findByPhone(phone: string) {
  return (await peopleByPhone(phone)).find((p) => !p.is_child) ?? null;
}

export async function findByEmail(email: string) {
  const target = email.trim().toLowerCase();
  if (!target) return null;
  const direct = (await db().list("people", { where: { email: target } })).find((p) => !p.is_child);
  if (direct) return direct;
  return (await db().list("people")).find((p) => !p.is_child && p.email?.toLowerCase() === target) ?? null;
}

/** A parent's children: linked to them, or registered with their phone number before they registered. */
export async function childrenOf(parent: Pick<Person, "id" | "normalized_phone" | "is_child">) {
  if (parent.is_child) return [];
  const [linked, samePhone] = await Promise.all([
    db().list("people", { where: { guardian_id: parent.id } }),
    db().list("people", { where: { normalized_phone: parent.normalized_phone } })
  ]);
  const seen = new Set<string>();
  return [...linked, ...samePhone.filter((p) => p.is_child && !p.guardian_id)]
    .filter((p) => p.is_child && !seen.has(p.id) && seen.add(p.id))
    .sort((a, b) => (a.birthday ?? "").localeCompare(b.birthday ?? ""));
}

/** Same family: a child and the parent whose phone number they use (or are linked to). */
export function sameFamily(a: Pick<Person, "id" | "normalized_phone" | "is_child" | "guardian_id">, b: Pick<Person, "id" | "normalized_phone" | "is_child" | "guardian_id">) {
  if (a.id === b.id) return true;
  if (!a.is_child && !b.is_child) return false;
  return a.normalized_phone === b.normalized_phone || a.guardian_id === b.id || b.guardian_id === a.id;
}

export type NewPerson = {
  full_name: string; phone: string; email?: string | null; status?: PersonStatus; gender?: string | null; birthday?: string | null;
  address?: string | null; how_heard?: string | null; auth_subject?: string | null; avatar_url?: string | null; notes?: string | null;
  verified_via?: Person["verified_via"];
  /** "Is this your first time at FlagUpJesus?" — false = an existing member registering online. */
  first_timer?: boolean | null;
  /** A child registered with a parent's / guardian's phone number. */
  is_child?: boolean;
  guardian_id?: string | null;
  guardian_name?: string | null;
  guardian_relationship?: string | null;
  care_notes?: string | null;
};

async function nextPersonCode() {
  const people = await db().list("people");
  const max = people.reduce((m, p) => Math.max(m, Number(p.person_code?.replace(/\D/g, "") ?? 0) || 0), 0);
  return `FOJ-${String(max + 1).padStart(4, "0")}`;
}

const NEWER_COLUMNS = ["first_timer", "is_child", "guardian_id", "guardian_name", "guardian_relationship", "care_notes", "welcome_email_sent_at"] as const;
/** Saves a new person; if the database hasn't been updated with the newest columns yet, saves adults without them. */
async function insertPerson(row: Person) {
  try {
    return await db().insert("people", row);
  } catch (error) {
    if (!(error instanceof DuplicateError) && error instanceof Error && NEWER_COLUMNS.some((c) => error.message.includes(c))) {
      if (row.is_child) throw new FriendlyError("Children's registration needs a quick update on the church's side. Please ask an usher or try again later.");
      console.error("people is missing newer columns — re-run supabase/setup.sql. Saving without them.");
      const rest: Record<string, unknown> = { ...row };
      for (const c of NEWER_COLUMNS) delete rest[c];
      return await db().insert("people", rest as unknown as Person);
    }
    throw error;
  }
}

/** Creates the church person record and assigns a unique "flag…" username. */
export async function createPerson(input: NewPerson): Promise<Person> {
  const normalized = normalizePhone(input.phone);
  if (!normalized || normalized.length < 8) throw new FriendlyError("Enter a valid phone number.");
  const samePhone = await db().list("people", { where: { normalized_phone: normalized } });
  if (input.is_child) {
    // A child uses their parent's number; just don't register the same child twice.
    const twin = samePhone.find((p) => p.is_child && p.full_name.trim().toLowerCase() === input.full_name.trim().toLowerCase());
    if (twin) throw new FriendlyError(`${twin.full_name} is already registered with this phone number — their username is ${twin.username}.`);
  } else if (samePhone.some((p) => !p.is_child)) {
    throw new FriendlyError("This phone number is already registered. Sign in with your username instead.");
  }
  const now = nowIso();
  for (let attempt = 0; attempt < 25; attempt++) {
    const username = generateUsername(input.full_name);
    if (await db().get("people", { username })) continue;
    try {
      const person = await insertPerson({
        id: uid(), person_code: await nextPersonCode(), username, full_name: input.full_name.trim(), phone: input.phone.trim(),
        normalized_phone: normalized, email: input.email?.trim().toLowerCase() || null, status: input.status ?? "member",
        // An existing member registering online wasn't here for the first time today.
        first_visit_at: input.first_timer === false ? null : now, joined_at: now, notes: input.notes ?? null,
        first_timer: input.first_timer ?? null,
        is_child: Boolean(input.is_child), guardian_id: input.is_child ? input.guardian_id ?? null : null,
        guardian_name: input.is_child ? input.guardian_name?.trim() || null : null,
        guardian_relationship: input.is_child ? input.guardian_relationship || null : null, care_notes: input.care_notes?.trim() || null,
        welcome_email_sent_at: null,
        auth_subject: input.auth_subject ?? null, avatar_url: input.avatar_url ?? null, gender: input.gender || null,
        birthday: input.birthday || null, address: input.address || null, how_heard: input.how_heard || null,
        last_seen_at: null, whatsapp: "unknown", whatsapp_checked_at: null,
        verified_via: input.verified_via ?? "registration", verified_at: now, created_at: now, updated_at: now
      });
      // A parent registering after their children: link the children who use this number.
      if (!person.is_child) await adoptChildren(person).catch((error) => console.error("could not link children", error));
      return person;
    } catch (error) {
      if (error instanceof DuplicateError && /username|person_code/.test(error.message)) continue;
      if (error instanceof DuplicateError) throw new FriendlyError("This phone number or account is already registered.");
      throw error;
    }
  }
  throw new Error("Could not allocate a unique username");
}

async function adoptChildren(parent: Person) {
  const orphans = (await db().list("people", { where: { normalized_phone: parent.normalized_phone } })).filter((p) => p.is_child && !p.guardian_id);
  for (const child of orphans) {
    await db().update("people", { id: child.id }, { guardian_id: parent.id, guardian_name: child.guardian_name ?? parent.full_name, updated_at: nowIso() });
  }
  return orphans.length;
}

export async function updatePerson(id: string, patch: Partial<Person>) {
  if (patch.phone) {
    patch.normalized_phone = normalizePhone(patch.phone);
    const current = await db().get("people", { id });
    const child = patch.is_child ?? current?.is_child ?? false;
    // Phone numbers are unique among adults; a child shares their parent's.
    if (!child) {
      const other = (await db().list("people", { where: { normalized_phone: patch.normalized_phone } })).find((p) => p.id !== id && !p.is_child);
      if (other) throw new FriendlyError("Another person already uses this phone number.");
    }
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

