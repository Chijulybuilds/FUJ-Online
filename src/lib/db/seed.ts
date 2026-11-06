import type { Tables, TableName } from "./types";

/**
 * Starting data for a brand-new local database: only details FUJ provided (name, bank account).
 * No members, services, offerings or other sample records — everything else is entered by
 * FUJ admins, and unset settings show as placeholders until filled in Admin → Settings.
 */
export function buildSeed(): Partial<{ [N in TableName]: Tables[N][] }> {
  const now = new Date().toISOString();
  return {
    church_settings: [{
      id: true, church_name: "FlagUpJesus Global Ministry", app_name: "FlagUpJesus", timezone: "Africa/Lagos",
      contact_email: null, contact_phone: null, tagline: null, address: null, service_times: null, livestream_url: null,
      bank_name: "Fidelity Bank", account_name: "FlagUp Jesus Global Ministry", account_number: "5600605313", absence_threshold: 2, created_at: now, updated_at: now
    }]
  };
}
