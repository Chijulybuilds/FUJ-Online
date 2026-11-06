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
    expect([s.contact_email, s.contact_phone, s.address, s.service_times, s.livestream_url, s.tagline]).toEqual([null, null, null, null, null, null]);
  });
});
