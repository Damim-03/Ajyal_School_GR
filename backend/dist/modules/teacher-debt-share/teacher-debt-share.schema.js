"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelDebtShareSchema = exports.debtShareIdSchema = exports.debtShareQuerySchema = void 0;
const zod_1 = require("zod");
exports.debtShareQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(50),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    /**
     * الإسناد الذي نشأ فيه الدَّين — مادةٌ وفوجٌ وأستاذ.
     *
     * الأستاذ يدرّس أفواجاً، وكشفُ كلِّ فوجٍ ورقتُه. فمتأخّرات الفوج 2
     * تُقرأ في كشوف الفوج 2 وحدها — وإلّا خرجت على ورقة فوجٍ آخر فبدت
     * ديناً له.
     */
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    /** التخليصُ الذي حملها في راتبه — به يُقرأ «ما دُفع مع هذا الكشف» */
    collectionSettlementId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(["PENDING", "APPROVED", "PAID", "CANCELLED"]).optional(),
});
exports.debtShareIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Debt share id is required"),
});
exports.cancelDebtShareSchema = zod_1.z.object({
    reason: zod_1.z
        .string({ error: "Reason is required" })
        .trim()
        .min(3, "Reason is required")
        .max(500),
});
//# sourceMappingURL=teacher-debt-share.schema.js.map