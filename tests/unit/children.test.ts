import { describe, expect, it } from "vitest";
import { ageGroupOf, ageLabel, ageOf, childBirthdayProblem, childEmoji, nextBirthday } from "@/lib/children";
import { registrationSchema, usesParentsPhone } from "@/lib/validation/auth";

const now = new Date("2026-11-08T10:00:00Z"); // Sunday 8 Nov 2026, 11:00 Lagos

describe("children helpers", () => {
  it("works out ages and age groups (Lagos time)", () => {
    expect(ageOf("2020-11-08", now)).toBe(6); // birthday today
    expect(ageOf("2020-11-09", now)).toBe(5);
    expect(ageOf(null, now)).toBeNull();
    expect(ageGroupOf(2)?.label).toBe("Toddlers");
    expect(ageGroupOf(6)?.label).toBe("Pre-school");
    expect(ageGroupOf(9)?.label).toBe("Juniors");
    expect(ageGroupOf(12)?.label).toBe("Pre-teens");
    expect(ageGroupOf(17)?.label).toBe("Teens");
    expect(ageGroupOf(18)).toBeNull();
    expect(ageLabel("2026-05-01", now)).toBe("6 months");
    expect(ageLabel("2026-11-01", now)).toBe("Newborn");
    expect(ageLabel("2019-03-02", now)).toBe("7 years");
  });

  it("counts down to the next birthday", () => {
    expect(nextBirthday("2018-11-08", now)).toEqual({ days: 0, turning: 8 });
    expect(nextBirthday("2018-11-20", now)).toEqual({ days: 12, turning: 8 });
    expect(nextBirthday("2018-01-05", now)).toEqual({ days: 58, turning: 9 });
    expect(nextBirthday("2016-02-29", now)?.turning).toBe(11); // 28 Feb 2027 in non-leap years
  });

  it("only takes under-18s and gives each child a face", () => {
    expect(childBirthdayProblem("2010-01-01", now)).toBeNull();
    expect(childBirthdayProblem("2008-11-08", now)).toMatch(/under-18s/);
    expect(childEmoji("female", 5)).toBe("👧");
    expect(childEmoji(null, 0)).toBe("👶");
    expect(childEmoji("male", 15)).toBe("👨");
  });
});

describe("registration form: under 18", () => {
  const born = (years: number) => new Date(Date.now() - (years * 365.25 + 40) * 86400000).toISOString().slice(0, 10);
  const base = { fullName: "Chileme Caleb", phone: "0905 677 0824", email: "", birthday: born(7), address: "Harmony Estate, Port Harcourt", firstTimer: "no" };
  const firstError = (input: unknown) => { const r = registrationSchema.safeParse(input); return r.success ? null : r.error.issues[0]?.message; };
  it("adults don't see any of the under-18 questions", () => {
    expect(registrationSchema.safeParse({ ...base, birthday: "1990-01-01" }).success).toBe(true);
  });
  it("asks under-18s whose phone number it is, and for their parent's consent", () => {
    expect(firstError(base)).toMatch(/whose phone number you entered/);
    expect(firstError({ ...base, phoneOwner: "self" })).toBe("Please confirm your parent or guardian knows you're registering");
    expect(registrationSchema.safeParse({ ...base, phoneOwner: "self", guardianConsent: true }).success).toBe(true);
  });
  it("with a parent's number, needs the parent's name and relationship", () => {
    expect(firstError({ ...base, phoneOwner: "parent", guardianConsent: true })).toBe("Enter your parent's or guardian's full name");
    expect(firstError({ ...base, phoneOwner: "parent", guardianName: "Pastor Caleb", guardianConsent: true })).toBe("Choose how they're related to you");
    const ok = { ...base, phoneOwner: "parent" as const, guardianName: "Pastor Caleb", relationship: "Father", guardianConsent: true };
    expect(registrationSchema.safeParse(ok).success).toBe(true);
    expect(usesParentsPhone(ok)).toBe(true);
    expect(usesParentsPhone({ ...ok, birthday: "1990-01-01" })).toBe(false);
  });
});
