/**
 * Contact-list import: turns spreadsheet rows into contacts and decides, for each one, whether they're new, already
 * in the database (skipped — no duplicates), a family member sharing a phone number, or can't be imported.
 * Pure functions (no database), so the preview and the import agree and are easy to test.
 */
import { normalizePhone } from "@/lib/identity-utils";

export type Field = "name" | "firstName" | "lastName" | "phone" | "altPhone" | "gender" | "address" | "email" | "birthday" | "notes" | "source" | "needsChecking";
export const FIELD_LABELS: Record<Field, string> = {
  name: "Full name", firstName: "First name", lastName: "Surname", phone: "Phone", altPhone: "Other phone", gender: "Gender", address: "Address",
  email: "Email", birthday: "Birthday", notes: "Notes", source: "Source", needsChecking: "Needs checking"
};
export type Mapping = Partial<Record<Field, number>>;

const HEADER_RULES: [Field, RegExp][] = [
  ["altPhone", /\b(alt|alternat|other|second|2nd|another)\b.*\b(phone|number|no|tel|mobile)|^(phone|number)\s*2$/i],
  ["firstName", /^(first|given|fore)\s*name$/i],
  ["lastName", /^(last\s*name|surname|family\s*name)$/i],
  ["name", /^(full\s*)?names?$|^(member|contact|person)('?s)?\s*(name)?$/i],
  ["phone", /phone|mobile|whats\s*app|^tel|gsm|contact\s*(no|number)|^number$/i],
  ["gender", /^(gender|sex)$/i],
  ["email", /e-?mail/i],
  ["birthday", /birth|^dob$|bday/i],
  ["address", /address|location|area|residence|lives?\b|town/i],
  ["needsChecking", /check|verify|confirm/i],
  ["source", /^source|^from$|^list$/i],
  ["notes", /note|remark|comment|prayer/i]
];

/** Finds the header row (within the first 10 rows) and which column holds what. */
export function detectColumns(rows: string[][]): { headerRow: number; mapping: Mapping } {
  for (let r = 0; r < Math.min(10, rows.length); r++) {
    const mapping: Mapping = {};
    rows[r].forEach((cell, i) => {
      const text = cell.trim();
      if (!text) return;
      const field = HEADER_RULES.find(([f, re]) => mapping[f] === undefined && re.test(text))?.[0];
      if (field) mapping[field] = i;
    });
    if ((mapping.name !== undefined || mapping.firstName !== undefined) && mapping.phone !== undefined) return { headerRow: r, mapping };
  }
  return { headerRow: -1, mapping: {} };
}

export type Contact = {
  line: number; name: string; phone: string | null; altPhone: string | null; gender: "male" | "female" | null;
  address: string | null; email: string | null; birthday: string | null; notes: string | null; source: string | null; needsChecking: boolean;
};

const clean = (v: string | undefined) => (v ?? "").replace(/\s+/g, " ").trim();
/** A usable Nigerian / international mobile number, normalised (+234…), or null. */
export function usablePhone(raw: string | undefined | null) {
  const value = clean(raw ?? "");
  if (!value) return null;
  // Excel sometimes stores numbers as 8.03123E+09 or 8031234567 (leading zero lost).
  const expanded = /e\+/i.test(value) ? String(Number(value)) : value;
  const n = normalizePhone(expanded);
  return /^\+\d{10,15}$/.test(n) && !(n.startsWith("+234") && n.length !== 14) ? n : null;
}
function parseGender(v: string) {
  const g = v.trim().toLowerCase();
  return /^(m|male|man|boy|bro|brother)$/.test(g) ? "male" as const : /^(f|female|woman|girl|sis|sister)$/.test(g) ? "female" as const : null;
}
function parseBirthday(v: string) {
  const t = v.trim();
  if (!t) return null;
  if (/^\d{4,5}(\.\d+)?$/.test(t)) { // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(Number(t)) * 86400000);
    return d.getUTCFullYear() > 1900 && d.getTime() < Date.now() ? d.toISOString().slice(0, 10) : null;
  }
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;
  const dmy = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t); // Nigeria writes day/month/year
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  return null;
}
const yes = (v: string) => /^(y|yes|true|1|x|✓|✔)$/i.test(v.trim());

/** Rows below the header → contacts (blank rows dropped). line = the spreadsheet row number. */
export function toContacts(rows: string[][], headerRow: number, mapping: Mapping): Contact[] {
  const at = (row: string[], f: Field) => (mapping[f] === undefined ? "" : clean(row[mapping[f]!]));
  const out: Contact[] = [];
  rows.forEach((row, i) => {
    if (i <= headerRow) return;
    const name = at(row, "name") || [at(row, "firstName"), at(row, "lastName")].filter(Boolean).join(" ");
    const rawPhone = at(row, "phone"); const rawAlt = at(row, "altPhone");
    if (!name && !rawPhone) return;
    const email = at(row, "email").toLowerCase();
    out.push({
      line: i + 1, name, phone: usablePhone(rawPhone), altPhone: usablePhone(rawAlt), gender: parseGender(at(row, "gender")),
      address: at(row, "address") || null, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null, birthday: parseBirthday(at(row, "birthday")),
      notes: at(row, "notes") || null, source: at(row, "source") || null, needsChecking: yes(at(row, "needsChecking"))
    });
  });
  return out;
}

/* ------------------------------------------------------------------ matching */
const TITLE = /^(pst|pastor|rev|revd|engr|eng|mr|mrs|ms|miss|dr|prof|deacon|deaconess|bro|sis|brother|sister|chief|elder|apostle|evang|min|minister|barr|hon)$/;
/** Lower-case name words without titles or initials: "Pst. Umanuwa D. Caleb" → ["umanuwa", "caleb"]. */
export function nameWords(name: string) {
  return name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[\s.,'’\-()]+/).map((w) => w.replace(/[^a-z]/g, "")).filter((w) => w.length > 1 && !TITLE.test(w));
}
/** Words match: equal, or one letter apart for longer words ("Chileme" / "Chilime", "Daniel" / "Danial"). */
function sameWord(a: string, b: string) {
  if (a === b) return true;
  if (Math.min(a.length, b.length) < 5 || Math.abs(a.length - b.length) > 1) return false;
  let i = 0, j = 0, edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (++edits > 1) return false;
    if (a.length > b.length) i++; else if (b.length > a.length) j++; else { i++; j++; }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}
/** Same person? All the words of the shorter name appear in the longer one ("Umanuwa Caleb" ⊂ "Pst. Umanuwa D. Caleb"), allowing a one-letter typo. */
export function samePerson(a: string, b: string) {
  const x = nameWords(a), y = nameWords(b);
  if (!x.length || !y.length) return false;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  return short.every((w) => long.some((v) => sameWord(w, v)));
}

export type Existing = { id: string; full_name: string; normalized_phone: string; owner: boolean };
export type Decision =
  | { status: "new" }
  | { status: "shares"; ownerName: string; ownerId: string | null; ownerLine: number | null }
  | { status: "existing"; matchName: string; matchId: string; by: "phone" | "name" }
  | { status: "duplicate"; ofLine: number }
  | { status: "no_phone" }
  | { status: "no_name" };

export const STATUS_LABEL: Record<Decision["status"], string> = {
  new: "Will be added", shares: "Will be added (shares a family number)", existing: "Already in the database — skipped",
  duplicate: "Listed twice in this file — skipped", no_phone: "No phone number — skipped", no_name: "No name — skipped"
};

/**
 * Decides what happens to each contact. Already in the database = same phone number (or other number) with a
 * matching name, or the same full name (two words or more). Same number but a different name = a family member
 * sharing that number: added and linked to the number's owner. Order matters inside the file: the first person
 * on a shared number owns it.
 */
export function classify(contacts: Contact[], existing: Existing[]): (Contact & { decision: Decision })[] {
  const byPhone = new Map<string, Existing[]>();
  for (const p of existing) byPhone.set(p.normalized_phone, [...(byPhone.get(p.normalized_phone) ?? []), p]);
  // Name-only matches need at least two name words on both sides (a lone "Favour" could be anyone).
  const named = existing.filter((p) => nameWords(p.full_name).length >= 2);
  const added: { line: number; name: string; phone: string; owner: boolean }[] = [];
  return contacts.map((c) => {
    const result = (decision: Decision) => ({ ...c, decision });
    if (!c.name || !nameWords(c.name).length) return result({ status: "no_name" });
    const phone = c.phone ?? c.altPhone;
    const phones = [c.phone, c.altPhone].filter((p): p is string => Boolean(p));
    // Already in the database?
    for (const p of phones) {
      const match = (byPhone.get(p) ?? []).find((e) => samePerson(e.full_name, c.name));
      if (match) return result({ status: "existing", matchName: match.full_name, matchId: match.id, by: "phone" });
    }
    const byName = nameWords(c.name).length >= 2 ? named.find((p) => samePerson(p.full_name, c.name)) : undefined;
    if (byName) return result({ status: "existing", matchName: byName.full_name, matchId: byName.id, by: "name" });
    // Listed twice in this file?
    const twin = added.find((a) => phones.includes(a.phone) && samePerson(a.name, c.name));
    if (twin) return result({ status: "duplicate", ofLine: twin.line });
    if (!phone) return result({ status: "no_phone" });
    // A number someone else already has → a family member sharing it.
    const owner = (byPhone.get(phone) ?? []).find((e) => e.owner);
    const fileOwner = added.find((a) => a.phone === phone && a.owner);
    if (owner || fileOwner) {
      added.push({ line: c.line, name: c.name, phone, owner: false });
      return result({ status: "shares", ownerName: owner?.full_name ?? fileOwner!.name, ownerId: owner?.id ?? null, ownerLine: owner ? null : fileOwner!.line });
    }
    // (Only children use this number so far: this person becomes its owner, and the children are linked to them.)
    added.push({ line: c.line, name: c.name, phone, owner: true });
    return result({ status: "new" });
  });
}

/** The note saved on an imported member's record. */
export function importNote(c: Contact, fileName: string) {
  return [
    `Imported from ${fileName}${c.source ? ` (${c.source})` : ""}.`,
    c.altPhone && c.phone ? `Other phone: ${c.altPhone}.` : null,
    c.notes,
    c.needsChecking ? "⚠️ Marked “needs checking” in the list." : null
  ].filter(Boolean).join(" ");
}
