import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildSetupSql } from "../../scripts/build-setup-sql.mjs";

describe("supabase/setup.sql", () => {
  it("is up to date with the migrations (run `npm run db:setup-sql` after changing one)", () => {
    expect(readFileSync("supabase/setup.sql", "utf8")).toBe(buildSetupSql());
  });
  it("contains no departments tables and no hard failures on re-run", () => {
    const sql = readFileSync("supabase/setup.sql", "utf8");
    expect(sql).not.toMatch(/create table (if not exists )?public\.(member_)?departments/);
    expect(sql).not.toMatch(/^create type /m);           // types are wrapped in duplicate_object guards
    // Re-running after family members share a number (0015) must not bring back the adults-only phone rule.
    expect(sql).not.toMatch(/^create unique index if not exists people_adult_phone_key/m);
    expect(sql).toMatch(/indexname = 'people_phone_owner_key'\) then\s+create unique index if not exists people_adult_phone_key/);
  });
});
