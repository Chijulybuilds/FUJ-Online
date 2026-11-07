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
  });
});
