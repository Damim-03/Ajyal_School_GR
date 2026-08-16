"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.userQuerySchema = exports.userIdSchema = exports.updateUserSchema = exports.createUserSchema = void 0;
const zod_1 = require("zod");
const passwordField = zod_1.z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100, "Password must not exceed 100 characters");
const phoneField = zod_1.z
    .string()
    .trim()
    .min(8, "Phone must be at least 8 characters")
    .max(20, "Phone must not exceed 20 characters")
    .regex(/^[0-9+\s-]+$/, "Phone may contain digits, spaces, + and - only");
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createUserSchema = zod_1.z.object({
    username: zod_1.z
        .string({ error: "Username is required" })
        .trim()
        .min(3, "Username must be at least 3 characters")
        .max(50, "Username must not exceed 50 characters")
        .regex(/^[a-zA-Z0-9._-]+$/, "Username may contain letters, digits, dot, underscore and dash only"),
    password: passwordField,
    firstName: zod_1.z
        .string({ error: "First name is required" })
        .trim()
        .min(2, "First name must be at least 2 characters")
        .max(50),
    lastName: zod_1.z
        .string({ error: "Last name is required" })
        .trim()
        .min(2, "Last name must be at least 2 characters")
        .max(50),
    email: zod_1.z.email({ error: "Invalid email address" }).trim().nullish(),
    phone: phoneField.nullish(),
    avatar: zod_1.z.string().trim().max(255).nullish(),
    /*
     * اختياريٌّ بافتراضٍ لا مطلوب: الحقل أُضيف للأفاتار الافتراضي، وجعلُه
     * مطلوباً يكسر كل مُنشئٍ قائم لأجل قيمةٍ لا تؤثّر في صلاحية ولا حساب.
     */
    gender: zod_1.z.enum(["MALE", "FEMALE"]).default("MALE"),
    roleId: zod_1.z
        .string({ error: "Role is required" })
        .trim()
        .min(1, "Role is required"),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
//
// كلمة المرور اختيارية — تُرسل فقط عند تغييرها
// --------------------------------------------------
exports.updateUserSchema = exports.createUserSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.userIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "User id is required"),
});
exports.userQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    roleId: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=user.schema.js.map