import { describe, expect, it } from "vitest";
import { birthdayProblem, registrationSchema } from "@/lib/validation/auth";

const base = { fullName: "Ada Obi", phone: "0803 123 4567", email: "", birthday: "1994-08-21", address: "12 Aba Road, Rumuomasi, Port Harcourt" };
const firstError = (input: unknown) => {
  const r = registrationSchema.safeParse(input);
  return r.success ? null : r.error.issues[0]?.message;
};

describe("registration: birthday and home address", () => {
  it("accepts full name, phone, birthday and address (email optional)", () => {
    const r = registrationSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) expect(r.data).toMatchObject({ birthday: "1994-08-21", address: "12 Aba Road, Rumuomasi, Port Harcourt" });
  });

  it("requires a birthday", () => {
    const { birthday: _omit, ...rest } = base;
    void _omit;
    expect(firstError(rest)).toBe("Enter your birthday");
    expect(firstError({ ...base, birthday: "" })).toBe("Enter your birthday");
  });

  it("requires a home address", () => {
    const { address: _omit, ...rest } = base;
    void _omit;
    expect(firstError(rest)).toBe("Enter your home address");
    expect(firstError({ ...base, address: "   " })).toBe("Enter your home address");
    expect(firstError({ ...base, address: "x".repeat(301) })).toBe("That address is too long");
  });

  it("rejects impossible, ancient and future birthdays", () => {
    const today = new Date("2026-11-08T12:00:00Z");
    expect(birthdayProblem("2001-02-30", today)).toBe("Enter a valid birthday");
    expect(birthdayProblem("21/08/1994", today)).toBe("Enter your birthday");
    expect(birthdayProblem("1899-12-31", today)).toBe("Enter a valid birthday");
    expect(birthdayProblem("2026-12-25", today)).toBe("Your birthday can't be in the future");
    expect(birthdayProblem("2026-11-08", today)).toBeNull();
    expect(birthdayProblem("2000-02-29", today)).toBeNull();
  });
});
