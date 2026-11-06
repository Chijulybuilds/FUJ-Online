import { describe, expect, it } from "vitest";
import { generateUsername, normalizePhone, usernameBase, usernameCandidates } from "../../src/lib/identity-utils";

describe("normalizePhone", () => {
  it.each([["08031234567", "+2348031234567"], ["+234 803 123 4567", "+2348031234567"], ["2348031234567", "+2348031234567"], ["8031234567", "+2348031234567"], ["0044 7700 900123", "+447700900123"]])("%s → %s", (input, out) => {
    expect(normalizePhone(input)).toBe(out);
  });
});

describe("flag usernames", () => {
  it("prefixes with flag, uses the first name and 3 digits", () => {
    expect(generateUsername("Grace Okafor", () => 0.5)).toBe("flaggrace550");
    expect(generateUsername("  Chukwuemekachukwu Obi")).toMatch(/^flagchukwuemek\d{3}$/);
  });
  it("strips accents and symbols", () => {
    expect(usernameBase("Zoë-Ann O'Neil")).toBe("flagzoeann");
    expect(usernameBase("123")).toBe("flagmember");
  });
  it("always matches the database format constraint", () => {
    for (const name of ["Ada", "José María", "Ifeoluwapo Adeyemi-Bakare", "!!!"]) expect(generateUsername(name)).toMatch(/^flag[a-z]{1,10}[0-9]{3}$/);
  });
  it("accepts typed usernames with or without the prefix, any case", () => {
    expect(usernameCandidates(" FlagGrace101 ")).toEqual(["flaggrace101"]);
    expect(usernameCandidates("grace101")).toEqual(["grace101", "flaggrace101"]);
  });
});
