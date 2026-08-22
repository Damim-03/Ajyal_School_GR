"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loginSchema = void 0;
const zod_1 = require("zod");
// --------------------------------------------------
// Login
// --------------------------------------------------
/**
 * الدخول باسم المستخدم **أو** بمعرّف الحساب.
 *
 * والثاني لأجل شاشة اختيار المستخدم: هي تعرض بطاقاتٍ فيها اسمُ العرض
 * والصورة، ولا تعرف اسمَ الدخول — وهذا مقصود. فلو أرجع المسارُ العامّ
 * `username` لكان قد سلّم نصفَ بيانات الاعتماد لكلّ من يبلغ الشبكة.
 * والمعرّفُ (cuid) لا يُخمَّن ولا يُكتب في نموذج، فكشفُه لا يُقرّب أحداً
 * من حساب.
 *
 * وواحدٌ منهما لا كلاهما — والتحقّقُ هنا لا في الخدمة، فالطلبُ الفارغ
 * من الاثنين يُردّ قبل أن يمسّ القاعدة.
 */
exports.loginSchema = zod_1.z
    .object({
    username: zod_1.z
        .string()
        .min(3, "Username must be at least 3 characters")
        .max(50, "Username must not exceed 50 characters")
        .trim()
        .optional(),
    userId: zod_1.z.string().trim().min(1).max(64).optional(),
    password: zod_1.z
        .string({ error: "Password is required" })
        .min(6, "Password must be at least 6 characters")
        .max(100, "Password must not exceed 100 characters"),
})
    .refine((body) => Boolean(body.username) !== Boolean(body.userId), {
    message: "Provide either username or userId",
    path: ["username"],
});
//# sourceMappingURL=auth.schema.js.map