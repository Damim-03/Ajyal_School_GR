"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorCodeEnum = void 0;
exports.ErrorCodeEnum = {
    // --------------------------------------------------
    // Auth
    // --------------------------------------------------
    AUTH_INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
    AUTH_TOKEN_NOT_FOUND: "AUTH_TOKEN_NOT_FOUND",
    AUTH_INVALID_TOKEN: "AUTH_INVALID_TOKEN",
    AUTH_TOKEN_EXPIRED: "AUTH_TOKEN_EXPIRED",
    AUTH_USER_NOT_FOUND: "AUTH_USER_NOT_FOUND",
    AUTH_ACCOUNT_SUSPENDED: "AUTH_ACCOUNT_SUSPENDED",
    AUTH_TOO_MANY_ATTEMPTS: "AUTH_TOO_MANY_ATTEMPTS",
    // --------------------------------------------------
    // Access Control
    // --------------------------------------------------
    ACCESS_UNAUTHORIZED: "ACCESS_UNAUTHORIZED",
    ACCESS_FORBIDDEN: "ACCESS_FORBIDDEN",
    // --------------------------------------------------
    // Validation & Resources
    // --------------------------------------------------
    VALIDATION_ERROR: "VALIDATION_ERROR",
    RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",
    RESOURCE_ALREADY_EXISTS: "RESOURCE_ALREADY_EXISTS",
    // --------------------------------------------------
    // Academic Structure
    // --------------------------------------------------
    ACADEMIC_YEAR_NOT_FOUND: "ACADEMIC_YEAR_NOT_FOUND",
    ACADEMIC_YEAR_ALREADY_EXISTS: "ACADEMIC_YEAR_ALREADY_EXISTS",
    EDUCATION_STAGE_NOT_FOUND: "EDUCATION_STAGE_NOT_FOUND",
    LEVEL_NOT_FOUND: "LEVEL_NOT_FOUND",
    STUDY_GROUP_NOT_FOUND: "STUDY_GROUP_NOT_FOUND",
    // --------------------------------------------------
    // Subjects & Teachers
    // --------------------------------------------------
    SUBJECT_NOT_FOUND: "SUBJECT_NOT_FOUND",
    TEACHER_NOT_FOUND: "TEACHER_NOT_FOUND",
    TEACHING_ASSIGNMENT_NOT_FOUND: "TEACHING_ASSIGNMENT_NOT_FOUND",
    TEACHING_ASSIGNMENT_EXISTS: "TEACHING_ASSIGNMENT_EXISTS",
    // --------------------------------------------------
    // Students & Enrollments
    // --------------------------------------------------
    STUDENT_NOT_FOUND: "STUDENT_NOT_FOUND",
    ENROLLMENT_NOT_FOUND: "ENROLLMENT_NOT_FOUND",
    ENROLLMENT_ALREADY_EXISTS: "ENROLLMENT_ALREADY_EXISTS",
    // --------------------------------------------------
    // Schedule & Sessions
    // --------------------------------------------------
    SCHEDULE_NOT_FOUND: "SCHEDULE_NOT_FOUND",
    SCHEDULE_CONFLICT: "SCHEDULE_CONFLICT",
    SESSION_NOT_FOUND: "SESSION_NOT_FOUND",
    // --------------------------------------------------
    // Financial
    // --------------------------------------------------
    INVOICE_NOT_FOUND: "INVOICE_NOT_FOUND",
    INVOICE_ALREADY_EXISTS: "INVOICE_ALREADY_EXISTS",
    INVOICE_ALREADY_PAID: "INVOICE_ALREADY_PAID",
    INVOICE_CANCELLED: "INVOICE_CANCELLED",
    PAYMENT_NOT_FOUND: "PAYMENT_NOT_FOUND",
    PAYMENT_AMOUNT_INVALID: "PAYMENT_AMOUNT_INVALID",
    RECEIPT_NOT_FOUND: "RECEIPT_NOT_FOUND",
    TUITION_FEE_NOT_FOUND: "TUITION_FEE_NOT_FOUND",
    // --------------------------------------------------
    // Settlement — تخليص الأستاذ
    // --------------------------------------------------
    SETTLEMENT_NOT_FOUND: "SETTLEMENT_NOT_FOUND",
    SETTLEMENT_POLICY_NOT_FOUND: "SETTLEMENT_POLICY_NOT_FOUND",
    /// التخليص المؤكَّد مجمَّد — لا يُعاد حسابه ولا يُعدَّل (§21)
    SETTLEMENT_LOCKED: "SETTLEMENT_LOCKED",
    SETTLEMENT_ALREADY_EXISTS: "SETTLEMENT_ALREADY_EXISTS",
    /// المورد مرتبط بسجلات أخرى فلا يُحذف
    RESOURCE_IN_USE: "RESOURCE_IN_USE",
    // --------------------------------------------------
    // First Boot — التهيئة الأولى
    //
    // خمسةُ رموزٍ لا رمزٌ واحد: الواجهةُ تتصرّف بكلٍّ منها تصرّفاً
    // مختلفاً — إعادةُ قراءةِ الحالة، أو عرضُ النقص، أو إخفاءُ الشاشة
    // كلِّها لأنّ التهيئة قد تمّت في نافذةٍ أخرى.
    // --------------------------------------------------
    /// طُلبت خطوةُ تهيئةٍ بعد اكتمالها — لا تُعاد إلّا بإعادة تهيئة (§59)
    SETUP_ALREADY_COMPLETED: "SETUP_ALREADY_COMPLETED",
    /// قفزٌ إلى خطوةٍ لاحقة أو رجوعٌ إلى خطوةٍ لا تُرجَع (§44)
    SETUP_STEP_OUT_OF_ORDER: "SETUP_STEP_OUT_OF_ORDER",
    /// التحقّق النهائي لم يمرّ — والنقصُ مفصَّلٌ في الرد (§21)
    SETUP_VERIFICATION_FAILED: "SETUP_VERIFICATION_FAILED",
    /// جهازٌ مصنَّفٌ REQUIRED غيرُ متوفّر (§37)
    SETUP_DEVICE_MISSING: "SETUP_DEVICE_MISSING",
    /// عمليةٌ تحتاج نظاماً مهيَّأً طُلبت قبل اكتمال التهيئة (§62)
    SETUP_INCOMPLETE: "SETUP_INCOMPLETE",
    // --------------------------------------------------
    // System
    // --------------------------------------------------
    INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
};
//# sourceMappingURL=error-code.enum.js.map