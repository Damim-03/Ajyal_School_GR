import { prisma } from "../../core/prisma/client";
import {
  ComparisonMode,
  DEBT_AGE_BUCKETS,
  toNumber,
  yearMonthOf,
} from "../../core/reporting";
import {
  chart,
  metric,
  summaryOf,
  type ReportResponse,
} from "./reports.contract";
import { applyCapability, type ReportQuery } from "./reports.filters";
import { buildMeta, previousQuery, resolveSelection } from "./reports.meta";
import {
  assembleDebtSummary,
  assembleFinancialSummary,
  assembleInvoiceStatusChart,
  assembleMonthlyFinancialChart,
  assemblePaymentMethodChart,
} from "./reports.assemble";
import {
  aggregateDebtCollections,
  countStudentsInDebt,
  fetchFinancialSnapshot,
  fetchTeacherSnapshot,
} from "./reports.queries";
import {
  debtAging,
  fetchDebtCollectionRows,
  fetchDebtRows,
  fetchInvoiceRows,
  fetchPaymentRows,
  fetchReceiptRows,
  receiptCounts,
  revenueBySubject,
} from "./reports.rows.finance";
import {
  entitlementByTeacher,
  fetchAllocationRows,
  fetchSettlementRows,
  fetchTeacherPaymentRows,
  settlementCounts,
} from "./reports.rows.teacher";
import {
  auditCounts,
  fetchAuditRows,
  fetchCancellationRows,
  runDataQualityChecks,
} from "./reports.rows.audit";
import { invoiceScope, resolvePeriod } from "./reports.scope";
import { buildTable, resolveSort, type TableRequest } from "./reports.table";
import {
  ALLOCATION_COLUMNS,
  ALLOCATION_SORT,
  AUDIT_COLUMNS,
  AUDIT_SORT,
  CANCELLATION_COLUMNS,
  DATA_QUALITY_COLUMNS,
  DEBT_COLLECTION_COLUMNS,
  DEBT_COLLECTION_SORT,
  DEBT_COLUMNS,
  DEBT_SORT,
  INVOICE_COLUMNS,
  INVOICE_SORT,
  PAYMENT_COLUMNS,
  PAYMENT_SORT,
  RECEIPT_COLUMNS,
  RECEIPT_SORT,
  SETTLEMENT_COLUMNS,
  SETTLEMENT_ROW_DRILL,
  SETTLEMENT_SORT,
  TEACHER_PAYMENT_COLUMNS,
  TEACHER_PAYMENT_SORT,
} from "./reports.tables.finance";

// ======================================================
// خدماتُ التقارير المالية والتخليص والتدقيق
//
// نفسُ الخطوات الأربع في `reports.service.ts`: تصفيةٌ بالقدرات،
// فحلُّ فترة، فجلبٌ متوازٍ، فتجميعٌ إلى المظروف الموحّد.
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

const referenceMonth = (query: Partial<ReportQuery>) => {
  const period = resolvePeriod(query);

  if (period.yearMonth) return period.yearMonth;
  if (period.range) return yearMonthOf(period.range.to);

  return yearMonthOf(new Date());
};

const tableRequest = (query: ReportQuery): TableRequest => ({
  page: query.page,
  pageSize: query.pageSize,
  sortBy: query.sortBy,
  sortDir: query.sortDir,
});

/** المقدّمةُ المشتركة لكلّ تقرير: قدرات، فترة، سنة دراسية */
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
// الفواتير — §22
// ======================================================

