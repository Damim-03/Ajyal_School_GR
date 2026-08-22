"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelTeacherPaymentSchema = exports.teacherPaymentIdSchema = exports.teacherPaymentQuerySchema = exports.payTeacherSchema = void 0;
const zod_1 = require("zod");
/**
 * إثبات الدفع للأستاذ.
 *
 * التخليص واحدٌ لكل (إسناد + كشف) — أي لكل مادةٍ وفوج. والأستاذ يدرّس
 * عدّة أفواج، فيُدفع له مرّةً واحدة عن كلِّها: دفعةٌ برقمها موزَّعةٌ على
 * تخليصاتها، لا ثلاث عمليّاتٍ وثلاث أوراق.
 */
exports.payTeacherSchema = zod_1.z.object({
    teacherId: zod_1.z
        .string({ error: "Teacher is required" })
        .trim()
        .min(1, "Teacher is required"),
    /** التخليصات المؤكَّدة التي تُدفع الآن */
    settlementIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(50).default([]),
    /**
     * حصصُ ديونٍ حُصّلت بعد تخليصها — تُدمج في الدفعة نفسها.
     *
     * «راتب الشهر 2 + متأخّرات الشهر 1» ورقةٌ واحدة، والقاعدة تحتفظ
     * بمصدر كل دينار.
     */
    debtShareIds: zod_1.z.array(zod_1.z.string().trim().min(1)).max(100).default([]),
    /* نفس ما يقبله `PaymentMethod` في القاعدة — لا صيغة ثانية */
    paymentMethod: zod_1.z.enum(["CASH", "CARD", "BANK_TRANSFER"]).default("CASH"),
    /** يوم التسليم — لا يُفترض اليوم: قد تُسجَّل دفعةُ الأمس */
    paymentDate: zod_1.z.coerce.date().optional(),
    reference: zod_1.z.string().trim().max(80).nullish(),
    note: zod_1.z.string().trim().max(500).nullish(),
})
    /* دفعةٌ بلا سطرٍ واحد لا معنى لها */
    .refine((body) => body.settlementIds.length + body.debtShareIds.length > 0, {
    error: "Select at least one settlement or debt share",
});
exports.teacherPaymentQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(["ACTIVE", "CANCELLED"]).optional(),
    dateFrom: zod_1.z.coerce.date().optional(),
    dateTo: zod_1.z.coerce.date().optional(),
});
exports.teacherPaymentIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Payment id is required"),
});
exports.cancelTeacherPaymentSchema = zod_1.z.object({
    reason: zod_1.z
        .string({ error: "Reason is required" })
        .trim()
        .min(3, "Reason is required")
        .max(500),
});
//# sourceMappingURL=teacher-payment.schema.js.map