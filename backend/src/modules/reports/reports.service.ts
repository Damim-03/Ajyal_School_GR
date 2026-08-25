import { prisma } from "../../core/prisma/client";
import { ComparisonMode, yearMonthOf } from "../../core/reporting";
import { chart, metric, summaryOf, type ReportResponse } from "./reports.contract";
import { applyCapability, type ReportQuery } from "./reports.filters";
import { buildMeta, previousQuery, resolveSelection } from "./reports.meta";
import {
  assembleAttendanceChart,
  assembleAttendanceSummary,
  assembleCashFlowSummary,
  assembleDebtSummary,
  assembleFinancialSummary,
  assembleInvoiceStatusChart,
  assembleMonthlyFinancialChart,
  assemblePaymentMethodChart,
  assembleTeacherSummary,
} from "./reports.assemble";
import {
  aggregateDebtCollections,
  countStudentsInDebt,
  fetchAttendanceSnapshot,
  fetchFinancialSnapshot,
  fetchTeacherSnapshot,
} from "./reports.queries";
import { invoiceScope, resolvePeriod } from "./reports.scope";
import {
  fetchAttendanceRows,
  fetchStudentRows,
  fetchTeacherRows,
  studentCounts,
} from "./reports.rows";
import { buildTable, resolveSort } from "./reports.table";
import {
  ATTENDANCE_COLUMNS,
  ATTENDANCE_SORT,
  STUDENT_COLUMNS,
  STUDENT_ROW_DRILL,
  STUDENT_SORT,
  TEACHER_COLUMNS,
  TEACHER_ROW_DRILL,
  TEACHER_SORT,
} from "./reports.tables";

// ======================================================
// خدمةُ التقارير
//
// كلُّ تقريرٍ يمرّ بأربع خطواتٍ بهذا الترتيب:
//
//   1. تصفيةُ الفلاتر بقدرات التقرير   — §4
//   2. حلُّ الفترة وفترةِ المقارنة       — §34 §58
//   3. جلبٌ متوازٍ                       — §51
//   4. تجميعٌ نقيّ إلى المظروف الموحّد    — §57
//
// والخطوةُ الأولى قبل كلّ شيء: ما لا يدعمه التقريرُ لا يصل إلى
// استعلامٍ أصلاً، فلا يُقيّد نتيجةً بلا أن يُعلَن.
// ======================================================

const academicYearOf = async (id?: string) => {
  if (id) {
    return prisma.academicYear.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
  }

  /*
   * بلا سنةٍ مختارة تُستعمل الجارية.
   *
   * والسقوطُ إلى `null` مقبول: مؤسسةٌ لم تُنشئ سنةً بعد تعرض
   * تقاريرَ فارغةً بحالةٍ مفهومة، لا خطأً يُوهم بعطبٍ في النظام.
   */
  return prisma.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
};

/**
 * فترةُ المرجع لحساب «الدَّين القديم».
 *
 * الشهرُ المختار إن وُجد، وإلّا شهرُ نهاية المدى، وإلّا الشهرُ
 * الجاري. والترتيبُ مقصود: «قديم» تعني «أقدمُ ممّا أنظر إليه»، فإن
 * كنتُ أنظر إلى سبتمبر فدَينُ أغسطس قديمٌ ولو كنّا في ديسمبر.
 */
const referenceMonth = (query: Partial<ReportQuery>) => {
  const period = resolvePeriod(query);

  if (period.yearMonth) return period.yearMonth;
  if (period.range) return yearMonthOf(period.range.to);

  return yearMonthOf(new Date());
};

// ======================================================
// نظرةُ العموم — §5 §6
// ======================================================

