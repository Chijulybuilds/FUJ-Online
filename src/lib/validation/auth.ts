import { z } from "zod";
export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(24).regex(/^[+\d][\d\s()-]+$/, "Enter a valid phone number"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
  /** 6-digit SMS code; not needed when the person signed in with Google. */
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code").optional()
});
export type RegistrationInput = z.infer<typeof registrationSchema>;
