import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(5, "Email is too short")
  .max(255, "Email is too long")
  .email("Please enter a valid email address");

export function isValidEmail(email: string): boolean {
  return emailSchema.safeParse(email).success;
}
