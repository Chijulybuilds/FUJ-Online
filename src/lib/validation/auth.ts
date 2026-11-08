import { z } from "zod";
import { ADULT_AGE, ageOf, RELATIONSHIPS } from "@/lib/children";

/** YYYY-MM-DD that is a real calendar date, not in the future and not before 1900. */
export function birthdayProblem(value: string, today = new Date()): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return "Enter your birthday";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return "Enter a valid birthday";
  if (y < 1900) return "Enter a valid birthday";
  // Allow "today" in any time zone (UTC+14 is the furthest ahead).
  if (date.getTime() > today.getTime() + 14 * 3600000) return "Your birthday can't be in the future";
  return null;
}

export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(24).regex(/^[+\d][\d\s()-]+$/, "Enter a valid phone number"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
  birthday: z.string({ error: "Enter your birthday" }).trim().superRefine((v, ctx) => {
    const problem = birthdayProblem(v);
    if (problem) ctx.addIssue({ code: "custom", message: problem });
  }),
  address: z.string({ error: "Enter your home address" }).trim().min(5, "Enter your home address").max(300, "That address is too long"),
  /** "Is this your first time worshipping with FlagUpJesus?" — first timers get their own follow-up. */
  firstTimer: z.enum(["yes", "no"], { error: "Tell us if this is your first time with us" }),
  /** Ticked "I'd like to become a FUJ Partner". */
  partner: z.boolean().optional(),
  /** 6-digit SMS code; not needed when the person signed in with Google. */
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").optional(),
  /** Under 18 only: is the phone number their own, or a parent's / guardian's? */
  phoneOwner: z.enum(["self", "parent"]).optional(),
  guardianName: z.string().trim().max(120).optional(),
  relationship: z.string().trim().max(40).optional(),
  /** Under 18: "My parent or guardian knows I'm registering". */
  guardianConsent: z.boolean().optional()
}).superRefine((d, ctx) => {
  const age = ageOf(d.birthday);
  if (age === null || age < 0 || age >= ADULT_AGE) return;
  const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
  if (!d.phoneOwner) return issue("phoneOwner", "You're under 18: tell us whose phone number you entered — yours, or your parent's or guardian's");
  if (d.phoneOwner === "parent") {
    if (!d.guardianName || d.guardianName.length < 2) issue("guardianName", "Enter your parent's or guardian's full name");
    else if (!RELATIONSHIPS.includes(d.relationship as (typeof RELATIONSHIPS)[number])) issue("relationship", "Choose how they're related to you");
  }
  if (!d.guardianConsent) issue("guardianConsent", "Please confirm your parent or guardian knows you're registering");
});

/** Under 18 and using a parent's / guardian's phone number? */
export const usesParentsPhone = (d: Pick<RegistrationInput, "birthday" | "phoneOwner">) => {
  const age = ageOf(d.birthday);
  return age !== null && age >= 0 && age < ADULT_AGE && d.phoneOwner === "parent";
};
export type RegistrationInput = z.infer<typeof registrationSchema>;

