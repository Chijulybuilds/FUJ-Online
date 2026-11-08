import { z } from "zod";

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
  /** 6-digit SMS code; not needed when the person signed in with Google. */
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").optional()
});
export type RegistrationInput = z.infer<typeof registrationSchema>;
