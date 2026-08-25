import { prisma } from "../../core/prisma/client";
import { ComparisonMode, toNumber } from "../../core/reporting";
import {
  chart,
  metric,
  summaryOf,
  type ReportChart,
  type ReportResponse,
} from "./reports.contract";
import { applyCapability, type ReportQuery } from "./reports.filters";
import { buildMeta, resolveSelection } from "./reports.meta";
import { assembleAttendanceSummary } from "./reports.assemble";
import {
  aggregateAcademic,
  fetchSessionRows,
  sessionCounts,
  type AcademicBucket,
  type AcademicDimension,
} from "./reports.academic";
import {
  fetchSettlementDetail,
  fetchStudentDetail,
  fetchTeacherDetail,
} from "./reports.detail";
import { buildTable, column, resolveSort, type TableRequest } from "./reports.table";
import { mergeAttendanceCounts } from "../../core/reporting";
import type { SortSpec } from "./reports.table";

// ======================================================
// خدماتُ التقارير الأكاديمية والتفصيلية — §9 §11–§17 §28 §30
// ======================================================

const academicYearOf = async (id?: string) => {
  if (id) {
    return prisma.academicYear.findUnique({
      where: { id },
      select: { id: true, name: true },
    });
  }

  return prisma.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });
};

const tableRequest = (query: ReportQuery): TableRequest => ({
  page: query.page,
  pageSize: query.pageSize,
  sortBy: query.sortBy,
  sortDir: query.sortDir,
});

const prepare = async (reportKey: string, query: ReportQuery) => {
  const { filters } = applyCapability(reportKey, query);
  const selection = resolveSelection(
    reportKey,
    filters,
    query.comparison as ComparisonMode | "none",
  );
  const academicYear = await academicYearOf(filters.academicYearId);

  return {
    selection,
    academicYear,
    scoped: { ...filters, academicYearId: academicYear?.id },
    request: tableRequest(query),
  };
};

// ======================================================
// التقاريرُ الأكاديمية — بُعدٌ واحد بخمس وجوه
// ======================================================

const ACADEMIC_COLUMNS = [
  column("name", "الاسم", "text"),
  column("context", "السياق", "text"),
  column("students", "الطلبة", "number"),
  column("assignments", "الإسنادات", "number"),
  column("sessions", "الحصص", "number"),
  column("attendanceRate", "نسبة الحضور", "percent"),
  column("invoiced", "المفوتر", "money"),
  column("collected", "المحصَّل", "money"),
  column("outstanding", "المتبقّي", "money"),
];

const DIMENSION_TITLE: Record<AcademicDimension, string> = {
  educationStage: "الأطوار التعليمية",
  level: "المستويات",
  subject: "المواد",
  studyGroup: "الأفواج",
  teachingAssignment: "الإسنادات التدريسية",
};

const DIMENSION_PARAM: Record<AcademicDimension, string> = {
  educationStage: "educationStageId",
  level: "levelId",
  subject: "subjectId",
  studyGroup: "studyGroupId",
  teachingAssignment: "subjectId",
};

/**
 * فرزٌ في الذاكرة لا في القاعدة.
 *
 * الصفوفُ هنا مبنيّةٌ من طيّ خمسة استعلامات، فلا يقابلها عمودٌ
 * يُفرز به. والفرزُ على القائمة المطويّة كاملةً لا على صفحةٍ منها،
 * فهو صادقٌ خلافاً لفرز صفحة.
 *
 * والقائمةُ البيضاء تُطبَّق هنا أيضاً: `sortBy` مجهولٌ يسقط إلى
 * `students` بدل أن يُقرأ حقلاً غير موجود.
 */
const ACADEMIC_SORT_KEYS = [
  "name",
  "students",
  "assignments",
  "sessions",
  "attendanceRate",
  "invoiced",
  "collected",
  "outstanding",
] as const;

const sortBuckets = (
  buckets: AcademicBucket[],
  sortBy: string | undefined,
  direction: "asc" | "desc",
): AcademicBucket[] => {
  const key = (ACADEMIC_SORT_KEYS as readonly string[]).includes(sortBy ?? "")
    ? (sortBy as (typeof ACADEMIC_SORT_KEYS)[number])
    : "students";

  const sign = direction === "asc" ? 1 : -1;

  return [...buckets].sort((a, b) => {
    const left = a[key];
    const right = b[key];

    if (typeof left === "string" || typeof right === "string") {
      return sign * String(left ?? "").localeCompare(String(right ?? ""), "ar");
    }

    /*
     * `null` يُدفع إلى الآخر دائماً بصرف النظر عن الاتجاه.
     *
     * فوجٌ بلا سجلّاتِ حضورٍ نسبتُه `null` لا صفر (§48). ولو
     * عُومل صفراً لتصدّر ترتيبَ «الأسوأ حضوراً» فوجٌ لم يبدأ
     * الدراسة — تنبيهٌ كاذبٌ في قائمةٍ تُقرأ لاتّخاذ قرار.
     */
    if (left === null) return 1;
    if (right === null) return -1;

    return sign * ((right as number) - (left as number));
  });
};

