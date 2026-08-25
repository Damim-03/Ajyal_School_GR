"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TEACHER_ROW_DRILL = exports.TEACHER_SORT = exports.TEACHER_COLUMNS = exports.ATTENDANCE_SORT = exports.ATTENDANCE_COLUMNS = exports.STUDENT_ROW_DRILL = exports.STUDENT_SORT = exports.STUDENT_COLUMNS = void 0;
const reports_table_1 = require("./reports.table");
// ======================================================
// تعريفاتُ الجداول — الأعمدة وقوائم الفرز البيضاء
//
// مفصولةٌ عن جلب الصفوف عمداً: العمودُ الذي يُعرض والحقلُ الذي
// يجوز الفرز به قراران عرضيّان يُراجَعان معاً، لا يُبعثران بين
// استعلاماتٍ طويلة.
//
// وكلُّ `allowed` هنا حاجزٌ أمني (§67): ما ليس في القائمة لا يصل
// إلى Prisma. فالعميلُ لا يفرز بحقلٍ لا يُعرض، ولا يُسقط الاستعلامَ
// بحقلٍ لا وجود له.
// ======================================================
// --------------------------------------------------
// الطلبة — §8
// --------------------------------------------------
exports.STUDENT_COLUMNS = [
    (0, reports_table_1.column)("studentNumber", "رقم الطالب", "text", { sortable: true }),
    (0, reports_table_1.column)("name", "الاسم", "text", { sortable: true }),
    (0, reports_table_1.column)("gender", "الجنس", "status"),
    (0, reports_table_1.column)("enrollmentCount", "التسجيلات", "number"),
    (0, reports_table_1.column)("attendanceRate", "نسبة الحضور", "percent"),
    (0, reports_table_1.column)("invoiced", "المفوتر", "money"),
    (0, reports_table_1.column)("paid", "المسدَّد", "money"),
    (0, reports_table_1.column)("outstanding", "المتبقّي", "money"),
    (0, reports_table_1.column)("isActive", "الحالة", "status"),
];
exports.STUDENT_SORT = {
    allowed: {
        studentNumber: (dir) => ({ studentNumber: dir }),
        /*
         * الفرزُ بالاسم على حقلين: اللقب ثمّ الاسم.
         *
         * والترتيبُ مقصود — القوائمُ الإدارية تُقرأ بالألقاب، ومن بحث
         * عن «بن عمر» يتوقّع كلَّ آل بن عمر متجاورين.
         */
        name: (dir) => [{ lastName: dir }, { firstName: dir }],
        createdAt: (dir) => ({ createdAt: dir }),
    },
    fallback: "name",
};
exports.STUDENT_ROW_DRILL = { to: "/reports/students", idKey: "id" };
// --------------------------------------------------
// الحضور — §19
// --------------------------------------------------
exports.ATTENDANCE_COLUMNS = [
    (0, reports_table_1.column)("sessionDate", "التاريخ", "date", { sortable: true }),
    (0, reports_table_1.column)("studentName", "الطالب", "text"),
    (0, reports_table_1.column)("subject", "المادة", "text"),
    (0, reports_table_1.column)("teacher", "الأستاذ", "text"),
    (0, reports_table_1.column)("studyGroup", "الفوج", "text"),
    (0, reports_table_1.column)("lessonNumber", "رقم الحصّة", "number"),
    (0, reports_table_1.column)("status", "الحالة", "status", { sortable: true }),
    (0, reports_table_1.column)("note", "ملاحظة", "text", { hiddenByDefault: true }),
];
exports.ATTENDANCE_SORT = {
    allowed: {
        /*
         * الفرزُ بالتاريخ يمرّ بالحصّة: سجلُّ الحضور لا يحمل تاريخاً،
         * و`createdAt` فيه لحظةُ التدوين لا يومُ الحصّة (§58).
         */
        sessionDate: (dir) => ({ session: { sessionDate: dir } }),
        status: (dir) => ({ status: dir }),
    },
    fallback: "sessionDate",
};
// --------------------------------------------------
// الأساتذة — §27
// --------------------------------------------------
exports.TEACHER_COLUMNS = [
    (0, reports_table_1.column)("name", "الأستاذ", "text", { sortable: true }),
    (0, reports_table_1.column)("assignmentCount", "الإسنادات", "number"),
    (0, reports_table_1.column)("studentCount", "الطلبة", "number"),
    (0, reports_table_1.column)("entitlement", "المستحقّ", "money"),
    (0, reports_table_1.column)("paid", "المدفوع", "money"),
    (0, reports_table_1.column)("outstanding", "المتبقّي", "money"),
];
exports.TEACHER_SORT = {
    allowed: {
        name: (dir) => [{ lastName: dir }, { firstName: dir }],
    },
    /*
     * لا فرزَ بالمستحقّ ولا بالمدفوع — وهذا نقصٌ معروف لا سهو.
     *
     * الرقمان محسوبان بعد الجلب من ثلاثة مصادر (تخليص + حصص دَين −
     * تخصيصات)، ولا يقابلهما عمودٌ في جدولٍ واحد يُفرز به. وفرزُهما
     * يحتاج إمّا عرضاً مادّياً (materialized view) أو استعلاماً خامّاً
     * — وكلاهما قرارٌ يُتّخذ لا يُهرَّب في هذا الملف.
     *
     * فالأعمدةُ أُعلنت غيرَ قابلةٍ للفرز صراحةً، والواجهةُ تعطّل
     * رأسَها. أوضحُ من فرزٍ يعمل على الصفحة وحدها فيكذب.
     */
    fallback: "name",
};
exports.TEACHER_ROW_DRILL = { to: "/reports/teachers", idKey: "id" };
//# sourceMappingURL=reports.tables.js.map