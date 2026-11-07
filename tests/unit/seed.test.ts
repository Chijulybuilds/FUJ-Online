import { describe, expect, it } from "vitest";
import { buildSeed } from "../../src/lib/db/seed";
import { parsePrograms } from "../../src/lib/programs";

describe("starting data", () => {
  it("contains no sample members, services, offerings or other invented records", () => {
    const seed = buildSeed();
    expect(Object.keys(seed)).toEqual(["church_settings"]);
    const s = seed.church_settings![0];
    expect(s.church_name).toBe("FlagUpJesus Global Ministry");
    expect({ bank: s.bank_name, name: s.account_name, number: s.account_number }).toEqual({ bank: "Fidelity Bank", name: "FlagUp Jesus Global Ministry", number: "5600605313" });
    // Not provided by FUJ yet → empty (shown as placeholders)
    expect({ email: s.contact_email, phone: s.contact_phone, address: s.address }).toEqual({ email: "flagupjesusglobal@gmail.com", phone: "07042741000", address: "2nd Floor, MBM Plaza (besides Shell IA), Rumuobioakani, Port Harcourt" });
    expect(s.tagline).toBe("We Love, We Give, We Change The World");
    expect(s.livestream_url).toBeNull();
    const programs = parsePrograms(s.service_times);
    expect(programs.map((p) => p.name)).toEqual(["Word Experience", "Weekly Prayers", "Connect", "TFT — The Family Table", "Online Global Prayers", "The Forge Retreat", "International Prayer & Missions Conference", "Jesus Festival"]);
    expect(programs[0].when).toBe("Every Sunday · 4:30 PM");
    expect(programs[1].when).toBe("Every Wednesday · 5:00 PM");
    expect(programs.find((p) => p.name.startsWith("TFT"))!.when).toBe("Last Saturday of every month");
    expect(programs.find((p) => p.name === "Online Global Prayers")!.when).toBe("Third Friday of every month");
  });
});