export const overviewReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { filters } = applyCapability("overview", query);
  const selection = resolveSelection(
    "overview",
    filters,
    query.comparison as ComparisonMode | "none",
  );

  const academicYear = await academicYearOf(filters.academicYearId);
  const scoped = { ...filters, academicYearId: academicYear?.id };
  const reference = referenceMonth(scoped);
  const period = resolvePeriod(scoped);

  const previous = selection.previous
    ? previousQuery(scoped, selection)
    : undefined;

  /*
   * الفترتان تُجلبان معاً.
   *
   * تسلسلُهما كان سيضاعف زمنَ الشاشة الأولى بلا سبب — وهي الشاشةُ
   * التي يُقاس عليها انطباعُ المستخدم عن سرعة النظام كلِّه.
   */
  const [
    financial,
    teachers,
    attendanceCounts,
    debtCollections,
    studentsInDebt,
    previousFinancial,
    previousTeachers,
    previousAttendance,
  ] = await Promise.all([
    fetchFinancialSnapshot(scoped, reference),
    fetchTeacherSnapshot(scoped),
    fetchAttendanceSnapshot(scoped),
    aggregateDebtCollections(period.range),
    countStudentsInDebt(invoiceScope(scoped)),
    previous ? fetchFinancialSnapshot(previous, reference) : undefined,
    previous ? fetchTeacherSnapshot(previous) : undefined,
    previous ? fetchAttendanceSnapshot(previous) : undefined,
  ]);

  return {
    meta: buildMeta({ report: "overview", query, selection, academicYear }),
    summary: {
      ...assembleFinancialSummary({
        current: financial,
        previous: previousFinancial,
      }),
      ...assembleDebtSummary(financial, {
        studentsInDebt,
        collectedOld: debtCollections.collectedOld,
      }),
      ...assembleTeacherSummary(teachers, previousTeachers),
      ...assembleAttendanceSummary(attendanceCounts, previousAttendance),
      ...assembleCashFlowSummary({
        studentPayments: financial.payments.paymentTotal,
        debtCollections: debtCollections.collectedOld,
        teacherPayments: teachers.payments.teacherPaymentTotal,
      }),
    },
    charts: [
      assembleMonthlyFinancialChart(financial.byMonth),
      assembleInvoiceStatusChart(financial.byStatus),
      assembleAttendanceChart(attendanceCounts),
    ],
    /*
     * §5: نظرةُ العموم بلا جدول.
     *
     * غرضُها «صورةُ المؤسسة في ثوانٍ»، والجدولُ يجرّ القارئَ إلى
     * التفاصيل في الشاشة التي وُجدت لتفاديها. والتفاصيلُ خلف
     * التنقيب.
     */
    table: null,
  };
};

// ======================================================
// التقرير المالي — §20 §21
// ======================================================

export const financialReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { filters } = applyCapability("financial", query);
  const selection = resolveSelection(
    "financial",
    filters,
    query.comparison as ComparisonMode | "none",
  );

  const academicYear = await academicYearOf(filters.academicYearId);
  const scoped = { ...filters, academicYearId: academicYear?.id };
  const reference = referenceMonth(scoped);
  const period = resolvePeriod(scoped);

  const previous = selection.previous
    ? previousQuery(scoped, selection)
    : undefined;

  const [financial, debtCollections, studentsInDebt, previousFinancial] =
    await Promise.all([
      fetchFinancialSnapshot(scoped, reference),
      aggregateDebtCollections(period.range),
      countStudentsInDebt(invoiceScope(scoped)),
      previous ? fetchFinancialSnapshot(previous, reference) : undefined,
    ]);

  return {
    meta: buildMeta({ report: "financial", query, selection, academicYear }),
    summary: {
      ...assembleFinancialSummary({
        current: financial,
        previous: previousFinancial,
      }),
      ...assembleDebtSummary(financial, {
        studentsInDebt,
        collectedOld: debtCollections.collectedOld,
      }),
    },
    charts: [
      assembleMonthlyFinancialChart(financial.byMonth),
      assembleInvoiceStatusChart(financial.byStatus),
      assemblePaymentMethodChart(financial.methods),
    ],
    table: null,
  };
};

// ======================================================
// تقرير الطلبة — §8
// ======================================================

