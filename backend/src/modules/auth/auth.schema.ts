import { z } from "zod";

// --------------------------------------------------
// Login
// --------------------------------------------------

export const loginSchema = z.object({
  username: z
    .string({ error: "Username is required" })
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must not exceed 50 characters")
    .trim(),

  password: z
    .string({ error: "Password is required" })
    .min(6, "Password must be at least 6 characters")
    .max(100, "Password must not exceed 100 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;
