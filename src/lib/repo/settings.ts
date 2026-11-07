import "server-only";
import { db } from "@/lib/db";
import type { ChurchSettings } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";
import { DEFAULT_PROGRAMS, MOTTO, parsePrograms } from "@/lib/programs";

/** Details FUJ provided — shown whenever the database has nothing (or can't be reached). */
export const DEFAULT_SETTINGS: ChurchSettings = {
  id: true, church_name: "FlagUpJesus Global Ministry", app_name: "FlagUpJesus", timezone: "Africa/Lagos",
  // Provided by FUJ.
  contact_email: "flagupjesusglobal@gmail.com", contact_phone: "07042741000", tagline: MOTTO,
  address: "2nd Floor, MBM Plaza (besides Shell IA), Rumuobioakani, Port Harcourt",
  service_times: DEFAULT_PROGRAMS,
  livestream_url: null,
  // Provided by FUJ.
  bank_name: "Fidelity Bank", account_name: "FlagUp Jesus Global Ministry", account_number: "5600605313", absence_threshold: 2,
  created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString()
};

export async function getSettings(): Promise<ChurchSettings> {
  const row = await db().get("church_settings", { id: true });
  // Empty columns fall back to the defaults (e.g. the ministry's bank details).
  const merged = { ...DEFAULT_SETTINGS };
  for (const [k, v] of Object.entries(row ?? {})) if (v !== null && v !== "") (merged as Record<string, unknown>)[k] = v;
  return merged;
}

/** For public pages: never blanks FUJ's contact and bank details just because the database is unreachable. */
export async function getPublicSettings(): Promise<ChurchSettings> {
  try {
    return await getSettings();
  } catch (error) {
    console.error("church settings unavailable; showing defaults", error);
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(patch: Partial<ChurchSettings>) {
  const existing = await db().get("church_settings", { id: true });
  if (existing) return (await db().update("church_settings", { id: true }, { ...patch, updated_at: nowIso() }))[0];
  return db().insert("church_settings", { ...DEFAULT_SETTINGS, ...patch, created_at: nowIso(), updated_at: nowIso() });
}

/** @deprecated use parsePrograms */
export const parseServiceTimes = parsePrograms;
