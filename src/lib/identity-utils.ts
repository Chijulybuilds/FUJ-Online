import { USERNAME_PREFIX } from "./constants";

/** Normalises Nigerian and international numbers to E.164-ish form, e.g. 080XXXXXXXX → +23480XXXXXXXX. */
export function normalizePhone(input: string): string {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 11 && digits.startsWith("0")) return `+234${digits.slice(1)}`;
  if (digits.length === 10 && /^[789]/.test(digits)) return `+234${digits}`;
  if (digits.startsWith("234")) return `+${digits}`;
  return `+${digits}`;
}

/** Lower-case and trim a typed username; accepts it with or without the "flag" prefix. */
export function cleanUsername(input: string): string {
  const value = input.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "");
  return value;
}
export function usernameCandidates(input: string): string[] {
  const value = cleanUsername(input);
  if (!value) return [];
  return value.startsWith(USERNAME_PREFIX) ? [value] : [value, `${USERNAME_PREFIX}${value}`];
}

/** Titles that come before a name ("Pst. Umanuwa D. Caleb", "Engr. Mrs. Uju Caleb") — skipped for usernames and greetings. */
const TITLES = new Set(["pst", "pastor", "rev", "revd", "reverend", "engr", "eng", "mr", "mrs", "ms", "miss", "mss", "dr", "doc", "prof", "deacon", "deaconess", "dcn", "dcns", "bro", "brother", "sis", "sister", "chief", "elder", "apostle", "evang", "evangelist", "minister", "min", "barr", "hon", "lady", "sir", "madam", "mummy", "daddy"]);
const isTitle = (word: string) => TITLES.has(word.toLowerCase().replace(/[^a-z]/g, ""));

/** "First Last" → "flagfirst" + 3 digits. Keeps usernames short, readable and typeable on a phone. */
export function usernameBase(fullName: string): string {
  const first = fullName
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .split(/\s+/)
    .filter((part) => !isTitle(part))
    .map((part) => part.replace(/[^a-z]/g, ""))
    .find((part) => part.length > 1) ?? "member";
  return `${USERNAME_PREFIX}${first.slice(0, 10)}`;
}
export function generateUsername(fullName: string, random: () => number = Math.random): string {
  const digits = String(Math.floor(random() * 900) + 100);
  return `${usernameBase(fullName)}${digits}`;
}

/** The name to greet someone by: "Pst. Umanuwa D. Caleb" → "Umanuwa". */
export function firstName(fullName: string) {
  const words = fullName.trim().split(/\s+/);
  return words.find((w) => !isTitle(w) && w.replace(/[^\p{L}]/gu, "").length > 1) ?? words[0] ?? fullName;
}
