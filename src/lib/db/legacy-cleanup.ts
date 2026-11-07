/**
 * Earlier versions of the app seeded a brand-new local database with fictional sample data
 * (members, services, attendance, offerings, demo staff, departments, demo bank details…).
 * Those rows all used IDs starting with LEGACY_PREFIX. This removes them — and anything linked to
 * them — from an existing local database, and clears settings that still hold the old sample values,
 * so the real FUJ defaults show. Records created by real users have random IDs and are kept.
 */
export const LEGACY_PREFIX = "00000000-0000-4000-8000-";

const LEGACY_SETTING_VALUES: Record<string, string[]> = {
  contact_email: ["hello@flagupjesus.org"],
  contact_phone: ["+234 800 000 0000"],
  tagline: ["Raising the flag of Jesus in every nation."],
  address: ["Main auditorium, Lagos, Nigeria", "Port Harcourt, Rivers State, Nigeria"],
  livestream_url: ["https://www.youtube.com/@flagofjesus/live"],
  bank_name: ["Demo Bank"],
  account_name: ["Flag of Jesus Global Ministry"],
  account_number: ["0123456789"],
  service_times: [
    "Sunday Celebration Service|Sundays · 9:00 AM\nMidweek Bible Study|Wednesdays · 5:30 PM\nPrayer Meeting|Fridays · 6:00 PM",
    "Word Experience (Sunday Service)|Sundays · 9:00 AM\nBible Study|Wednesdays · 5:30 PM\nPrayer Meeting|Fridays · 6:00 PM",
    "Sunday Celebration Service|Sundays · 9:00 AM\nMidweek Bible Study|Wednesdays · 5:30 PM"
  ]
};

type Row = Record<string, unknown>;
type Store = Record<string, Row[] | undefined>;
const legacy = (v: unknown) => typeof v === "string" && v.startsWith(LEGACY_PREFIX);

/** Mutates the store in place; returns how many rows/settings were changed. */
export function cleanLegacyDemoData(store: Store): number {
  let changed = 0;
  const drop = (table: string, test: (r: Row) => boolean) => {
    const rows = store[table];
    if (!rows) return new Set<unknown>();
    const removed = rows.filter(test);
    if (removed.length) { store[table] = rows.filter((r) => !test(r)); changed += removed.length; }
    return new Set(removed.map((r) => r.id));
  };
  drop("people", (r) => legacy(r.id));
  drop("services", (r) => legacy(r.id));
  drop("admin_users", (r) => legacy(r.id));
  drop("attendance", (r) => legacy(r.id) || legacy(r.person_id) || legacy(r.service_id));
  drop("qr_sessions", (r) => legacy(r.service_id));
  const tasks = drop("follow_up_tasks", (r) => legacy(r.id) || legacy(r.person_id));
  drop("follow_up_logs", (r) => tasks.has(r.task_id));
  for (const t of ["announcements", "prayer_requests", "testimonies", "donations"]) drop(t, (r) => legacy(r.id) || legacy(r.person_id));
  drop("broadcast_recipients", (r) => legacy(r.person_id));
  // Departments no longer exist in the app.
  for (const t of ["departments", "member_departments"]) if (store[t]) { changed += store[t]!.length; delete store[t]; }

  for (const s of store.church_settings ?? []) {
    for (const [key, values] of Object.entries(LEGACY_SETTING_VALUES)) {
      if (typeof s[key] === "string" && values.includes(s[key] as string)) { s[key] = null; changed++; }
    }
    if (s.church_name === "Flag of Jesus Global Ministry") { s.church_name = "FlagUpJesus Global Ministry"; changed++; }
  }
  return changed;
}
