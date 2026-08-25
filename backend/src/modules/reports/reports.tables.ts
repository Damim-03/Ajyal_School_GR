import { column } from "./reports.table";
import type { SortSpec } from "./reports.table";

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

export const STUDENT_COLUMNS = [
  column("studentNumber", "رقم الطالب", "text", { sortable: true }),
  column("name", "الاسم", "text", { sortable: true }),
  column("gender", "الجنس", "status"),
  column("enrollmentCount", "التسجيلات", "number"),
  column("attendanceRate", "نسبة الحضور", "percent"),
  column("invoiced", "المفوتر", "money"),
  column("paid", "المسدَّد", "money"),
  column("outstanding", "المتبقّي", "money"),
  column("isActive", "الحالة", "status"),
];

export const STUDENT_SORT: SortSpec = {
  allowed: {
    studentNumber: (dir: "asc" | "desc") => ({ studentNumber: dir }),
    /*
     * الفرزُ بالاسم على حقلين: اللقب ثمّ الاسم.
     *
     * والترتيبُ مقصود — القوائمُ الإدارية تُقرأ بالألقاب، ومن بحث
     * عن «بن عمر» يتوقّع كلَّ آل بن عمر متجاورين.
     */
    name: (dir: "asc" | "desc") => [{ lastName: dir }, { firstName: dir }],
    createdAt: (dir: "asc" | "desc") => ({ createdAt: dir }),
  },
  fallback: "name",
};

export const STUDENT_ROW_DRILL = { to: "/reports/students", idKey: "id" };

// --------------------------------------------------
// الحضور — §19
// --------------------------------------------------

export const ATTENDANCE_COLUMNS = [
  column("sessionDate", "التاريخ", "date", { sortable: true }),
  column("studentName", "الطالب", "text"),
  column("subject", "المادة", "text"),
  column("teacher", "الأستاذ", "text"),
  column("studyGroup", "الفوج", "text"),
  column("lessonNumber", "رقم الحصّة", "number"),
  column("status", "الحالة", "status", { sortable: true }),
  column("note", "ملاحظة", "text", { hiddenByDefault: true }),
];

export const ATTENDANCE_SORT: SortSpec = {
  allowed: {
    /*
     * الفرزُ بالتاريخ يمرّ بالحصّة: سجلُّ الحضور لا يحمل تاريخاً،
     * و`createdAt` فيه لحظةُ التدوين لا يومُ الحصّة (§58).
     */
    sessionDate: (dir: "asc" | "desc") => ({ session: { sessionDate: dir } }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
  },
  fallback: "sessionDate",
};

// --------------------------------------------------
// الأساتذة — §27
// --------------------------------------------------

export const TEACHER_COLUMNS = [
  column("name", "الأستاذ", "text", { sortable: true }),
  column("assignmentCount", "الإسنادات", "number"),
  column("studentCount", "الطلبة", "number"),
  column("entitlement", "المستحقّ", "money"),
  column("paid", "المدفوع", "money"),
  column("outstanding", "المتبقّي", "money"),
];

export const TEACHER_SORT: SortSpec = {
  allowed: {
    name: (dir: "asc" | "desc") => [{ lastName: dir }, { firstName: dir }],
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

export const TEACHER_ROW_DRILL = { to: "/reports/teachers", idKey: "id" };