export const studentsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { filters } = applyCapability("students", query);
  const selection = resolveSelection(
    "students",
    filters,
    query.comparison as ComparisonMode | "none",
  );

  const academicYear = await academicYearOf(filters.academicYearId);
  const scoped = { ...filters, academicYearId: academicYear?.id };

  const request = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
  const sort = resolveSort(request, STUDENT_SORT);

  const [counts, table, attendanceCounts] = await Promise.all([
    studentCounts(scoped),
    fetchStudentRows(scoped, request, sort),
    fetchAttendanceSnapshot(scoped),
  ]);

  const genderChart = chart({
    key: "studentsByGender",
    title: "توزيع الطلبة بالجنس",
    kind: "donut",
    unit: "count",
    categories: counts.byGender.map((row) =>
      row.gender === "MALE" ? "ذكور" : "إناث",
    ),
    series: [
      {
        key: "count",
        label: "العدد",
        data: counts.byGender.map((row) => row._count),
      },
    ],
  });

  return {
    meta: buildMeta({ report: "students", query, selection, academicYear }),
    summary: {
      ...summaryOf([
        metric("totalStudents", counts.total),
        metric("activeStudents", counts.active),
        metric("inactiveStudents", counts.inactive),
        metric("activeRate", counts.activeRate),
        metric("studentsInDebt", counts.studentsInDebt),
      ]),
      ...assembleAttendanceSummary(attendanceCounts),
    },
    charts: [genderChart, assembleAttendanceChart(attendanceCounts)],
    table: buildTable({
      columns: STUDENT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
      rowDrill: STUDENT_ROW_DRILL,
    }),
  };
};

// ======================================================
// تقرير الحضور — §18 §19
// ======================================================

export const attendanceReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { filters } = applyCapability("attendance", query);
  const selection = resolveSelection(
    "attendance",
    filters,
    query.comparison as ComparisonMode | "none",
  );

  const academicYear = await academicYearOf(filters.academicYearId);
  const scoped = { ...filters, academicYearId: academicYear?.id };

  const request = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
  const sort = resolveSort(request, ATTENDANCE_SORT);

  const previous = selection.previous
    ? previousQuery(scoped, selection)
    : undefined;

  const [counts, table, previousCounts] = await Promise.all([
    fetchAttendanceSnapshot(scoped),
    fetchAttendanceRows(scoped, request, sort),
    previous ? fetchAttendanceSnapshot(previous) : undefined,
  ]);

  return {
    meta: buildMeta({ report: "attendance", query, selection, academicYear }),
    summary: assembleAttendanceSummary(counts, previousCounts),
    charts: [assembleAttendanceChart(counts)],
    table: buildTable({
      columns: ATTENDANCE_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// تقرير الأساتذة — §27
// ======================================================

export const teachersReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { filters } = applyCapability("teachers", query);
  const selection = resolveSelection(
    "teachers",
    filters,
    query.comparison as ComparisonMode | "none",
  );

  const academicYear = await academicYearOf(filters.academicYearId);
  const scoped = { ...filters, academicYearId: academicYear?.id };

  const request = {
    page: query.page,
    pageSize: query.pageSize,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
  };
  const sort = resolveSort(request, TEACHER_SORT);

  const previous = selection.previous
    ? previousQuery(scoped, selection)
    : undefined;

  const [teachers, table, previousTeachers] = await Promise.all([
    fetchTeacherSnapshot(scoped),
    fetchTeacherRows(scoped, request, sort),
    previous ? fetchTeacherSnapshot(previous) : undefined,
  ]);

  /*
   * ترتيبُ المستحقّين تنازلياً — من الصفحة المعروضة وحدها.
   *
   * وهذا قيدٌ يجب أن يُعرف: الرسمُ يعرض «أعلى مستحقّي هذه الصفحة»
   * لا أعلى المؤسسة، لأنّ المستحقّ محسوبٌ بعد الجلب من ثلاثة
   * مصادر فلا يُفرز في القاعدة. وعنوانُ الرسم يقول ذلك صراحةً بدل
   * أن يوهم بترتيبٍ شامل.
   */
  const ranked = [...table.rows].sort((a, b) => b.entitlement - a.entitlement);

  return {
    meta: buildMeta({ report: "teachers", query, selection, academicYear }),
    summary: assembleTeacherSummary(teachers, previousTeachers),
    charts: [
      chart({
        key: "entitlementByTeacher",
        title: "المستحقّ حسب الأستاذ (هذه الصفحة)",
        kind: "horizontalBar",
        unit: "money",
        categories: ranked.map((row) => row.name),
        series: [
          {
            key: "entitlement",
            label: "المستحقّ",
            data: ranked.map((row) => row.entitlement),
          },
          {
            key: "paid",
            label: "المدفوع",
            data: ranked.map((row) => row.paid),
          },
        ],
        drill: {
          to: "/reports/teachers",
          param: "teacherId",
          categoryIds: ranked.map((row) => row.id),
        },
      }),
    ],
    table: buildTable({
      columns: TEACHER_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
      rowDrill: TEACHER_ROW_DRILL,
    }),
  };
};
