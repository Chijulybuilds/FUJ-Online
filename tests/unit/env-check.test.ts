import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanEnvValue } from "@/lib/env";
import { configProblems } from "@/lib/env-check";

const jwt = (role: string) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify({ role })).toString("base64url")}.sig`;
const good = {
  NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: jwt("anon"),
  SUPABASE_SERVICE_ROLE_KEY: jwt("service_role"),
  ADMIN_LOGIN_EMAIL: "admin@flagupjesus.org",
  ADMIN_LOGIN_PASSWORD: "a-long-shared-password",
  NEXT_PUBLIC_APP_URL: "https://www.flagupjesus.org",
  QR_SIGNING_SECRET: "x".repeat(40),
  CLIENT_ID: "id",
  CLIENT_SECRET: "secret"
};
function withEnv(vars: Record<string, string>) {
  for (const [k, v] of Object.entries(vars)) vi.stubEnv(k, v);
}
afterEach(() => vi.unstubAllEnvs());

describe("configProblems", () => {
  it("is empty for a complete configuration", () => {
    withEnv(good);
    expect(configProblems()).toEqual([]);
  });
  it("names missing variables", () => {
    withEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: "", ADMIN_LOGIN_PASSWORD: "" });
    expect(configProblems()).toEqual(expect.arrayContaining(["SUPABASE_SERVICE_ROLE_KEY is missing", "ADMIN_LOGIN_PASSWORD is missing"]));
  });
  it("catches the anon key pasted as the service-role key", () => {
    withEnv({ ...good, SUPABASE_SERVICE_ROLE_KEY: jwt("anon"), NEXT_PUBLIC_SUPABASE_ANON_KEY: "other" });
    expect(configProblems().join(" ")).toMatch(/anon key/);
  });
  it("catches a Supabase URL with a path and a short admin password in production", () => {
    withEnv({ ...good, NODE_ENV: "production", NEXT_PUBLIC_SUPABASE_URL: "https://abcdefgh.supabase.co/rest/v1", ADMIN_LOGIN_PASSWORD: "short" });
    const problems = configProblems().join(" ");
    expect(problems).toMatch(/should look like https/);
    expect(problems).toMatch(/at least 12 characters/);
  });
  it("cleans quotes and whitespace from pasted values", () => {
    expect(cleanEnvValue(' "https://x.supabase.co" ')).toBe("https://x.supabase.co");
    expect(cleanEnvValue("'abc'")).toBe("abc");
    expect(cleanEnvValue(undefined)).toBe("");
  });
});
