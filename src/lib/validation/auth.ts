import { z } from "zod";
export const registrationSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name").max(120),
  phone: z.string().trim().min(7, "Enter a valid phone number").max(24).regex(/^[+\d][\d\s()-]+$/, "Enter a valid phone number"),
  email: z.union([z.string().trim().email("Enter a valid email"), z.literal("")]).optional(),
  status: z.enum(["visitor", "member"]).default("visitor"),
  gender: z.enum(["", "female", "male"]).optional(),
  birthday: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal("")]).optional(),
  address: z.string().trim().max(200).optional(),
  howHeard: z.string().trim().max(120).optional()
});
export type RegistrationInput = z.infer<typeof registrationSchema>;
