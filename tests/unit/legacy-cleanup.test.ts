import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { cleanLegacyDemoData, LEGACY_PREFIX } from "../../src/lib/db/legacy-cleanup";

// A database file exactly as the first app version created it (old fictional sample seed).
const load = () => JSON.parse(readFileSync(new URL("./legacy-v1-db.fixture.json", import.meta.url), "utf8"));

describe("old sample data clean-up", () => {
  it("removes every old sample record and demo setting, keeping real records", () => {
    const store = load();
    const mine = { id: "5b0e2c1e-9a55-4f1e-8f0b-1b2c3d4e5f60", full_name: "Real Member", status: "member" };
    store.people.push(mine);
    store.attendance.push({ id: "c1d2e3f4-0000-4000-8000-aaaaaaaaaaaa", person_id: mine.id, service_id: "0f0e0d0c-1b1a-4a19-8a17-161514131211" });
    expect(cleanLegacyDemoData(store)).toBeGreaterThan(0);

    expect(store.people).toEqual([mine]);
    expect(store.attendance).toHaveLength(1);
    for (const t of ["services", "admin_users", "announcements", "prayer_requests", "testimonies", "donations"]) {
      expect(store[t].filter((r: { id: string }) => r.id.startsWith(LEGACY_PREFIX))).toHaveLength(0);
    }
    expect(store.departments).toBeUndefined();
    expect(store.member_departments).toBeUndefined();
    const s = store.church_settings[0];
    expect([s.bank_name, s.account_number, s.account_name, s.contact_email, s.contact_phone, s.address, s.livestream_url, s.tagline, s.service_times]).toEqual([null, null, null, null, null, null, null, null, null]);
    expect(s.church_name).toBe("FlagUpJesus Global Ministry");
  });

  it("is a no-op on already-clean data", () => {
    const store = load();
    cleanLegacyDemoData(store);
    expect(cleanLegacyDemoData(store)).toBe(0);
  });

  it("does not touch settings FUJ has customised", () => {
    const store = { church_settings: [{ bank_name: "Fidelity Bank", account_number: "5600605313", contact_phone: "07042741000" }] };
    expect(cleanLegacyDemoData(store)).toBe(0);
  });
});
