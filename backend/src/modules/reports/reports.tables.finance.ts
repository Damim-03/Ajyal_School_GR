import { column } from "./reports.table";
import type { SortSpec } from "./reports.table";

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

export const INVOICE_COLUMNS = [
  column("invoiceNumber", "رقم الفاتورة", "text", { sortable: true }),
  column("studentName", "الطالب", "text"),
  column("subject", "المادة", "text"),
  column("studyGroup", "الفوج", "text"),
  column("month", "الشهر", "number", { sortable: true }),
  column("year", "السنة", "number"),
  column("amount", "المبلغ", "money"),
  column("discount", "الحسم", "money", { hiddenByDefault: true }),
  column("total", "الإجمالي", "money", { sortable: true }),
  column("paid", "المسدَّد", "money"),
  column("remaining", "المتبقّي", "money", { sortable: true }),
  column("status", "الحالة", "status", { sortable: true }),
  column("dueDate", "الاستحقاق", "date", { sortable: true }),
];

export const INVOICE_SORT: SortSpec = {
  allowed: {
    invoiceNumber: (dir: "asc" | "desc") => ({ invoiceNumber: dir }),
    /*
     * الفرزُ بالشهر مركّبٌ على (سنة، شهر) لا على الشهر وحده.
     *
     * وإلّا تجاور سبتمبر 2025 وسبتمبر 2026 في القائمة — ترتيبٌ
     * يبدو صحيحاً داخل سنةٍ واحدة ويختلط عبر السنوات، وهو أخبثُ
     * من ترتيبٍ خاطئ ظاهرٍ للعين.
     */
    month: (dir: "asc" | "desc") => [{ year: dir }, { month: dir }],
    total: (dir: "asc" | "desc") => ({ total: dir }),
    remaining: (dir: "asc" | "desc") => ({ remaining: dir }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
    dueDate: (dir: "asc" | "desc") => ({ dueDate: dir }),
  },
  fallback: "dueDate",
};

// --------------------------------------------------
// الدفعات — §23
// --------------------------------------------------

export const PAYMENT_COLUMNS = [
  column("paymentNumber", "رقم الدفعة", "text", { sortable: true }),
  column("students", "الطالب/الطلبة", "text"),
  column("amount", "المبلغ", "money", { sortable: true }),
  column("paymentMethod", "الطريقة", "status"),
  column("paymentDate", "التاريخ", "date", { sortable: true }),
  column("invoiceCount", "الفواتير", "number"),
  column("receiptNumber", "الإيصال", "text"),
  column("receivedBy", "استلمها", "text", { hiddenByDefault: true }),
  column("status", "الحالة", "status", { sortable: true }),
];

export const PAYMENT_SORT: SortSpec = {
  allowed: {
    paymentNumber: (dir: "asc" | "desc") => ({ paymentNumber: dir }),
    amount: (dir: "asc" | "desc") => ({ amount: dir }),
    paymentDate: (dir: "asc" | "desc") => ({ paymentDate: dir }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
  },
  fallback: "paymentDate",
};

// --------------------------------------------------
// الإيصالات — §24
// --------------------------------------------------

export const RECEIPT_COLUMNS = [
  column("receiptNumber", "رقم الإيصال", "text", { sortable: true }),
  column("paymentNumber", "الدفعة", "text"),
  column("studentName", "الطالب", "text"),
  column("amount", "المبلغ", "money"),
  column("status", "الحالة", "status", { sortable: true }),
  column("printed", "طُبع", "status"),
  column("printedAt", "تاريخ الطبع", "date", { sortable: true }),
  column("printedBy", "طبعه", "text", { hiddenByDefault: true }),
  column("cancelledAt", "تاريخ الإلغاء", "date", { hiddenByDefault: true }),
];

export const RECEIPT_SORT: SortSpec = {
  allowed: {
    receiptNumber: (dir: "asc" | "desc") => ({ receiptNumber: dir }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
    printedAt: (dir: "asc" | "desc") => ({ printedAt: dir }),
    createdAt: (dir: "asc" | "desc") => ({ createdAt: dir }),
  },
  fallback: "createdAt",
};

// --------------------------------------------------
// الديون — §25
// --------------------------------------------------

export const DEBT_COLUMNS = [
  column("studentName", "الطالب", "text"),
  column("invoiceNumber", "الفاتورة", "text"),
  column("subject", "المادة", "text"),
  column("originalMonth", "شهر الأصل", "number", { sortable: true }),
  column("originalYear", "سنة الأصل", "number"),
  column("total", "الإجمالي", "money"),
  column("paid", "المسدَّد", "money"),
  column("remaining", "المتبقّي", "money", { sortable: true }),
  column("ageInMonths", "العمر بالأشهر", "number"),
  column("ageBucket", "الشريحة", "status"),
];

export const DEBT_SORT: SortSpec = {
  allowed: {
    originalMonth: (dir: "asc" | "desc") => [{ year: dir }, { month: dir }],
    remaining: (dir: "asc" | "desc") => ({ remaining: dir }),
  },
  fallback: "originalMonth",
};

// --------------------------------------------------
// تحصيل الديون — §26
// --------------------------------------------------

export const DEBT_COLLECTION_COLUMNS = [
  column("collectedAt", "تاريخ التحصيل", "date", { sortable: true }),
  column("studentName", "الطالب", "text"),
  column("invoiceNumber", "الفاتورة الأصلية", "text"),
  column("originalMonth", "شهر الأصل", "number", { sortable: true }),
  column("originalYear", "سنة الأصل", "number"),
  column("collectedAmount", "المحصَّل", "money", { sortable: true }),
  column("paymentNumber", "الدفعة", "text"),
  column("teacherShareAmount", "حصص الأساتذة", "money"),
];

export const DEBT_COLLECTION_SORT: SortSpec = {
  allowed: {
    collectedAt: (dir: "asc" | "desc") => ({ collectedAt: dir }),
    originalMonth: (dir: "asc" | "desc") => [
      { originalYear: dir },
      { originalMonth: dir },
    ],
    collectedAmount: (dir: "asc" | "desc") => ({ collectedAmount: dir }),
  },
  fallback: "collectedAt",
};

// --------------------------------------------------
// التخليص — §29
// --------------------------------------------------

export const SETTLEMENT_COLUMNS = [
  column("settlementNumber", "رقم التخليص", "text", { sortable: true }),
  column("teacher", "الأستاذ", "text"),
  column("subject", "المادة", "text"),
  column("studyGroup", "الفوج", "text"),
  column("sheetNumber", "الكشف", "number"),
  column("method", "الطريقة", "status"),
  column("studentCount", "الطلبة", "number"),
  column("approvedSessions", "الحصص", "number"),
  column("grossTuition", "إجمالي الرسوم", "money", { hiddenByDefault: true }),
  column("collected", "المحصَّل", "money", { hiddenByDefault: true }),
  column("teacherAmount", "المستحقّ", "money", { sortable: true }),
  column("allocated", "المدفوع", "money"),
  column("remaining", "المتبقّي", "money"),
  column("status", "الحالة", "status", { sortable: true }),
  column("computedAt", "حُسب في", "date", { sortable: true }),
];

export const SETTLEMENT_SORT: SortSpec = {
  allowed: {
    settlementNumber: (dir: "asc" | "desc") => ({ settlementNumber: dir }),
    teacherAmount: (dir: "asc" | "desc") => ({ teacherAmount: dir }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
    /*
     * `computedAt` عمودُ فرزٍ مشروع هنا خلافاً لقاعدة §58.
     *
     * الجدولُ **يُفلتر** بفترة الكشف، وهذا هو المهمّ. أمّا الفرزُ
     * فترتيبُ عرضٍ داخل نتيجةٍ مفلترةٍ سلفاً، و«أحدثُ ما حُسب»
     * سؤالٌ إداريّ مشروع. والعمودُ معنونٌ «حُسب في» لا «الفترة»
     * فلا يُخلط بينهما.
     */
    computedAt: (dir: "asc" | "desc") => ({ computedAt: dir }),
  },
  fallback: "computedAt",
};

export const SETTLEMENT_ROW_DRILL = { to: "/reports/settlements", idKey: "id" };

// --------------------------------------------------
// دفعات الأساتذة — §31
// --------------------------------------------------

export const TEACHER_PAYMENT_COLUMNS = [
  column("paymentNumber", "رقم الدفعة", "text", { sortable: true }),
  column("teacher", "الأستاذ", "text"),
  column("amount", "المبلغ", "money", { sortable: true }),
  column("allocated", "المخصَّص", "money"),
  column("unallocated", "بلا تخصيص", "money"),
  column("allocationCount", "التخصيصات", "number"),
  column("paymentMethod", "الطريقة", "status"),
  column("paymentDate", "التاريخ", "date", { sortable: true }),
  column("paidBy", "دفعها", "text", { hiddenByDefault: true }),
  column("status", "الحالة", "status", { sortable: true }),
];

export const TEACHER_PAYMENT_SORT: SortSpec = {
  allowed: {
    paymentNumber: (dir: "asc" | "desc") => ({ paymentNumber: dir }),
    amount: (dir: "asc" | "desc") => ({ amount: dir }),
    paymentDate: (dir: "asc" | "desc") => ({ paymentDate: dir }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
  },
  fallback: "paymentDate",
};

// --------------------------------------------------
// تخصيصات دفعات الأساتذة — §32
// --------------------------------------------------

export const ALLOCATION_COLUMNS = [
  column("paymentNumber", "رقم الدفعة", "text"),
  column("teacher", "الأستاذ", "text"),
  column("paymentDate", "تاريخ الدفع", "date"),
  column("paymentTotal", "إجمالي الدفعة", "money"),
  column("amount", "هذا الجزء", "money"),
  column("targetLabel", "الوجهة", "text"),
  column("targetPeriod", "الفترة", "text"),
  column("targetKind", "النوع", "status"),
];

export const ALLOCATION_SORT: SortSpec = {
  allowed: {
    /*
     * الفرزُ بتاريخ الدفع يمرّ بالدفعة: التخصيصُ لا يحمل تاريخاً،
     * فهو جزءٌ من دفعةٍ لا واقعةٌ مستقلّة.
     */
    paymentDate: (dir: "asc" | "desc") => ({
      teacherPayment: { paymentDate: dir },
    }),
    amount: (dir: "asc" | "desc") => ({ amount: dir }),
  },
  fallback: "paymentDate",
};

// --------------------------------------------------
// التدقيق — §37
// --------------------------------------------------

export const AUDIT_COLUMNS = [
  column("createdAt", "الوقت", "date", { sortable: true }),
  column("user", "المستخدم", "text"),
  column("entity", "الكيان", "text", { sortable: true }),
  column("entityId", "المعرّف", "text", { hiddenByDefault: true }),
  column("action", "الفعل", "status", { sortable: true }),
  column("field", "الحقل", "text"),
  column("oldValue", "القيمة السابقة", "text"),
  column("newValue", "القيمة الجديدة", "text"),
  column("reason", "السبب", "text"),
];

export const AUDIT_SORT: SortSpec = {
  allowed: {
    createdAt: (dir: "asc" | "desc") => ({ createdAt: dir }),
    entity: (dir: "asc" | "desc") => ({ entity: dir }),
    action: (dir: "asc" | "desc") => ({ action: dir }),
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

export const CANCELLATION_COLUMNS = [
  column("cancelledAt", "وقت الإلغاء", "date"),
  column("kindLabel", "النوع", "status"),
  column("reference", "المرجع", "text"),
  column("subject", "المعنيّ", "text"),
  column("amount", "المبلغ", "money"),
  column("cancelledBy", "ألغاه", "text"),
  column("reason", "السبب", "text"),
];

// --------------------------------------------------
// جودة البيانات — §39
// --------------------------------------------------

export const DATA_QUALITY_COLUMNS = [
  column("label", "الفحص", "text"),
  column("count", "العدد", "number"),
  column("severity", "الخطورة", "status"),
  column("description", "الوصف", "text"),
];