export const invoicesReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "invoices",
    query,
  );
  const sort = resolveSort(request, INVOICE_SORT);
  const reference = referenceMonth(scoped);

  const previous = selection.previous
    ? previousQuery(scoped, selection)
    : undefined;

  const [financial, table, bySubject, previousFinancial] = await Promise.all([
    fetchFinancialSnapshot(scoped, reference),
    fetchInvoiceRows(scoped, request, sort),
    revenueBySubject(scoped),
    previous ? fetchFinancialSnapshot(previous, reference) : undefined,
  ]);

  return {
    meta: buildMeta({ report: "invoices", query, selection, academicYear }),
    summary: assembleFinancialSummary({
      current: financial,
      previous: previousFinancial,
    }),
    charts: [
      assembleInvoiceStatusChart(financial.byStatus),
      assembleMonthlyFinancialChart(financial.byMonth),
      chart({
        key: "revenueBySubject",
        title: "الإيراد حسب المادة",
        kind: "horizontalBar",
        unit: "money",
        categories: bySubject.map((row) => row.name),
        series: [
          {
            key: "invoiced",
            label: "المفوتر",
            data: bySubject.map((row) => row.invoiced),
          },
          {
            key: "collected",
            label: "المحصَّل",
            data: bySubject.map((row) => row.invoiced - row.remaining),
          },
        ],
        drill: {
          to: "/reports/invoices",
          param: "subjectId",
          categoryIds: bySubject.map((row) => row.id),
        },
      }),
    ],
    table: buildTable({
      columns: INVOICE_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// الدفعات — §23
// ======================================================

export const paymentsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "payments",
    query,
  );
  const sort = resolveSort(request, PAYMENT_SORT);
  const reference = referenceMonth(scoped);

  const [financial, table] = await Promise.all([
    fetchFinancialSnapshot(scoped, reference),
    fetchPaymentRows(scoped, request, sort),
  ]);

  const cancelled = await prisma.payment.count({
    where: { status: "CANCELLED" },
  });

  return {
    meta: buildMeta({ report: "payments", query, selection, academicYear }),
    summary: summaryOf([
      metric("collected", toNumber(financial.payments.paymentTotal)),
      metric("paymentCount", financial.payments.paymentCount),
      metric(
        "averagePayment",
        financial.payments.paymentCount > 0
          ? toNumber(financial.payments.paymentTotal) /
              financial.payments.paymentCount
          : null,
      ),
      /* §21: الملغى يُعرض عدداً ولا يدخل المجاميع */
      metric("cancelledPayments", cancelled),
    ]),
    charts: [assemblePaymentMethodChart(financial.methods)],
    table: buildTable({
      columns: PAYMENT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// الإيصالات — §24
// ======================================================

export const receiptsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "receipts",
    query,
  );
  const sort = resolveSort(request, RECEIPT_SORT);

  const [counts, table] = await Promise.all([
    receiptCounts(scoped),
    fetchReceiptRows(scoped, request, sort),
  ]);

  return {
    meta: buildMeta({ report: "receipts", query, selection, academicYear }),
    summary: summaryOf([
      metric("totalReceipts", counts.total),
      metric("activeReceipts", counts.active),
      metric("cancelledReceipts", counts.cancelled),
      metric("reprintedReceipts", counts.reprinted),
      metric("printedReceipts", counts.printed),
      metric("notPrintedReceipts", counts.notPrinted),
    ]),
    charts: [
      chart({
        key: "receiptStatus",
        title: "حالات الإيصالات",
        kind: "donut",
        unit: "count",
        categories: ["نشط", "ملغى", "أُعيد طبعه"],
        series: [
          {
            key: "count",
            label: "العدد",
            data: [counts.active, counts.cancelled, counts.reprinted],
          },
        ],
      }),
    ],
    table: buildTable({
      columns: RECEIPT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// الديون — §25
// ======================================================

export const debtsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "debts",
    query,
  );
  const sort = resolveSort(request, DEBT_SORT);
  const reference = referenceMonth(scoped);
  const period = resolvePeriod(scoped);

  const [financial, table, aging, collections, studentsInDebt] =
    await Promise.all([
      fetchFinancialSnapshot(scoped, reference),
      fetchDebtRows(scoped, reference, request, sort),
      debtAging(scoped, reference),
      aggregateDebtCollections(period.range),
      countStudentsInDebt(invoiceScope(scoped)),
    ]);

  return {
    meta: buildMeta({ report: "debts", query, selection, academicYear }),
    summary: assembleDebtSummary(financial, {
      studentsInDebt,
      collectedOld: collections.collectedOld,
    }),
    charts: [
      chart({
        key: "debtAging",
        title: "تعتيق الدَّين",
        kind: "bar",
        unit: "money",
        categories: DEBT_AGE_BUCKETS.map((bucket) => bucket.label),
        series: [
          {
            key: "amount",
            label: "المبلغ",
            data: DEBT_AGE_BUCKETS.map(
              (bucket) => aging.get(bucket.key)?.amount ?? 0,
            ),
          },
        ],
      }),
    ],
    table: buildTable({
      columns: DEBT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// تحصيل الديون — §26
// ======================================================

export const debtCollectionsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "debt-collections",
    query,
  );
  const sort = resolveSort(request, DEBT_COLLECTION_SORT);
  const period = resolvePeriod(scoped);

  const [collections, table] = await Promise.all([
    aggregateDebtCollections(period.range),
    fetchDebtCollectionRows(scoped, request, sort),
  ]);

  const shareTotal = table.rows.reduce(
    (sum, row) => sum + row.teacherShareAmount,
    0,
  );

  return {
    meta: buildMeta({
      report: "debt-collections",
      query,
      selection,
      academicYear,
    }),
    summary: summaryOf([
      metric("collectedOldDebt", toNumber(collections.collectedOld)),
      metric("collectionCount", collections.collectionCount),
      /*
       * حصصُ الأساتذة من **هذه الصفحة** لا من الفترة كلِّها.
       *
       * والعنوانُ يقول ذلك، لأنّ حساب المجموع الحقيقي يحتاج
       * تجميعاً مستقلّاً لم يُطلب هنا — وإظهارُ رقمِ صفحةٍ كأنّه
       * مجموعُ فترةٍ كذبٌ صامت.
       */
      metric("teacherSharesOnPage", shareTotal),
    ]),
    charts: [],
    table: buildTable({
      columns: DEBT_COLLECTION_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// التخليص — §29
// ======================================================

export const settlementsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "settlements",
    query,
  );
  const sort = resolveSort(request, SETTLEMENT_SORT);

  const [counts, table, byTeacher, teachers] = await Promise.all([
    settlementCounts(scoped),
    fetchSettlementRows(scoped, request, sort),
    entitlementByTeacher(scoped),
    fetchTeacherSnapshot(scoped),
  ]);

  return {
    meta: buildMeta({ report: "settlements", query, selection, academicYear }),
    summary: summaryOf([
      metric("totalSettlements", counts.total),
      metric("draftSettlements", counts.draft),
      metric("confirmedSettlements", counts.confirmed),
      metric("paidSettlements", counts.paid),
      metric("cancelledSettlements", counts.cancelled),
      /* المسوّدة خارج الالتزام — حسابٌ لم يُعتمد */
      metric("committedEntitlement", counts.committedAmount),
      metric("draftEntitlement", counts.draftAmount),
      metric("teacherPaid", toNumber(teachers.allocations.allocatedPaid)),
    ]),
    charts: [
      chart({
        key: "entitlementByTeacher",
        title: "المستحقّ حسب الأستاذ",
        kind: "horizontalBar",
        unit: "money",
        categories: byTeacher.map((row) => row.name),
        series: [
          {
            key: "settlements",
            label: "من التخليص",
            data: byTeacher.map((row) => row.fromSettlements),
          },
          {
            key: "debtShares",
            label: "من حصص الدَّين",
            data: byTeacher.map((row) => row.fromDebtShares),
          },
        ],
        drill: {
          to: "/reports/settlements",
          param: "teacherId",
          categoryIds: byTeacher.map((row) => row.id),
        },
      }),
    ],
    table: buildTable({
      columns: SETTLEMENT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
      rowDrill: SETTLEMENT_ROW_DRILL,
    }),
  };
};

// ======================================================
// دفعات الأساتذة — §31
// ======================================================

export const teacherPaymentsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "teacher-payments",
    query,
  );
  const sort = resolveSort(request, TEACHER_PAYMENT_SORT);

  const [teachers, table, cancelled] = await Promise.all([
    fetchTeacherSnapshot(scoped),
    fetchTeacherPaymentRows(scoped, request, sort),
    prisma.teacherPayment.count({ where: { status: "CANCELLED" } }),
  ]);

  const paid = toNumber(teachers.payments.teacherPaymentTotal);
  const allocated = toNumber(teachers.allocations.allocatedPaid);

  return {
    meta: buildMeta({
      report: "teacher-payments",
      query,
      selection,
      academicYear,
    }),
    summary: summaryOf([
      metric("teacherPaid", paid),
      metric("teacherPaymentCount", teachers.payments.teacherPaymentCount),
      metric(
        "averageTeacherPayment",
        teachers.payments.teacherPaymentCount > 0
          ? paid / teachers.payments.teacherPaymentCount
          : null,
      ),
      /* §32 §39: ينبغي أن يكون صفراً */
      metric("unallocatedTeacherPayment", paid - allocated),
      metric("cancelledTeacherPayments", cancelled),
    ]),
    charts: [],
    table: buildTable({
      columns: TEACHER_PAYMENT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// تخصيصات دفعات الأساتذة — §32
// ======================================================

export const allocationsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "allocations",
    query,
  );
  const sort = resolveSort(request, ALLOCATION_SORT);

  const table = await fetchAllocationRows(scoped, request, sort);

  const toSettlements = table.rows
    .filter((row) => row.targetKind === "settlement")
    .reduce((sum, row) => sum + row.amount, 0);
  const toDebtShares = table.rows
    .filter((row) => row.targetKind === "debtShare")
    .reduce((sum, row) => sum + row.amount, 0);
  const orphans = table.rows.filter((row) => row.targetKind === "unknown");

  return {
    meta: buildMeta({ report: "allocations", query, selection, academicYear }),
    summary: summaryOf([
      metric("allocationCount", table.total),
      metric("allocatedToSettlements", toSettlements),
      metric("allocatedToDebtShares", toDebtShares),
      /* حالةٌ لا ينبغي أن تقع — تُعرض لتُعالَج لا لتُخفى */
      metric("orphanAllocations", orphans.length),
    ]),
    charts: [
      chart({
        key: "allocationTargets",
        title: "وجهة التخصيصات (هذه الصفحة)",
        kind: "donut",
        unit: "money",
        categories: ["تخليص", "حصص دَين"],
        series: [
          {
            key: "amount",
            label: "المبلغ",
            data: [toSettlements, toDebtShares],
          },
        ],
      }),
    ],
    table: buildTable({
      columns: ALLOCATION_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// التدقيق — §37
// ======================================================

export const auditReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "audit",
    query,
  );
  const sort = resolveSort(request, AUDIT_SORT);

  const [counts, table] = await Promise.all([
    auditCounts(scoped),
    fetchAuditRows(scoped, request, sort),
  ]);

  const of = (action: string) =>
    counts.byAction.find((row) => row.action === action)?._count ?? 0;

  return {
    meta: buildMeta({ report: "audit", query, selection, academicYear }),
    summary: summaryOf([
      metric("auditEntries", counts.total),
      metric("auditCreates", of("CREATE")),
      metric("auditUpdates", of("UPDATE")),
      metric("auditCancels", of("CANCEL")),
      metric("auditConfirms", of("CONFIRM")),
      metric("auditRecomputes", of("RECOMPUTE")),
    ]),
    charts: [
      chart({
        key: "auditByEntity",
        title: "الوقائع حسب الكيان",
        kind: "horizontalBar",
        unit: "count",
        categories: counts.byEntity.map((row) => row.entity),
        series: [
          {
            key: "count",
            label: "العدد",
            data: counts.byEntity.map((row) => row._count),
          },
        ],
      }),
    ],
    table: buildTable({
      columns: AUDIT_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort,
    }),
  };
};

// ======================================================
// الإلغاءات — §38
// ======================================================

export const cancellationsReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, scoped, request } = await prepare(
    "cancellations",
    query,
  );

  const table = await fetchCancellationRows(scoped, request);

  const totalAmount = table.rows.reduce((sum, row) => sum + (row.amount ?? 0), 0);

  return {
    meta: buildMeta({
      report: "cancellations",
      query,
      selection,
      academicYear,
    }),
    summary: summaryOf([
      metric("cancellationCount", table.total),
      metric("cancelledAmountOnPage", totalAmount),
    ]),
    charts: [],
    table: buildTable({
      columns: CANCELLATION_COLUMNS,
      rows: table.rows,
      total: table.total,
      request,
      sort: { key: "cancelledAt", direction: "desc", orderBy: {} },
    }),
    /*
     * §72: بلاغُ النقص حين يبلغ مصدرٌ سقفَ الجلب.
     *
     * ويُرسل في `partialErrors` لا يُكتم: شاشةُ مراجعةٍ تعرض
     * مجموعاً ناقصاً بلا تنبيه أسوأُ من شاشةٍ لا تعمل.
     */
    ...(table.truncated
      ? {
          partialErrors: [
            {
              section: "table",
              message:
                "بلغ أحد المصادر سقف الجلب — القائمة ناقصة. ضيّق الفترة لرؤية الكلّ.",
            },
          ],
        }
      : {}),
  };
};

// ======================================================
// جودة البيانات — §39
// ======================================================

export const dataQualityReportService = async (
  query: ReportQuery,
): Promise<ReportResponse> => {
  const { selection, academicYear, request } = await prepare(
    "data-quality",
    query,
  );

  const issues = await runDataQualityChecks();

  const critical = issues.filter(
    (issue) => issue.severity === "critical" && issue.count > 0,
  );
  const warnings = issues.filter(
    (issue) => issue.severity === "warning" && issue.count > 0,
  );

  return {
    meta: buildMeta({ report: "data-quality", query, selection, academicYear }),
    summary: summaryOf([
      metric("checksRun", issues.length),
      metric("criticalIssues", critical.length),
      metric("warningIssues", warnings.length),
      metric(
        "affectedRecords",
        issues.reduce((sum, issue) => sum + issue.count, 0),
      ),
    ]),
    charts: [],
    /*
     * الفحوصُ كلُّها تُعرض بما فيها الأصفار — §39.
     *
     * والصفرُ معلومة: «فُحص ولم يُوجد» يطمئن، بخلاف غياب السطر
     * الذي يُقرأ «لم يُفحص». وشاشةُ جودة البيانات تفقد قيمتَها إن
     * لم تُظهر ما فحصته.
     *
     * ولا ترقيمَ خادمياً هنا: الفحوصُ سبعةٌ ثابتة، والترقيمُ عبثٌ.
     */
    table: {
      columns: DATA_QUALITY_COLUMNS,
      rows: issues,
      pagination: {
        page: 1,
        pageSize: issues.length || 1,
        total: issues.length,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
      sort: null,
    },
  };
};
