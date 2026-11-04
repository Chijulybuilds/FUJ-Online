import { z } from "zod";
export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(24),
  email: z.union([z.string().email(), z.literal("")]).optional(),
  status: z.enum(["visitor", "member"]).default("visitor")
});
export type RegistrationInput = z.infer<typeof registrationSchema>;
