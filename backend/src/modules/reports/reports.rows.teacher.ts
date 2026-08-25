import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import { rate, toNumber } from "../../core/reporting";
import type { ReportQuery } from "./reports.filters";
import { settlementScope, teacherPaymentScope } from "./reports.scope";
import { skipTake, type ResolvedSort, type TableRequest } from "./reports.table";

// ======================================================
// صفوفُ التخليص ودفعات الأساتذة — §29 §30 §31 §32
//
// §53 يحكم هذا الملف كلَّه: **اللقطةُ لا إعادةُ الحساب**.
//
// التخليصُ يحمل في نفسه صورةَ السياسة والتسعيرة والحضور لحظةَ
// حسابه — `methodSnapshot` و `tuitionSnapshot` و `attendedUnitsSnapshot`
// وأخواتها. والتقريرُ التاريخي يقرأ تلك الحقول ولا يقترب من
// `SettlementPolicy` ولا `TuitionFee` الحاليتين.
//
// ولو أعاد الحساب بالسياسة الجارية، لتغيّر مبلغُ تخليصٍ دُفع قبل
// أشهر كلَّما عدّلت الإدارةُ نسبةَ أستاذ — فيصير التقريرُ التاريخي
// يكذب على من دفع ومن قبض.
// ======================================================

// --------------------------------------------------
// التخليص — §29
// --------------------------------------------------

export type SettlementRow = {
  id: string;
  settlementNumber: string;
  teacher: string;
  subject: string;
  studyGroup: string;
  sheetNumber: number;
  sheetLabel: string | null;
  status: string;
  /** من اللقطة لا من الحساب الجاري — §53 */
  method: string;
  studentCount: number;
  approvedSessions: number;
  attendedUnits: number;
  grossTuition: number;
  collected: number;
  teacherAmount: number;
  allocated: number;
  remaining: number;
  computedAt: string;
  confirmedAt: string | null;
  paidAt: string | null;
};

export const fetchSettlementRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: SettlementRow[]; total: number }> => {
  /*
   * الملغى يظهر في الجدول ولا يدخل المجاميع (§52.4).
   *
   * وشاشةُ التخليص من أكثر ما يُراجَع: إلغاءُ تخليصٍ وإعادةُ حسابه
   * (§30) واقعتان يجب أن تُريا معاً، وإخفاءُ الأولى يجعل الثانية
   * تبدو بلا سبب.
   */
  const where = settlementScope(query, { includeCancelled: true });

  const [total, settlements] = await prisma.$transaction([
    prisma.settlement.count({ where }),
    prisma.settlement.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.SettlementOrderByWithRelationInput,
      select: {
        id: true,
        settlementNumber: true,
        status: true,
        methodSnapshot: true,
        studentCountSnapshot: true,
        approvedSessionsSnapshot: true,
        attendedUnitsSnapshot: true,
        grossTuitionSnapshot: true,
        collectedSnapshot: true,
        teacherAmount: true,
        computedAt: true,
        confirmedAt: true,
        paidAt: true,
        teacher: { select: { firstName: true, lastName: true } },
        attendanceSheet: { select: { number: true, label: true } },
        teachingAssignment: {
          select: {
            subject: { select: { name: true } },
            studyGroup: { select: { name: true } },
          },
        },
        /*
         * التخصيصاتُ تُجلب مع الصفّ لا باستعلامٍ لكلّ تخليص.
         *
         * وشرطُ الدفعة النشطة داخل `where` الخاصّ بالعلاقة: تخصيصٌ
         * تبع دفعةً ملغاة لا يُحتسب مدفوعاً (§52.3).
         */
        teacherAllocations: {
          where: { teacherPayment: { status: "ACTIVE" } },
          select: { amount: true },
        },
      },
    }),
  ]);

  const rows: SettlementRow[] = settlements.map((settlement) => {
    const teacherAmount = toNumber(settlement.teacherAmount);
    const allocated = settlement.teacherAllocations.reduce(
      (sum, allocation) => sum + toNumber(allocation.amount),
      0,
    );

    return {
      id: settlement.id,
      settlementNumber: settlement.settlementNumber,
      teacher:
        `${settlement.teacher.firstName} ${settlement.teacher.lastName}`.trim(),
      subject: settlement.teachingAssignment.subject.name,
      studyGroup: settlement.teachingAssignment.studyGroup.name,
      sheetNumber: settlement.attendanceSheet.number,
      sheetLabel: settlement.attendanceSheet.label,
      status: settlement.status,
      method: settlement.methodSnapshot,
      studentCount: settlement.studentCountSnapshot,
      approvedSessions: settlement.approvedSessionsSnapshot,
      attendedUnits: settlement.attendedUnitsSnapshot,
      grossTuition: toNumber(settlement.grossTuitionSnapshot),
      collected: toNumber(settlement.collectedSnapshot),
      teacherAmount,
      allocated,
      remaining: teacherAmount - allocated,
      computedAt: settlement.computedAt.toISOString(),
      confirmedAt: settlement.confirmedAt?.toISOString() ?? null,
      paidAt: settlement.paidAt?.toISOString() ?? null,
    };
  });

  return { rows, total };
};

