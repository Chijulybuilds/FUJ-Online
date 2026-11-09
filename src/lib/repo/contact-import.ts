import "server-only";
import { db } from "@/lib/db";
import { ADULT_AGE, ageOf } from "@/lib/children";
import { classify, importNote, type Contact } from "@/lib/import/contacts";
import { createPerson, FriendlyError, usesSharedPhone } from "./people";

/** Everyone already in the database, as the matcher needs them. */
async function existingPeople() {
  return (await db().list("people")).map((p) => ({ id: p.id, full_name: p.full_name, normalized_phone: p.normalized_phone, owner: !usesSharedPhone(p) }));
}

export async function previewImport(contacts: Contact[]) {
  return classify(contacts, await existingPeople());
}

export type ImportResult = { line: number; name: string; outcome: "added" | "skipped" | "failed"; username?: string | null; detail: string };

/**
 * Adds the contacts that aren't in the database yet. Each batch is checked against the database again first, so
 * importing twice (or importing a list that overlaps one already imported) never creates duplicates.
 */
export async function importContacts(contacts: Contact[], fileName: string): Promise<ImportResult[]> {
  const decided = classify(contacts, await existingPeople());
  const createdByLine = new Map<number, { id: string; full_name: string; phone: string }>();
  const results: ImportResult[] = [];
  for (const c of decided) {
    const d = c.decision;
    if (d.status !== "new" && d.status !== "shares") {
      results.push({ line: c.line, name: c.name, outcome: "skipped", detail: d.status === "existing" ? `Already in the database as ${d.matchName}` : d.status === "duplicate" ? `Same person as row ${d.ofLine}` : d.status === "no_phone" ? "No phone number" : "No name" });
      continue;
    }
    try {
      const base = {
        full_name: c.name, email: c.email, gender: c.gender, address: c.address, birthday: c.birthday, notes: importNote(c, fileName),
        status: "member" as const, verified_via: "admin" as const, first_visit_at: null
      };
      let person;
      if (d.status === "new") {
        person = await createPerson({ ...base, phone: c.phone ?? c.altPhone! });
      } else {
        const owner = d.ownerId ? await db().get("people", { id: d.ownerId }) : d.ownerLine ? createdByLine.get(d.ownerLine) ?? null : null;
        const phone = owner?.phone ?? c.phone ?? c.altPhone!;
        const minor = (ageOf(c.birthday) ?? ADULT_AGE) < ADULT_AGE;
        person = await createPerson({
          ...base, phone, guardian_id: owner?.id ?? null, guardian_name: owner?.full_name ?? d.ownerName, guardian_relationship: "Family",
          ...(minor ? { is_child: true } : { shares_phone: true })
        });
      }
      createdByLine.set(c.line, { id: person.id, full_name: person.full_name, phone: person.phone });
      results.push({ line: c.line, name: c.name, outcome: "added", username: person.username, detail: d.status === "shares" ? `Added — shares ${d.ownerName}'s number` : "Added" });
    } catch (error) {
      if (error instanceof FriendlyError) results.push({ line: c.line, name: c.name, outcome: /already registered/i.test(error.message) ? "skipped" : "failed", detail: error.message });
      else { console.error("import row failed", c.line, error); results.push({ line: c.line, name: c.name, outcome: "failed", detail: "Couldn't be saved — try again." }); }
    }
  }
  return results;
}
