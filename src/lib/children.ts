/** Children's church helpers (safe in the browser and on the server). Dates are judged in Lagos (UTC+1). */

export const RELATIONSHIPS = ["Mother", "Father", "Guardian", "Grandparent", "Aunt / Uncle", "Older sibling", "Other"] as const;
export const ADULT_AGE = 18;

export const AGE_GROUPS = [
  { key: "toddlers", label: "Toddlers", range: "0–3", min: 0, max: 3, emoji: "🍼" },
  { key: "preschool", label: "Pre-school", range: "4–6", min: 4, max: 6, emoji: "🧸" },
  { key: "juniors", label: "Juniors", range: "7–9", min: 7, max: 9, emoji: "🎒" },
  { key: "preteens", label: "Pre-teens", range: "10–12", min: 10, max: 12, emoji: "⚽" },
  { key: "teens", label: "Teens", range: "13–17", min: 13, max: 17, emoji: "🎧" }
] as const;
export type AgeGroupKey = (typeof AGE_GROUPS)[number]["key"];

const lagosToday = (now = new Date()) => {
  const d = new Date(now.getTime() + 3600000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
};
const parse = (birthday: string | null | undefined) => {
  const m = birthday ? /^(\d{4})-(\d{2})-(\d{2})/.exec(birthday) : null;
  return m ? { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) } : null;
};

/** Age in whole years today (null without a birthday). */
export function ageOf(birthday: string | null | undefined, now = new Date()) {
  const b = parse(birthday);
  if (!b) return null;
  const t = lagosToday(now);
  return t.y - b.y - (t.m < b.m || (t.m === b.m && t.d < b.d) ? 1 : 0);
}

export function ageGroupOf(age: number | null) {
  if (age === null) return null;
  return AGE_GROUPS.find((g) => age >= g.min && age <= g.max) ?? null;
}

/** "6 years", "8 months", "Newborn". */
export function ageLabel(birthday: string | null | undefined, now = new Date()) {
  const age = ageOf(birthday, now);
  if (age === null) return "Age not given";
  if (age >= 1) return `${age} year${age === 1 ? "" : "s"}`;
  const b = parse(birthday)!; const t = lagosToday(now);
  const months = (t.y - b.y) * 12 + (t.m - b.m) - (t.d < b.d ? 1 : 0);
  return months <= 0 ? "Newborn" : `${months} month${months === 1 ? "" : "s"}`;
}

/** Days until the next birthday (0 = today) and the age they'll turn. */
export function nextBirthday(birthday: string | null | undefined, now = new Date()) {
  const b = parse(birthday);
  if (!b) return null;
  const t = lagosToday(now);
  const today = Date.UTC(t.y, t.m - 1, t.d);
  let year = t.y;
  // 29 February birthdays are celebrated on 28 February in other years.
  const dayIn = (y: number) => (b.m === 2 && b.d === 29 && new Date(Date.UTC(y, 1, 29)).getUTCMonth() !== 1 ? 28 : b.d);
  if (Date.UTC(year, b.m - 1, dayIn(year)) < today) year++;
  return { days: Math.round((Date.UTC(year, b.m - 1, dayIn(year)) - today) / 86400000), turning: year - b.y };
}

export function birthdayThisMonth(birthday: string | null | undefined, now = new Date()) {
  const b = parse(birthday);
  return Boolean(b && b.m === lagosToday(now).m);
}

/** A friendly face for a child's card. */
export function childEmoji(gender: string | null | undefined, age: number | null) {
  if (age !== null && age < 2) return "👶";
  if (gender === "female") return age !== null && age >= 13 ? "👩" : "👧";
  if (gender === "male") return age !== null && age >= 13 ? "👨" : "👦";
  return "🧒";
}

/** Problem with a child's birthday for children's registration (must be under 18), or null. */
export function childBirthdayProblem(birthday: string, now = new Date()) {
  const age = ageOf(birthday, now);
  if (age === null) return "Enter your child's birthday";
  if (age >= ADULT_AGE) return "Children's registration is for under-18s. Register as yourself instead.";
  return null;
}
