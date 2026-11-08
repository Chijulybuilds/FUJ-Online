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
  // Automatic absence follow-up: on, reminders every 3 days until they come back, on every connected channel.
  auto_follow_up: true, follow_up_every_days: 3, follow_up_max_messages: 0, follow_up_channels: ["whatsapp", "sms", "email"],
  follow_up_first_message: null, follow_up_reminder_message: null,
  // First timers: welcome straight away, then an invitation each Saturday (up to 3) until they come back.
  first_timer_auto: true, first_timer_max_invites: 3, first_timer_welcome_message: null, first_timer_invite_message: null,
  // Partners: thank-you on sign-up; monthly reminders only once the church turns them on.
  partner_auto: true, partner_reminders: false, partner_reminder_day: 1, partner_thanks_message: null, partner_reminder_message: null,
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