const academicChart = (
  dimension: AcademicDimension,
  buckets: AcademicBucket[],
): ReportChart[] => {
  const top = buckets.slice(0, 12);

  return [
    chart({
      key: `${dimension}Students`,
      title: `الطلبة حسب ${DIMENSION_TITLE[dimension]}`,
      kind: "horizontalBar",
      unit: "count",
      categories: top.map((row) => row.name),
      series: [
        {
          key: "students",
          label: "الطلبة",
          data: top.map((row) => row.students),
        },
      ],
      drill: {
        to: "/reports/students",
        param: DIMENSION_PARAM[dimension],
        categoryIds: top.map((row) => row.id),
      },
    }),
    chart({
      key: `${dimension}Revenue`,
      title: `الإيراد حسب ${DIMENSION_TITLE[dimension]}`,
      kind: "horizontalBar",
      unit: "money",
      categories: top.map((row) => row.name),
      series: [
        {
          key: "collected",
          label: "المحصَّل",
          data: top.map((row) => row.collected),
        },
        {
          key: "outstanding",
          label: "المتبقّي",
          data: top.map((row) => row.outstanding),
        },
      ],
      drill: {
        to: "/reports/financial",
        param: DIMENSION_PARAM[dimension],
        categoryIds: top.map((row) => row.id),
      },
    }),
    chart({
      key: `${dimension}Attendance`,
      title: `نسبة الحضور حسب ${DIMENSION_TITLE[dimension]}`,
      kind: "horizontalBar",
      unit: "percent",
      categories: top.map((row) => row.name),
      series: [
        {
          key: "rate",
          label: "نسبة الحضور",
          data: top.map((row) => row.attendanceRate),
        },
      ],
      drill: {
        to: "/reports/attendance",
        param: DIMENSION_PARAM[dimension],
        categoryIds: top.map((row) => row.id),
      },
    }),
  ];
};

const academicService =
  (reportKey: string, dimension: AcademicDimension) =>
  async (query: ReportQuery): Promise<ReportResponse> => {
    const { selection, academicYear, scoped, request } = await prepare(
      reportKey,
      query,
    );

    const buckets = await aggregateAcademic(scoped, dimension);
    const sorted = sortBuckets(buckets, query.sortBy, query.sortDir);

    /*
     * الترقيمُ بعد الطيّ والفرز.
     *
     * الأبعادُ قليلةٌ بطبيعتها — ثلاثةُ أطوار، عشرةُ مستويات،
     * عشراتُ الأفواج. فالجلبُ الكامل ثمّ التقطيع أرخصُ من محاولة
     * ترقيمٍ خادميّ على تجميعٍ لا يقابله جدول.
     */
    const start = (request.page - 1) * request.pageSize;
    const page = sorted.slice(start, start + request.pageSize);

    const totals = buckets.reduce(
      (sum, bucket) => ({
        students: sum.students + bucket.students,
        sessions: sum.sessions + bucket.sessions,
        invoiced: sum.invoiced + bucket.invoiced,
        collected: sum.collected + bucket.collected,
        outstanding: sum.outstanding + bucket.outstanding,
      }),
      { students: 0, sessions: 0, invoiced: 0, collected: 0, outstanding: 0 },
    );

    const attendance = mergeAttendanceCounts(
      buckets.map((bucket) => bucket.attendance),
    );

    return {
      meta: buildMeta({ report: reportKey, query, selection, academicYear }),
      summary: {
        ...summaryOf([
          metric(`${dimension}Count`, buckets.length),
          /*
           * مجموعُ الطلبة عبر الأبعاد **قد يفوق** عددَ طلبة
           * المؤسسة: طالبٌ في موادَّ من مستويين يُعدّ في كليهما.
           *
           * والاسمُ يقول ذلك — «مجموع الطلبة عبر الفئات» لا «عدد
           * الطلبة» — لئلّا يُقرأ الرقمُ عدداً للأشخاص فيناقض
           * تقريرَ الطلبة.
           */
          metric("studentsAcrossBuckets", totals.students),
          metric("sessionCount", totals.sessions),
          metric("invoiced", totals.invoiced),
          metric("collected", totals.collected),
          metric("outstanding", totals.outstanding),
        ]),
        ...assembleAttendanceSummary(attendance),
      },
      charts: academicChart(dimension, sorted),
      table: buildTable({
        columns: ACADEMIC_COLUMNS,
        rows: page,
        total: buckets.length,
        request,
        sort: {
          key: (ACADEMIC_SORT_KEYS as readonly string[]).includes(
            query.sortBy ?? "",
          )
            ? query.sortBy!
            : "students",
          direction: query.sortDir,
          orderBy: {},
        },
      }),
    };
  };

export const stagesReportService = academicService("stages", "educationStage");
export const levelsReportService = academicService("levels", "level");
export const subjectsReportService = academicService("subjects", "subject");
export const groupsReportService = academicService("groups", "studyGroup");
export const assignmentsReportService = academicService(
  "assignments",
  "teachingAssignment",
);

