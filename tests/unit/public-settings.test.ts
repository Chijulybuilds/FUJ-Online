import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: () => ({ get: async () => { throw new Error("Supabase is required in production"); } })
}));

describe("getPublicSettings", () => {
  it("still shows FUJ's contact and bank details when the database can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { getPublicSettings } = await import("@/lib/repo/settings");
    const s = await getPublicSettings();
    expect(s.address).toMatch(/MBM Plaza.*Rumuobioakani, Port Harcourt/);
    expect(s.contact_phone).toBe("07042741000");
    expect(s.contact_email).toBe("flagupjesusglobal@gmail.com");
    expect([s.bank_name, s.account_number, s.account_name]).toEqual(["Fidelity Bank", "5600605313", "FlagUp Jesus Global Ministry"]);
  });
});
