import "server-only";
import { db } from "@/lib/db";
import { nowIso, uid } from "@/lib/utils";
import { peopleById } from "./people";

export async function listDonations() {
  const rows = await db().list("donations", { order: { column: "created_at", ascending: false } });
  const people = await peopleById(rows.flatMap((r) => (r.person_id ? [r.person_id] : [])));
  return rows.map((r) => ({ ...r, amount: Number(r.amount), person: r.person_id ? people.get(r.person_id) ?? null : null }));
}

export async function recordDonation(input: { person_id: string | null; donor_name: string | null; amount: number; fund_name: string; method: string; note: string | null; paid_at: string | null }, recordedBy: string) {
  return db().insert("donations", {
    id: uid(), person_id: input.person_id, amount: input.amount, currency: "NGN", fund_name: input.fund_name, status: "paid",
    provider_reference: null, paid_at: input.paid_at ?? nowIso(), method: input.method, note: input.note, donor_name: input.donor_name,
    recorded_by: recordedBy, created_at: nowIso()
  });
}

export async function donationsForPerson(personId: string) {
  return (await db().list("donations", { where: { person_id: personId, status: "paid" }, order: { column: "paid_at", ascending: false } })).map((d) => ({ ...d, amount: Number(d.amount) }));
}
