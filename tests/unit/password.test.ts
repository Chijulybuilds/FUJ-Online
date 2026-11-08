import { describe, expect, it } from "vitest";

process.env.QR_SIGNING_SECRET = "test-secret-that-is-at-least-32-characters";
const { createPasswordToken, hashPassword, passwordProblem, readPasswordToken, verifyPassword } = await import("@/lib/auth/password");

describe("member passwords", () => {
  it("hashes with scrypt and verifies only the right password", async () => {
    const hash = await hashPassword("Grace&Truth2026");
    expect(hash).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(hash).not.toContain("Grace");
    expect(await verifyPassword("Grace&Truth2026", hash)).toBe(true);
    expect(await verifyPassword("grace&truth2026", hash)).toBe(false);
    expect(await hashPassword("Grace&Truth2026")).not.toBe(hash); // salted
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("rejects weak passwords in plain English", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("aaaaaaaaaa")).toMatch(/same character/);
    expect(passwordProblem("password")).toMatch(/too easy/);
    expect(passwordProblem("Jesus is Lord!")).toBeNull();
  });

  it("signs set-password links and refuses tampered ones", () => {
    const token = createPasswordToken("person-1", "none", "welcome", 60000);
    expect(readPasswordToken(token)).toMatchObject({ p: "person-1", v: "none", k: "welcome" });
    const [body, sig] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ p: "person-2", e: Date.now() + 1e9, v: "none", k: "welcome" })).toString("base64url");
    expect(readPasswordToken(`${forged}.${sig}`)).toBeNull();
    expect(readPasswordToken(`${body}.x${sig.slice(1)}`)).toBeNull();
    expect(readPasswordToken("nonsense")).toBeNull();
    expect(readPasswordToken(null)).toBeNull();
  });
});
