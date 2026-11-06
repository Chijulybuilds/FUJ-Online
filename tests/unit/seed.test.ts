import { describe, expect, it } from "vitest";
import { buildSeed } from "../../src/lib/db/seed";

describe("starting data", () => {
  it("contains no sample members, services, offerings or other invented records", () => {
    const seed = buildSeed();
    expect(Object.keys(seed)).toEqual(["church_settings"]);
    const s = seed.church_settings![0];
    expect(s.church_name).toBe("FlagUpJesus Global Ministry");
    expect({ bank: s.bank_name, name: s.account_name, number: s.account_number }).toEqual({ bank: "Fidelity Bank", name: "FlagUp Jesus Global Ministry", number: "5600605313" });
    // Not provided by FUJ yet → empty (shown as placeholders)
    expect({ email: s.contact_email, phone: s.contact_phone, address: s.address }).toEqual({ email: "flagupjesusglobal@gmail.com", phone: "07042741000", address: "2nd Floor, MBM Plaza (beside Shell IA), Rumuobiakani, Port Harcourt" });
    expect([s.service_times, s.livestream_url, s.tagline]).toEqual([null, null, null]);
  });
});
