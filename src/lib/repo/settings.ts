import "server-only";
import { db } from "@/lib/db";
import type { ChurchSettings } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";

const DEFAULTS: ChurchSettings = {
  id: true, church_name: "FlagUpJesus Global Ministry", app_name: "FlagUpJesus", timezone: "Africa/Lagos",
  // Provided by FUJ.
  contact_email: "flagupjesusglobal@gmail.com", contact_phone: "07042741000", tagline: null,
  address: "2nd Floor, MBM Plaza (beside Shell IA), Rumuobiakani, Port Harcourt",
  service_times: null,
  livestream_url: null,
  // Provided by FUJ.
  bank_name: "Fidelity Bank", account_name: "FlagUp Jesus Global Ministry", account_number: "5600605313", absence_threshold: 2,
  created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString()
};

export async function getSettings(): Promise<ChurchSettings> {
  const row = await db().get("church_settings", { id: true });
  // Empty columns fall back to the defaults (e.g. the ministry's bank details).
  const merged = { ...DEFAULTS };
  for (const [k, v] of Object.entries(row ?? {})) if (v !== null && v !== "") (merged as Record<string, unknown>)[k] = v;
  return merged;
}

export async function saveSettings(patch: Partial<ChurchSettings>) {
  const existing = await db().get("church_settings", { id: true });
  if (existing) return (await db().update("church_settings", { id: true }, { ...patch, updated_at: nowIso() }))[0];
  return db().insert("church_settings", { ...DEFAULTS, ...patch, created_at: nowIso(), updated_at: nowIso() });
}

export function parseServiceTimes(value: string | null) {
  return (value ?? "").split("\n").map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, when] = line.split("|");
    return { name: name?.trim() ?? line, when: when?.trim() ?? "" };
  });
}
