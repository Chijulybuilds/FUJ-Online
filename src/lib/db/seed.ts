import type { Tables, TableName } from "./types";
import { DEFAULT_PROGRAMS, MOTTO } from "../programs";

/**
 * Starting data for a brand-new local database: only details FUJ provided (name, contacts, bank account).
 * No members, services, offerings or other sample records — everything else is entered by
 * FUJ admins, and unset settings show as placeholders until filled in Admin → Settings.
 */
export function buildSeed(): Partial<{ [N in TableName]: Tables[N][] }> {
  const now = new Date().toISOString();
  return {
    church_settings: [{
      id: true, church_name: "FlagUpJesus Global Ministry", app_name: "FlagUpJesus", timezone: "Africa/Lagos",
      contact_email: "flagupjesusglobal@gmail.com", contact_phone: "07042741000", tagline: MOTTO,
      address: "2nd Floor, MBM Plaza (besides Shell IA), Rumuobioakani, Port Harcourt", service_times: DEFAULT_PROGRAMS, livestream_url: null,
      bank_name: "Fidelity Bank", account_name: "FlagUp Jesus Global Ministry", account_number: "5600605313", absence_threshold: 2,
      auto_follow_up: true, follow_up_every_days: 3, follow_up_max_messages: 0, follow_up_channels: ["whatsapp", "sms", "email"],
      follow_up_first_message: null, follow_up_reminder_message: null,
      first_timer_auto: true, first_timer_max_invites: 3, first_timer_welcome_message: null, first_timer_invite_message: null,
      partner_auto: true, partner_reminders: false, partner_reminder_day: 1, partner_thanks_message: null, partner_reminder_message: null,
      created_at: now, updated_at: now
    }]
  };
}
