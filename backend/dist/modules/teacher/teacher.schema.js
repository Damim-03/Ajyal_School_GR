"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.teacherQuerySchema = exports.teacherIdSchema = exports.updateTeacherSchema = exports.createTeacherSchema = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../../../generated/prisma");
// --------------------------------------------------
// حقول مشتركة
// --------------------------------------------------
const phoneField = zod_1.z
    .string()
    .trim()
    .min(8, "Phone must be at least 8 characters")
    .max(20, "Phone must not exceed 20 characters")
    .regex(/^[0-9+\s-]+$/, "Phone may contain digits, spaces, + and - only");
const pastDate = (label) => zod_1.z.coerce.date().refine((value) => value <= new Date(), {
    error: `${label} must be in the past`,
});
// --------------------------------------------------
// Create
// --------------------------------------------------
exports.createTeacherSchema = zod_1.z.object({
    firstName: zod_1.z
        .string({ error: "First name is required" })
        .trim()
        .min(2, "First name must be at least 2 characters")
        .max(50, "First name must not exceed 50 characters"),
    lastName: zod_1.z
        .string({ error: "Last name is required" })
        .trim()
        .min(2, "Last name must be at least 2 characters")
        .max(50, "Last name must not exceed 50 characters"),
    email: zod_1.z.email({ error: "Invalid email address" }).trim().nullish(),
    phone: phoneField.nullish(),
    gender: zod_1.z.enum(prisma_1.Gender, { error: "Gender must be MALE or FEMALE" }),
    birthDate: pastDate("Birth date").nullish(),
    hireDate: pastDate("Hire date"),
    address: zod_1.z.string().trim().max(200).nullish(),
    qualification: zod_1.z.string().trim().max(100).nullish(),
    specialization: zod_1.z.string().trim().max(100).nullish(),
    salary: zod_1.z.coerce
        .number()
        .positive("Salary must be greater than 0")
        .max(9999999, "Salary is too large")
        .nullish(),
    isActive: zod_1.z.boolean().optional(),
});
// --------------------------------------------------
// Update
// --------------------------------------------------
exports.updateTeacherSchema = exports.createTeacherSchema
    .partial()
    .refine((body) => Object.keys(body).length > 0, {
    error: "At least one field must be provided",
});
// --------------------------------------------------
// Params & Query
// --------------------------------------------------
exports.teacherIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Teacher id is required"),
});
exports.teacherQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    search: zod_1.z.string().trim().min(1).optional(),
    gender: zod_1.z.enum(prisma_1.Gender).optional(),
    specialization: zod_1.z.string().trim().min(1).optional(),
    isActive: zod_1.z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
});
//# sourceMappingURL=teacher.schema.js.map