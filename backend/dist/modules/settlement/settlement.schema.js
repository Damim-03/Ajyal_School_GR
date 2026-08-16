"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyClearanceQuerySchema = exports.estimateQuerySchema = exports.settlementQuerySchema = exports.cancelSettlementSchema = exports.confirmSettlementSchema = exports.settlementIdSchema = exports.computeSettlementSchema = void 0;
const zod_1 = require("zod");
/**
 * لاحظ ما **ليس** هنا: teacherAmount، ولا أيّ مجموع.
 *
 * §18: «يجب منع المستخدم من إدخال النتائج النهائية». والمنعُ ببنية
 * المخطّط لا بفحصٍ داخل الخدمة: ما لا مكان له في الطلب لا يُرسَل
 * أصلاً، فلا يحتاج رفضاً.
 *
 * الإدارة تُدخل: أيّ إسناد، وأيّ كشف. والنظام يستنتج الباقي.
 */
exports.computeSettlementSchema = zod_1.z.object({
    teachingAssignmentId: zod_1.z
        .string({ error: "Teaching assignment is required" })
        .trim()
        .min(1),
    attendanceSheetId: zod_1.z
        .string({ error: "Attendance sheet is required" })
        .trim()
        .min(1),
    /// سياسة بعينها بدل المرجَّحة تلقائياً — للحالات الاستثنائية
    policyId: zod_1.z.string().trim().min(1).nullish(),
    note: zod_1.z.string().trim().max(500).nullish(),
});
exports.settlementIdSchema = zod_1.z.object({
    id: zod_1.z.string().trim().min(1, "Settlement id is required"),
});
exports.confirmSettlementSchema = zod_1.z.object({
    note: zod_1.z.string().trim().max(500).nullish(),
});
exports.cancelSettlementSchema = zod_1.z.object({
    cancelReason: zod_1.z
        .string({ error: "Cancel reason is required" })
        .trim()
        .min(3, "Cancel reason is required")
        .max(500),
});
exports.settlementQuerySchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().min(1).default(1),
    limit: zod_1.z.coerce.number().int().min(1).max(100).default(20),
    academicYearId: zod_1.z.string().trim().min(1).optional(),
    teacherId: zod_1.z.string().trim().min(1).optional(),
    teachingAssignmentId: zod_1.z.string().trim().min(1).optional(),
    attendanceSheetId: zod_1.z.string().trim().min(1).optional(),
    status: zod_1.z.enum(["DRAFT", "CONFIRMED", "PAID", "CANCELLED"]).optional(),
});
// --------------------------------------------------
// الكشفان الماليان
// --------------------------------------------------
/** §16 — الكشف التقديري للحصص */
exports.estimateQuerySchema = zod_1.z.object({
    teachingAssignmentId: zod_1.z.string().trim().min(1),
    attendanceSheetId: zod_1.z.string().trim().min(1),
    policyId: zod_1.z.string().trim().min(1).optional(),
});
/** §17 — كشف التخليص اليومي المالي */
exports.dailyClearanceQuerySchema = zod_1.z.object({
    date: zod_1.z.coerce.date({ error: "Date is required" }),
    receivedById: zod_1.z.string().trim().min(1).optional(),
    paymentMethod: zod_1.z.enum(["CASH", "CARD", "BANK_TRANSFER"]).optional(),
});
//# sourceMappingURL=settlement.schema.js.map