"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DATA_QUALITY_COLUMNS = exports.CANCELLATION_COLUMNS = exports.AUDIT_SORT = exports.AUDIT_COLUMNS = exports.ALLOCATION_SORT = exports.ALLOCATION_COLUMNS = exports.TEACHER_PAYMENT_SORT = exports.TEACHER_PAYMENT_COLUMNS = exports.SETTLEMENT_ROW_DRILL = exports.SETTLEMENT_SORT = exports.SETTLEMENT_COLUMNS = exports.DEBT_COLLECTION_SORT = exports.DEBT_COLLECTION_COLUMNS = exports.DEBT_SORT = exports.DEBT_COLUMNS = exports.RECEIPT_SORT = exports.RECEIPT_COLUMNS = exports.PAYMENT_SORT = exports.PAYMENT_COLUMNS = exports.INVOICE_SORT = exports.INVOICE_COLUMNS = void 0;
const reports_table_1 = require("./reports.table");
// ======================================================
// جداولُ التقارير المالية والتخليص والتدقيق
//
// مفصولةٌ عن `reports.tables.ts` لأنّ الملفَّ الواحد كان سيتجاوز
// الأربعمئة سطر من تعريفاتٍ متشابهة — وتشابهُها هو ما يجعل خطأً
// فيها يمرّ في المراجعة. فالتقسيمُ بالمجال يُبقي كلَّ مجموعةٍ
// قابلةً للقراءة دفعةً واحدة.
// ======================================================
// --------------------------------------------------
// الفواتير — §22
// --------------------------------------------------
exports.INVOICE_COLUMNS = [
    (0, reports_table_1.column)("invoiceNumber", "رقم الفاتورة", "text", { sortable: true }),
    (0, reports_table_1.column)("studentName", "الطالب", "text"),
    (0, reports_table_1.column)("subject", "المادة", "text"),
    (0, reports_table_1.column)("studyGroup", "الفوج", "text"),
    (0, reports_table_1.column)("month", "الشهر", "number", { sortable: true }),
    (0, reports_table_1.column)("year", "السنة", "number"),
    (0, reports_table_1.column)("amount", "المبلغ", "money"),
    (0, reports_table_1.column)("discount", "الحسم", "money", { hiddenByDefault: true }),
    (0, reports_table_1.column)("total", "الإجمالي", "money", { sortable: true }),
    (0, reports_table_1.column)("paid", "المسدَّد", "money"),
    (0, reports_table_1.column)("remaining", "المتبقّي", "money", { sortable: true }),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
    (0, reports_table_1.column)("dueDate", "الاستحقاق", "date", { sortable: true }),
];
exports.INVOICE_SORT = {
    allowed: {
        invoiceNumber: (dir) => ({ invoiceNumber: dir }),
        /*
         * الفرزُ بالشهر مركّبٌ على (سنة، شهر) لا على الشهر وحده.
         *
         * وإلّا تجاور سبتمبر 2025 وسبتمبر 2026 في القائمة — ترتيبٌ
         * يبدو صحيحاً داخل سنةٍ واحدة ويختلط عبر السنوات، وهو أخبثُ
         * من ترتيبٍ خاطئ ظاهرٍ للعين.
         */
        month: (dir) => [{ year: dir }, { month: dir }],
        total: (dir) => ({ total: dir }),
        remaining: (dir) => ({ remaining: dir }),
        status: (dir) => ({ status: dir }),
        dueDate: (dir) => ({ dueDate: dir }),
    },
    fallback: "dueDate",
};
// --------------------------------------------------
// الدفعات — §23
// --------------------------------------------------
exports.PAYMENT_COLUMNS = [
    (0, reports_table_1.column)("paymentNumber", "رقم الدفعة", "text", { sortable: true }),
    (0, reports_table_1.column)("students", "الطالب/الطلبة", "text"),
    (0, reports_table_1.column)("amount", "المبلغ", "money", { sortable: true }),
    (0, reports_table_1.column)("paymentMethod", "الطريقة", "status"),
    (0, reports_table_1.column)("paymentDate", "التاريخ", "date", { sortable: true }),
    (0, reports_table_1.column)("invoiceCount", "الفواتير", "number"),
    (0, reports_table_1.column)("receiptNumber", "الإيصال", "text"),
    (0, reports_table_1.column)("receivedBy", "استلمها", "text", { hiddenByDefault: true }),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
];
exports.PAYMENT_SORT = {
    allowed: {
        paymentNumber: (dir) => ({ paymentNumber: dir }),
        amount: (dir) => ({ amount: dir }),
        paymentDate: (dir) => ({ paymentDate: dir }),
        status: (dir) => ({ status: dir }),
    },
    fallback: "paymentDate",
};
// --------------------------------------------------
// الإيصالات — §24
// --------------------------------------------------
exports.RECEIPT_COLUMNS = [
    (0, reports_table_1.column)("receiptNumber", "رقم الإيصال", "text", { sortable: true }),
    (0, reports_table_1.column)("paymentNumber", "الدفعة", "text"),
    (0, reports_table_1.column)("studentName", "الطالب", "text"),
    (0, reports_table_1.column)("amount", "المبلغ", "money"),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
    (0, reports_table_1.column)("printed", "طُبع", "status"),
    (0, reports_table_1.column)("printedAt", "تاريخ الطبع", "date", { sortable: true }),
    (0, reports_table_1.column)("printedBy", "طبعه", "text", { hiddenByDefault: true }),
    (0, reports_table_1.column)("cancelledAt", "تاريخ الإلغاء", "date", { hiddenByDefault: true }),
];
exports.RECEIPT_SORT = {
    allowed: {
        receiptNumber: (dir) => ({ receiptNumber: dir }),
        status: (dir) => ({ status: dir }),
        printedAt: (dir) => ({ printedAt: dir }),
        createdAt: (dir) => ({ createdAt: dir }),
    },
    fallback: "createdAt",
};
// --------------------------------------------------
// الديون — §25
// --------------------------------------------------
exports.DEBT_COLUMNS = [
    (0, reports_table_1.column)("studentName", "الطالب", "text"),
    (0, reports_table_1.column)("invoiceNumber", "الفاتورة", "text"),
    (0, reports_table_1.column)("subject", "المادة", "text"),
    (0, reports_table_1.column)("originalMonth", "شهر الأصل", "number", { sortable: true }),
    (0, reports_table_1.column)("originalYear", "سنة الأصل", "number"),
    (0, reports_table_1.column)("total", "الإجمالي", "money"),
    (0, reports_table_1.column)("paid", "المسدَّد", "money"),
    (0, reports_table_1.column)("remaining", "المتبقّي", "money", { sortable: true }),
    (0, reports_table_1.column)("ageInMonths", "العمر بالأشهر", "number"),
    (0, reports_table_1.column)("ageBucket", "الشريحة", "status"),
];
exports.DEBT_SORT = {
    allowed: {
        originalMonth: (dir) => [{ year: dir }, { month: dir }],
        remaining: (dir) => ({ remaining: dir }),
    },
    fallback: "originalMonth",
};
// --------------------------------------------------
// تحصيل الديون — §26
// --------------------------------------------------
exports.DEBT_COLLECTION_COLUMNS = [
    (0, reports_table_1.column)("collectedAt", "تاريخ التحصيل", "date", { sortable: true }),
    (0, reports_table_1.column)("studentName", "الطالب", "text"),
    (0, reports_table_1.column)("invoiceNumber", "الفاتورة الأصلية", "text"),
    (0, reports_table_1.column)("originalMonth", "شهر الأصل", "number", { sortable: true }),
    (0, reports_table_1.column)("originalYear", "سنة الأصل", "number"),
    (0, reports_table_1.column)("collectedAmount", "المحصَّل", "money", { sortable: true }),
    (0, reports_table_1.column)("paymentNumber", "الدفعة", "text"),
    (0, reports_table_1.column)("teacherShareAmount", "حصص الأساتذة", "money"),
];
exports.DEBT_COLLECTION_SORT = {
    allowed: {
        collectedAt: (dir) => ({ collectedAt: dir }),
        originalMonth: (dir) => [
            { originalYear: dir },
            { originalMonth: dir },
        ],
        collectedAmount: (dir) => ({ collectedAmount: dir }),
    },
    fallback: "collectedAt",
};
// --------------------------------------------------
// التخليص — §29
// --------------------------------------------------
exports.SETTLEMENT_COLUMNS = [
    (0, reports_table_1.column)("settlementNumber", "رقم التخليص", "text", { sortable: true }),
    (0, reports_table_1.column)("teacher", "الأستاذ", "text"),
    (0, reports_table_1.column)("subject", "المادة", "text"),
    (0, reports_table_1.column)("studyGroup", "الفوج", "text"),
    (0, reports_table_1.column)("sheetNumber", "الكشف", "number"),
    (0, reports_table_1.column)("method", "الطريقة", "status"),
    (0, reports_table_1.column)("studentCount", "الطلبة", "number"),
    (0, reports_table_1.column)("approvedSessions", "الحصص", "number"),
    (0, reports_table_1.column)("grossTuition", "إجمالي الرسوم", "money", { hiddenByDefault: true }),
    (0, reports_table_1.column)("collected", "المحصَّل", "money", { hiddenByDefault: true }),
    (0, reports_table_1.column)("teacherAmount", "المستحقّ", "money", { sortable: true }),
    (0, reports_table_1.column)("allocated", "المدفوع", "money"),
    (0, reports_table_1.column)("remaining", "المتبقّي", "money"),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
    (0, reports_table_1.column)("computedAt", "حُسب في", "date", { sortable: true }),
];
exports.SETTLEMENT_SORT = {
    allowed: {
        settlementNumber: (dir) => ({ settlementNumber: dir }),
        teacherAmount: (dir) => ({ teacherAmount: dir }),
        status: (dir) => ({ status: dir }),
        /*
         * `computedAt` عمودُ فرزٍ مشروع هنا خلافاً لقاعدة §58.
         *
         * الجدولُ **يُفلتر** بفترة الكشف، وهذا هو المهمّ. أمّا الفرزُ
         * فترتيبُ عرضٍ داخل نتيجةٍ مفلترةٍ سلفاً، و«أحدثُ ما حُسب»
         * سؤالٌ إداريّ مشروع. والعمودُ معنونٌ «حُسب في» لا «الفترة»
         * فلا يُخلط بينهما.
         */
        computedAt: (dir) => ({ computedAt: dir }),
    },
    fallback: "computedAt",
};
exports.SETTLEMENT_ROW_DRILL = { to: "/reports/settlements", idKey: "id" };
// --------------------------------------------------
// دفعات الأساتذة — §31
// --------------------------------------------------
exports.TEACHER_PAYMENT_COLUMNS = [
    (0, reports_table_1.column)("paymentNumber", "رقم الدفعة", "text", { sortable: true }),
    (0, reports_table_1.column)("teacher", "الأستاذ", "text"),
    (0, reports_table_1.column)("amount", "المبلغ", "money", { sortable: true }),
    (0, reports_table_1.column)("allocated", "المخصَّص", "money"),
    (0, reports_table_1.column)("unallocated", "بلا تخصيص", "money"),
    (0, reports_table_1.column)("allocationCount", "التخصيصات", "number"),
    (0, reports_table_1.column)("paymentMethod", "الطريقة", "status"),
    (0, reports_table_1.column)("paymentDate", "التاريخ", "date", { sortable: true }),
    (0, reports_table_1.column)("paidBy", "دفعها", "text", { hiddenByDefault: true }),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
];
exports.TEACHER_PAYMENT_SORT = {
    allowed: {
        paymentNumber: (dir) => ({ paymentNumber: dir }),
        amount: (dir) => ({ amount: dir }),
        paymentDate: (dir) => ({ paymentDate: dir }),
        status: (dir) => ({ status: dir }),
    },
    fallback: "paymentDate",
};
// --------------------------------------------------
// تخصيصات دفعات الأساتذة — §32
// --------------------------------------------------
exports.ALLOCATION_COLUMNS = [
    (0, reports_table_1.column)("paymentNumber", "رقم الدفعة", "text"),
    (0, reports_table_1.column)("teacher", "الأستاذ", "text"),
    (0, reports_table_1.column)("paymentDate", "تاريخ الدفع", "date"),
    (0, reports_table_1.column)("paymentTotal", "إجمالي الدفعة", "money"),
    (0, reports_table_1.column)("amount", "هذا الجزء", "money"),
    (0, reports_table_1.column)("targetLabel", "الوجهة", "text"),
    (0, reports_table_1.column)("targetPeriod", "الفترة", "text"),
    (0, reports_table_1.column)("targetKind", "النوع", "status"),
];
exports.ALLOCATION_SORT = {
    allowed: {
        /*
         * الفرزُ بتاريخ الدفع يمرّ بالدفعة: التخصيصُ لا يحمل تاريخاً،
         * فهو جزءٌ من دفعةٍ لا واقعةٌ مستقلّة.
         */
        paymentDate: (dir) => ({
            teacherPayment: { paymentDate: dir },
        }),
        amount: (dir) => ({ amount: dir }),
    },
    fallback: "paymentDate",
};
// --------------------------------------------------
// التدقيق — §37
// --------------------------------------------------
exports.AUDIT_COLUMNS = [
    (0, reports_table_1.column)("createdAt", "الوقت", "date", { sortable: true }),
    (0, reports_table_1.column)("user", "المستخدم", "text"),
    (0, reports_table_1.column)("entity", "الكيان", "text", { sortable: true }),
    (0, reports_table_1.column)("entityId", "المعرّف", "text", { hiddenByDefault: true }),
    (0, reports_table_1.column)("action", "الفعل", "status", { sortable: true }),
    (0, reports_table_1.column)("field", "الحقل", "text"),
    (0, reports_table_1.column)("oldValue", "القيمة السابقة", "text"),
    (0, reports_table_1.column)("newValue", "القيمة الجديدة", "text"),
    (0, reports_table_1.column)("reason", "السبب", "text"),
];
exports.AUDIT_SORT = {
    allowed: {
        createdAt: (dir) => ({ createdAt: dir }),
        entity: (dir) => ({ entity: dir }),
        action: (dir) => ({ action: dir }),
    },
    fallback: "createdAt",
};
// --------------------------------------------------
// الإلغاءات — §38
//
// بلا `SortSpec`: الصفوفُ تُدمج من خمسة مصادر وتُفرز في الذاكرة
// زمنياً. وإتاحةُ فرزٍ آخر تحتاج فرزَ القائمة المدموجة كلَّها —
// ممكنٌ لكنّه قرارٌ لم يُطلب، وإعلانُ عمودٍ قابلاً للفرز بلا
// تنفيذٍ أسوأُ من عمودٍ ثابت.
// --------------------------------------------------
exports.CANCELLATION_COLUMNS = [
    (0, reports_table_1.column)("cancelledAt", "وقت الإلغاء", "date"),
    (0, reports_table_1.column)("kindLabel", "النوع", "status"),
    (0, reports_table_1.column)("reference", "المرجع", "text"),
    (0, reports_table_1.column)("subject", "المعنيّ", "text"),
    (0, reports_table_1.column)("amount", "المبلغ", "money"),
    (0, reports_table_1.column)("cancelledBy", "ألغاه", "text"),
    (0, reports_table_1.column)("reason", "السبب", "text"),
];
// --------------------------------------------------
// جودة البيانات — §39
// --------------------------------------------------
exports.DATA_QUALITY_COLUMNS = [
    (0, reports_table_1.column)("label", "الفحص", "text"),
    (0, reports_table_1.column)("count", "العدد", "number"),
    (0, reports_table_1.column)("severity", "الخطورة", "status"),
    (0, reports_table_1.column)("description", "الوصف", "text"),
];
//# sourceMappingURL=reports.tables.finance.js.map