/**
 * التقريرُ الأكاديمي الجامع — §11.
 *
 * لا يكرّر الأبعاد الخمسة في استجابةٍ واحدة: ذلك يجلب كلَّ شيءٍ
 * خمسَ مرّات لشاشةٍ تعرض ملخّصاً. يعطي أعلى مستوى (الأطوار) ومنه
 * يُنقَّب إلى ما تحته.
 */
export const academicReportService = academicService(
  "academic",
  "educationStage",
);

// ======================================================
// الحصص — §17
// ======================================================

const SESSION_COLUMNS = [
  column("sessionDate", "التاريخ", "date", { sortable: true }),
  column("lessonNumber", "رقم الحصّة", "number", { sortable: true }),
  column("subject", "المادة", "text"),
  column("teacher", "الأستاذ", "text"),
  column("studyGroup", "الفوج", "text"),
  column("status", "الحالة", "status", { sortable: true }),
  column("attendanceRecorded", "حضور مسجَّل", "number"),
  column("enrolledStudents", "الطلبة المسجَّلون", "number"),
  column("note", "ملاحظة", "text", { hiddenByDefault: true }),
];

const SESSION_SORT: SortSpec = {
  allowed: {
    sessionDate: (dir: "asc" | "desc") => ({ sessionDate: dir }),
    lessonNumber: (dir: "asc" | "desc") => ({ lessonNumber: dir }),
    status: (dir: "asc" | "desc") => ({ status: dir }),
  },
  fallback: "sessionDate",
};

export const sessionsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "sessions",
    query,
  );
  const sort = resolveSort(request, SESSION_SORT);

  const [counts, table] = await Promise.all([
    sessionCounts(scoped),
    fetchSessionRows(scoped, request, sort),
  ]);

  return {
    meta: buildMeta({ report: "sessions", query, selection, academicYear }),
    summary: summaryOf([
      metric("sessionCount", counts.total),
      metric("scheduledSessions", counts.scheduled),
      metric("completedSessions", counts.completed),
      metric("cancelledSessions", counts.cancelled),
      metric("sessionsWithAttendance", counts.withAttendance),
      /* §17: وجودُ الحصّة لا يساوي تسجيلَ حضورها */
      metric("sessionsWithoutAttendance", counts.withoutAttendance),
    ]),
    charts: [
      chart({
        key: "sessionStatus",
        title: "حالات الحصص",
        kind: "donut",
        unit: "count",
        categories: ["مجدولة", "مكتملة", "ملغاة"],
        series: [
          {
            key: "count",
            label: "العدد",
            data: [counts.scheduled, counts.completed, counts.cancelled],
          },
        ],
      }),
    ],
    table: buildTable({
      columns: SESSION_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// تقاريرُ التفصيل — §9 §28 §30
// ======================================================

export const studentDetailReportService = async (
  studentId: string,
  query: ReportQuery,
): Promise<ReportResponse | null> => {
  const { selection, academicYear } = await prepare("students", query);

  const result = await fetchStudentDetail(studentId, academicYear?.id);

  if (!result) return null;

  return {
    meta: buildMeta({ report: "students", query, selection, academicYear }),
    summary: {
      ...summaryOf([
        metric("invoiced", result.financial.invoiced),
        metric("collected", result.financial.paid),
        metric("outstanding", result.financial.remaining),
      ]),
      ...assembleAttendanceSummary(result.attendanceCounts),
    },
    charts: [
      chart({
        key: "studentAttendance",
        title: "توزيع الحضور",
        kind: "donut",
        unit: "count",
        categories: ["حاضر", "غائب", "متأخّر", "معذور"],
        series: [
          {
            key: "count",
            label: "العدد",
            data: [
              result.attendanceCounts.PRESENT,
              result.attendanceCounts.ABSENT,
              result.attendanceCounts.LATE,
              result.attendanceCounts.EXCUSED,
            ],
          },
        ],
      }),
    ],
    table: null,
    detail: result.detail,
  };
};

export const teacherDetailReportService = async (
  teacherId: string,
  query: ReportQuery,
): Promise<ReportResponse | null> => {
  const { selection, academicYear } = await prepare("teachers", query);

  const result = await fetchTeacherDetail(teacherId, academicYear?.id);

  if (!result) return null;

  return {
    meta: buildMeta({ report: "teachers", query, selection, academicYear }),
    summary: summaryOf([
      metric("teacherEntitlement", result.entitlement),
      metric("teacherPaid", result.paid),
      metric("teacherOutstanding", result.entitlement - result.paid),
    ]),
    charts: [],
    table: null,
    detail: result.detail,
  };
};

export const settlementDetailReportService = async (
  settlementId: string,
  query: ReportQuery,
): Promise<ReportResponse | null> => {
  const { selection, academicYear } = await prepare("settlements", query);

  const result = await fetchSettlementDetail(settlementId);

  if (!result) return null;

  return {
    meta: buildMeta({ report: "settlements", query, selection, academicYear }),
    summary: summaryOf([
      metric("teacherEntitlement", result.teacherAmount),
    ]),
    charts: [],
    table: null,
    detail: result.detail,
  };
};

export { toNumber };
