import "server-only";
import { db } from "@/lib/db";
import type { ChurchSettings } from "@/lib/db/types";
import { nowIso } from "@/lib/utils";

const DEFAULTS: ChurchSettings = {
  id: true, church_name: "Flag of Jesus Global Ministry", app_name: "FlagUpJesus", timezone: "Africa/Lagos",
  contact_email: null, contact_phone: null, tagline: "Raising the flag of Jesus in every nation.", address: "Port Harcourt, Rivers State, Nigeria",
  service_times: "Word Experience (Sunday Service)|Sundays · 9:00 AM\nBible Study|Wednesdays · 5:30 PM",
  livestream_url: null, bank_name: null, account_name: null, account_number: null, absence_threshold: 2,
  created_at: new Date(0).toISOString(), updated_at: new Date(0).toISOString()
};

export async function getSettings(): Promise<ChurchSettings> {
  const row = await db().get("church_settings", { id: true });
  return { ...DEFAULTS, ...(row ?? {}) };
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
