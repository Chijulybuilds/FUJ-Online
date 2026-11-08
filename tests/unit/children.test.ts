import { describe, expect, it } from "vitest";
import { ageGroupOf, ageLabel, ageOf, childBirthdayProblem, childEmoji, nextBirthday } from "@/lib/children";
import { childRegistrationSchema } from "@/lib/validation/auth";

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

describe("child registration form", () => {
  const base = {
    fullName: "Tobi Adeyemi", birthday: "2019-05-04", gender: "male", guardianName: "Funke Adeyemi", relationship: "Mother",
    phone: "0803 555 1234", email: "", address: "4 Elelenwo Street, Port Harcourt", careNotes: "Allergic to peanuts", firstTimer: "yes", consent: true
  };
  const firstError = (input: unknown) => { const r = childRegistrationSchema.safeParse(input); return r.success ? null : r.error.issues[0]?.message; };
  it("accepts a child with a parent's phone number", () => {
    expect(childRegistrationSchema.safeParse(base).success).toBe(true);
  });
  it("needs consent, a parent's name, a relationship and an under-18 birthday", () => {
    expect(firstError({ ...base, consent: false })).toBe("Please confirm you're the child's parent or guardian");
    expect(firstError({ ...base, guardianName: "" })).toBe("Enter the parent's or guardian's full name");
    expect(firstError({ ...base, relationship: "Neighbour" })).toBe("Choose how you're related to the child");
    expect(firstError({ ...base, birthday: "1990-01-01" })).toMatch(/under-18s/);
    expect(firstError({ ...base, birthday: "" })).toBe("Enter your child's birthday");
  });
});
