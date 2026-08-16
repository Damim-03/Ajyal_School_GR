import { z } from "zod";

const passwordField = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(100, "Password must not exceed 100 characters");

const phoneField = z
  .string()
  .trim()
  .min(8, "Phone must be at least 8 characters")
  .max(20, "Phone must not exceed 20 characters")
  .regex(/^[0-9+\s-]+$/, "Phone may contain digits, spaces, + and - only");

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createUserSchema = z.object({
  username: z
    .string({ error: "Username is required" })
    .trim()
    .min(3, "Username must be at least 3 characters")
    .max(50, "Username must not exceed 50 characters")
    .regex(
      /^[a-zA-Z0-9._-]+$/,
      "Username may contain letters, digits, dot, underscore and dash only",
    ),

  password: passwordField,

  firstName: z
    .string({ error: "First name is required" })
    .trim()
    .min(2, "First name must be at least 2 characters")
    .max(50),

  lastName: z
    .string({ error: "Last name is required" })
    .trim()
    .min(2, "Last name must be at least 2 characters")
    .max(50),

  email: z.email({ error: "Invalid email address" }).trim().nullish(),

  phone: phoneField.nullish(),

  avatar: z.string().trim().max(255).nullish(),

  /*
   * اختياريٌّ بافتراضٍ لا مطلوب: الحقل أُضيف للأفاتار الافتراضي، وجعلُه
   * مطلوباً يكسر كل مُنشئٍ قائم لأجل قيمةٍ لا تؤثّر في صلاحية ولا حساب.
   */
  gender: z.enum(["MALE", "FEMALE"]).default("MALE"),

  roleId: z
    .string({ error: "Role is required" })
    .trim()
    .min(1, "Role is required"),

  isActive: z.boolean().optional(),
});

// --------------------------------------------------
// Update
//
// كلمة المرور اختيارية — تُرسل فقط عند تغييرها
// --------------------------------------------------

export const updateUserSchema = createUserSchema
  .partial()
  .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
  });

// --------------------------------------------------
// Params & Query
// --------------------------------------------------

export const userIdSchema = z.object({
  id: z.string().trim().min(1, "User id is required"),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().min(1).optional(),
  roleId: z.string().trim().min(1).optional(),
  isActive: z
    .enum(["true", "false"])
    .transform((value) => value === "true")
    .optional(),
});

// --------------------------------------------------
// Types
// --------------------------------------------------

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