export const settlementCounts = async (query: Partial<ReportQuery>) => {
  const where = settlementScope(query, { includeCancelled: true });

  const byStatus = await prisma.settlement.groupBy({
    by: ["status"],
    where,
    _sum: { teacherAmount: true },
    _count: true,
  });

  const of = (status: string) =>
    byStatus.find((row) => row.status === status) ?? {
      _count: 0,
      _sum: { teacherAmount: null },
    };

  return {
    byStatus,
    draft: of("DRAFT")._count,
    confirmed: of("CONFIRMED")._count,
    paid: of("PAID")._count,
    cancelled: of("CANCELLED")._count,
    total: byStatus.reduce((sum, row) => sum + row._count, 0),
    /*
     * المستحقُّ الملتزَم به: المؤكَّد والمدفوع دون المسوّدة.
     *
     * المسوّدةُ حسابٌ لم يُعتمد، وإدخالُها في «الواجب دفعه» يُظهر
     * ديناً وهمياً على المؤسسة.
     */
    committedAmount:
      toNumber(of("CONFIRMED")._sum.teacherAmount) +
      toNumber(of("PAID")._sum.teacherAmount),
    draftAmount: toNumber(of("DRAFT")._sum.teacherAmount),
  };
};

// --------------------------------------------------
// دفعات الأساتذة — §31
// --------------------------------------------------

export type TeacherPaymentRow = {
  id: string;
  paymentNumber: string;
  teacher: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  status: string;
  paidBy: string | null;
  allocated: number;
  unallocated: number;
  allocationCount: number;
};

