"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Login
// --------------------------------------------------
exports.loginSchema = zod_1.z.object({
    username: zod_1.z
        .string({ error: "Username is required" })
        .min(3, "Username must be at least 3 characters")
        .max(50, "Username must not exceed 50 characters")
        .trim(),
    password: zod_1.z
        .string({ error: "Password is required" })
        .min(6, "Password must be at least 6 characters")
        .max(100, "Password must not exceed 100 characters"),
});
//# sourceMappingURL=auth.schema.js.map