export const fetchTeacherPaymentRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: TeacherPaymentRow[]; total: number }> => {
  const where = teacherPaymentScope(query, { includeCancelled: true });

  const [total, payments] = await prisma.$transaction([
    prisma.teacherPayment.count({ where }),
    prisma.teacherPayment.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.TeacherPaymentOrderByWithRelationInput,
      select: {
        id: true,
        paymentNumber: true,
        amount: true,
        paymentMethod: true,
        paymentDate: true,
        status: true,
        teacher: { select: { firstName: true, lastName: true } },
        paidBy: { select: { firstName: true, lastName: true } },
        allocations: { select: { amount: true } },
      },
    }),
  ]);

  const rows: TeacherPaymentRow[] = payments.map((payment) => {
    const amount = toNumber(payment.amount);
    const allocated = payment.allocations.reduce(
      (sum, allocation) => sum + toNumber(allocation.amount),
      0,
    );

    return {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
      amount,
      paymentMethod: payment.paymentMethod,
      paymentDate: payment.paymentDate.toISOString(),
      status: payment.status,
      paidBy: payment.paidBy
        ? `${payment.paidBy.firstName} ${payment.paidBy.lastName}`.trim()
        : null,
      allocated,
      /* ينبغي أن يكون صفراً — §32 و§39 */
      unallocated: amount - allocated,
      allocationCount: payment.allocations.length,
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// تخصيصاتُ دفعات الأساتذة — §32
//
// الشاشةُ التي تجيب «أين ذهب كلُّ دينار».
// --------------------------------------------------

export type AllocationRow = {
  id: string;
  paymentNumber: string;
  teacher: string;
  paymentDate: string;
  paymentTotal: number;
  amount: number;
  /** إلى أين ذُهب بهذا الجزء */
  targetKind: "settlement" | "debtShare" | "unknown";
  targetLabel: string;
  targetPeriod: string | null;
};

export const fetchAllocationRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: AllocationRow[]; total: number }> => {
  const where: Prisma.TeacherPaymentAllocationWhereInput = {
    teacherPayment: teacherPaymentScope(query, { includeCancelled: true }),
  };

  const [total, allocations] = await prisma.$transaction([
    prisma.teacherPaymentAllocation.count({ where }),
    prisma.teacherPaymentAllocation.findMany({
      where,
      ...skipTake(request),
      orderBy:
        sort.orderBy as Prisma.TeacherPaymentAllocationOrderByWithRelationInput,
      select: {
        id: true,
        amount: true,
        teacherPayment: {
          select: {
            paymentNumber: true,
            amount: true,
            paymentDate: true,
            teacher: { select: { firstName: true, lastName: true } },
          },
        },
        settlement: {
          select: {
            settlementNumber: true,
            attendanceSheet: { select: { number: true, label: true } },
          },
        },
        teacherDebtShare: {
          select: {
            id: true,
            debtCollection: {
              select: { originalMonth: true, originalYear: true },
            },
          },
        },
      },
    }),
  ]);

  const rows: AllocationRow[] = allocations.map((allocation) => {
    const payment = allocation.teacherPayment;

    /*
     * التخصيصُ يشير إلى أحدهما لا كليهما: تخليصٌ أو حصّةُ دَين.
     *
     * و`unknown` ليست حالةً متوقّعة — لو ظهرت فهي خللٌ في البيانات
     * يجب أن يُرى في §39 لا أن يُخفى بسطرٍ فارغ.
     */
    if (allocation.settlement) {
      const sheet = allocation.settlement.attendanceSheet;

      return {
        id: allocation.id,
        paymentNumber: payment.paymentNumber,
        teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
        paymentDate: payment.paymentDate.toISOString(),
        paymentTotal: toNumber(payment.amount),
        amount: toNumber(allocation.amount),
        targetKind: "settlement" as const,
        targetLabel: allocation.settlement.settlementNumber,
        targetPeriod: sheet.label ?? `كشف ${sheet.number}`,
      };
    }

    if (allocation.teacherDebtShare) {
      const collection = allocation.teacherDebtShare.debtCollection;

      return {
        id: allocation.id,
        paymentNumber: payment.paymentNumber,
        teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
        paymentDate: payment.paymentDate.toISOString(),
        paymentTotal: toNumber(payment.amount),
        amount: toNumber(allocation.amount),
        targetKind: "debtShare" as const,
        targetLabel: "حصّة من دَين محصَّل",
        targetPeriod: `${collection.originalYear}-${String(
          collection.originalMonth,
        ).padStart(2, "0")}`,
      };
    }

    return {
      id: allocation.id,
      paymentNumber: payment.paymentNumber,
      teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
      paymentDate: payment.paymentDate.toISOString(),
      paymentTotal: toNumber(payment.amount),
      amount: toNumber(allocation.amount),
      targetKind: "unknown" as const,
      targetLabel: "بلا وجهة",
      targetPeriod: null,
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// المستحقُّ حسب الأستاذ — لرسم §29
// --------------------------------------------------

export const entitlementByTeacher = async (query: Partial<ReportQuery>) => {
  const [settlements, shares] = await Promise.all([
    prisma.settlement.groupBy({
      by: ["teacherId"],
      where: settlementScope(query),
      _sum: { teacherAmount: true },
    }),
    prisma.teacherDebtShare.groupBy({
      by: ["teacherId"],
      where: {
        status: { not: "CANCELLED" },
        ...(query.teacherId ? { teacherId: query.teacherId } : {}),
      },
      _sum: { shareAmount: true },
    }),
  ]);

  const ids = [
    ...new Set([
      ...settlements.map((row) => row.teacherId),
      ...shares.map((row) => row.teacherId),
    ]),
  ];

  if (ids.length === 0) return [];

  const teachers = await prisma.teacher.findMany({
    where: { id: { in: ids } },
    select: { id: true, firstName: true, lastName: true },
  });

  const settlementBy = new Map(
    settlements.map((row) => [row.teacherId, toNumber(row._sum.teacherAmount)]),
  );
  const shareBy = new Map(
    shares.map((row) => [row.teacherId, toNumber(row._sum.shareAmount)]),
  );

  return teachers
    .map((teacher) => ({
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`.trim(),
      fromSettlements: settlementBy.get(teacher.id) ?? 0,
      fromDebtShares: shareBy.get(teacher.id) ?? 0,
      entitlement:
        (settlementBy.get(teacher.id) ?? 0) + (shareBy.get(teacher.id) ?? 0),
    }))
    .sort((a, b) => b.entitlement - a.entitlement);
};

/** نسبةُ ما دُفع من المستحقّ — يُستعمل في بطاقات §29 */
export const settlementPaidRate = (
  entitlement: number,
  allocated: number,
): number | null => rate(allocated, entitlement);
