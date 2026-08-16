import { Prisma } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { startOfUtcDay } from "../../core/utils/time";
import { recordAudit } from "../../core/audit/financial-audit";
import {
  resolveSettlementPolicy,
  explainMissingPolicy,
} from "../../core/pricing/settlement-scope";
import {
  resolveTuitionFeeForGroup,
  explainMissingFee,
} from "../../core/pricing/tuition-scope";
import { computeSettlement } from "../../core/pricing/settlement-calc";
import {
  ComputeSettlementInput,
  ConfirmSettlementInput,
  CancelSettlementInput,
  SettlementQueryInput,
} from "./settlement.schema";

const settlementSelect = {
  id: true,
  settlementNumber: true,
  revision: true,
  teachingAssignmentId: true,
  attendanceSheetId: true,
  academicYearId: true,
  teacherId: true,
  policyId: true,
  methodSnapshot: true,
  countBasisSnapshot: true,
  roundingModeSnapshot: true,
  roundingPrecisionSnapshot: true,
  percentageSnapshot: true,
  perStudentSnapshot: true,
  perSessionSnapshot: true,
  tuitionSnapshot: true,
  approvedSessionsSnapshot: true,
  completedSessionsSnapshot: true,
  studentCountSnapshot: true,
  paidStudentCountSnapshot: true,
  attendedUnitsSnapshot: true,
  grossTuitionSnapshot: true,
  collectedSnapshot: true,
  remainingSnapshot: true,
  teacherAmount: true,
  status: true,
  computedAt: true,
  confirmedAt: true,
  paidAt: true,
  cancelledAt: true,
  cancelReason: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  teacher: { select: { id: true, firstName: true, lastName: true } },
  policy: { select: { id: true, name: true, method: true } },
  academicYear: { select: { id: true, name: true } },
  attendanceSheet: {
    select: { id: true, number: true, label: true, sessionCount: true },
  },
  teachingAssignment: {
    select: {
      id: true,
      subject: { select: { id: true, name: true } },
      studyGroup: {
        select: {
          id: true,
          name: true,
          level: { select: { id: true, name: true } },
        },
      },
    },
  },
  confirmedBy: { select: { id: true, firstName: true, lastName: true } },
  paidBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
} as const;

const lineSelect = {
  id: true,
  sessionId: true,
  lessonNumber: true,
  sessionDate: true,
  countedStudents: true,
  rate: true,
  lineTotal: true,
} as const;

const n = (value: Prisma.Decimal | null) =>
  value === null ? null : Number(value);

type RawSettlement = Record<string, unknown> & {
  percentageSnapshot: Prisma.Decimal | null;
  perStudentSnapshot: Prisma.Decimal | null;
  perSessionSnapshot: Prisma.Decimal | null;
  tuitionSnapshot: Prisma.Decimal;
  grossTuitionSnapshot: Prisma.Decimal;
  collectedSnapshot: Prisma.Decimal;
  remainingSnapshot: Prisma.Decimal;
  teacherAmount: Prisma.Decimal;
};

const toResponse = <T extends RawSettlement>(settlement: T) => ({
  ...settlement,
  percentageSnapshot: n(settlement.percentageSnapshot),
  perStudentSnapshot: n(settlement.perStudentSnapshot),
  perSessionSnapshot: n(settlement.perSessionSnapshot),
  tuitionSnapshot: Number(settlement.tuitionSnapshot),
  grossTuitionSnapshot: Number(settlement.grossTuitionSnapshot),
  collectedSnapshot: Number(settlement.collectedSnapshot),
  remainingSnapshot: Number(settlement.remainingSnapshot),
  teacherAmount: Number(settlement.teacherAmount),
});

const toLineResponse = (line: {
  rate: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
  [key: string]: unknown;
}) => ({
  ...line,
  rate: Number(line.rate),
  lineTotal: Number(line.lineTotal),
});

// --------------------------------------------------
// جمع المعطيات — كل ما يدخل الحساب، مرّة واحدة
//
// مفصولٌ عن الحساب عمداً: هذه الدالّة تُستعمل أيضاً في الكشف
// التقديري (§16) الذي يعرض النتيجة **قبل** حفظها، فيرى المستخدم
// المبلغ قبل أن يلتزم به.
// --------------------------------------------------

export const gatherSettlementFacts = async (
  teachingAssignmentId: string,
  attendanceSheetId: string,
  policyId?: string | null,
) => {
  const sheet = await prisma.attendanceSheet.findUnique({
    where: { id: attendanceSheetId },
    select: {
      id: true,
      number: true,
      label: true,
      sessionCount: true,
      teachingAssignmentId: true,
      academicYearId: true,
      sessions: {
        select: {
          id: true,
          lessonNumber: true,
          sessionDate: true,
          status: true,
          attendances: {
            select: { status: true, studentEnrollmentId: true },
          },
        },
        /*
         * بالتاريخ لا برقم الحصة.
         *
         * `lessonNumber` رقمٌ متسلسل **داخل الجدول الأسبوعي**، لا ترتيبٌ
         * داخل الكشف. فحصةٌ يتيمة ضُمّت إلى كشفٍ جديد تحتفظ برقمها
         * القديم، وحصةٌ أُنشئت بعدها تأخذ رقماً أكبر ولو كان تاريخُها
         * أقدم. والترتيبُ بالرقم كان يُخرج 02/07 بين 10/08 و13/08.
         *
         * وهو نفسُ ترتيب `attendance-sheet.service` — فما تراه الشاشتان
         * واحد.
         */
        orderBy: [{ sessionDate: "asc" }, { lessonNumber: "asc" }],
      },
    },
  });

  if (!sheet) {
    throw new NotFoundException(
      "Attendance sheet not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (sheet.teachingAssignmentId !== teachingAssignmentId) {
    throw new BadRequestException(
      "The attendance sheet belongs to a different teaching assignment",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id: teachingAssignmentId },
    select: {
      id: true,
      teacherId: true,
      subjectId: true,
      studyGroupId: true,
      academicYearId: true,
      subject: { select: { id: true, name: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      studyGroup: {
        select: {
          id: true,
          name: true,
          type: true,
          level: {
            select: {
              id: true,
              name: true,
              educationStage: { select: { id: true, name: true } },
            },
          },
        },
      },
      enrollments: {
        where: { isActive: true },
        select: {
          id: true,
                  /** فارغُه أهليةٌ كاملة — ومنه تُعرف حصصُ من التحق متأخّراً */
          eligibleFrom: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              parentPhone: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    throw new NotFoundException(
      "Teaching assignment not found",
      ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND,
    );
  }

  // الحصص المحتسبة: المنجزة وحدها. الملغاة لم تُدرَّس،
  // والمجدولة لم تُدرَّس بعد.
  const countedSessions = sheet.sessions.filter(
    (session) => session.status === "COMPLETED",
  );

  // كشفٌ لم تُنجز فيه حصة واحدة لا يُخلَّص.
  //
  // بغير هذا الحاجز تُنتج الطرائق المسطَّحة (PERCENTAGE و PER_STUDENT)
  // مبلغاً كاملاً لشهرٍ لم يُدرَّس: ستةَ عشرَ طالباً × 1500 × 75% =
  // 18000 مقابل صفرِ حصص. والمبلغُ صحيح حسابياً وفق السياسة، لكنه
  // جوابٌ عن سؤال لم يُطرح — لا شيء هنا يُخلَّص بعد.
  //
  // وهو أيضاً ما يجعل «مجموع الأسطر = الإجمالي» ثابتاً: لا إجمالي
  // بلا سطرٍ واحد على الأقل يسنده.
  if (countedSessions.length === 0) {
    throw new BadRequestException(
      `Attendance sheet #${sheet.number} has no completed session yet ` +
        `(${sheet.sessions.length} session(s) recorded, 0 completed). ` +
        `There is nothing to settle.`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  /*
   * تاريخ المرجع: **أقدم** حصةٍ منجزة — بالتاريخ لا برقم الحصة.
   *
   * منه تُشتقّ السياسةُ السارية وشهرُ الفواتير المطابَقة، فكشفُ سبتمبر
   * يُحسب بأسعار سبتمبر مهما تأخّر تخليصه.
   *
   * وكان يُؤخذ من `countedSessions[0]` وهي مرتَّبةٌ برقم الحصة. ورقمُ
   * الحصة لا يلزم أن يوافق ترتيب التاريخ: كشفٌ حصّتُه الأولى في 15/08
   * والثامنة في 02/07 يجعل «الأولى» أحدثَ لا أقدم، فيطابق شهراً غير
   * الذي وقع فيه معظمُ الكشف — وتخرج المحتسبون صفراً بلا سببٍ ظاهر.
   *
   * والواجهة تطابق بأقدم تاريخ (`invoicePeriodOf`)، فكانا يفترقان.
   */
  const referenceDate =
    countedSessions
      .map((session) => session.sessionDate)
      .reduce<Date | null>(
        (oldest, date) => (oldest === null || date < oldest ? date : oldest),
        null,
      ) ??
    sheet.sessions[0]?.sessionDate ??
    new Date();

  const policy = policyId
    ? await prisma.settlementPolicy.findUnique({ where: { id: policyId } })
    : await resolveSettlementPolicy(
        {
          academicYearId: assignment.academicYearId,
          subjectId: assignment.subjectId,
          studyGroupId: assignment.studyGroupId,
          teacherId: assignment.teacherId,
        },
        referenceDate,
      );

  if (!policy) {
    throw new NotFoundException(
      `لا سياسةَ تخليصٍ سارية على ${assignment.subject.name} — ` +
        `${assignment.studyGroup.level.name} · ${assignment.studyGroup.name} ` +
        `في ${referenceDate.toISOString().slice(0, 10)}.\n` +
        (await explainMissingPolicy(
          {
            academicYearId: assignment.academicYearId,
            subjectId: assignment.subjectId,
            studyGroupId: assignment.studyGroupId,
            teacherId: assignment.teacherId,
          },
          referenceDate,
        )),
      ErrorCodeEnum.SETTLEMENT_POLICY_NOT_FOUND,
    );
  }

  const fee = await resolveTuitionFeeForGroup(
    assignment.subjectId,
    assignment.studyGroupId,
    assignment.academicYearId,
  );

  if (!fee) {
    throw new NotFoundException(
      `لا حقّ اشتراك لـ${assignment.subject.name} — ${assignment.studyGroup.name}. ` +
        (await explainMissingFee(
          {
            subjectId: assignment.subjectId,
            studyGroupId: assignment.studyGroupId,
            levelId: assignment.studyGroup.level.id,
            educationStageId: assignment.studyGroup.level.educationStage.id,
            groupType: assignment.studyGroup.type,
          },
          assignment.academicYearId,
        )),
      ErrorCodeEnum.TUITION_FEE_NOT_FOUND,
    );
  }

  // المحصَّل والمتبقّي من فواتير هذا الإسناد في شهر أوّل حصة —
  // المطابقة نفسها المعتمدة في كشف الحقوق الشهري
  const enrollmentIds = assignment.enrollments.map((e) => e.id);

  const invoices = await prisma.invoice.findMany({
    where: {
      studentEnrollmentId: { in: enrollmentIds },
      month: referenceDate.getUTCMonth() + 1,
      year: referenceDate.getUTCFullYear(),
      status: { not: "CANCELLED" },
    },
    select: {
      id: true,
      invoiceNumber: true,
      studentEnrollmentId: true,
      total: true,
      remaining: true,
      status: true,
      dueDate: true,
    },
  });

  const grossTuition = invoices.reduce(
    (sum, invoice) => sum.plus(invoice.total),
    new Prisma.Decimal(0),
  );

  const remaining = invoices.reduce(
    (sum, invoice) => sum.plus(invoice.remaining),
    new Prisma.Decimal(0),
  );

  const collected = grossTuition.minus(remaining);

  // «دفع» = لم يبقَ عليه شيء في هذه المادة
  const paidCount = invoices.filter((invoice) =>
    invoice.remaining.lte(0),
  ).length;

  /**
   * من يدخل حسابَ الأستاذ — §19.
   *
   * `countBasis` لا يحكم من يظهر في كشف الحضور: الكشف يعرض كلَّ
   * مسجَّل مهما كانت حالته المالية. وإنّما يحكم **من يُحتسب**.
   *
   * و`PAID` هي سياسة ورقة المؤسسة: حضورُ المخلَّف لا يدخل مستحقَّ
   * الأستاذ حتى يسدِّد. وهي اختيارُ إدارةٍ لا حكمٌ حسابي — فمع
   * `ENROLLED` تتحمّل المؤسسةُ تأخّرَ الطالب، ومع `PAID` يتحمّله
   * الأستاذ.
   */
  const eligibleEnrollments = new Set(
    policy.countBasis === "PAID"
      ? invoices
          .filter((invoice) => invoice.remaining.lte(0))
          .map((invoice) => invoice.studentEnrollmentId)
      : enrollmentIds,
  );

  const isPresent = (status: string) =>
    status === "PRESENT" || status === "LATE";

  /*
   * أهليةُ كل تسجيلٍ لكل حصة — «غير مسجَّل» ليست غياباً.
   *
   * الطالب الذي التحق في الحصة الخامسة لا يُعدّ حاضراً ولا غائباً ولا
   * محتسباً ولا مخلَّفاً في الأربع الأولى: لم يكن طالباً فيها. ولا
   * يعتمد الحساب على خلوّ خانته من علامة — الخلوُّ قد يكون إهمالَ
   * تدوين، والأهليةُ حقيقةٌ مستقلّة تُقرأ من .
   */
  const eligibleAt = new Map(
    assignment.enrollments.map((e) => [e.id, e.eligibleFrom]),
  );

  const memberAt = (enrollmentId: string, when: Date) => {
    const from = eligibleAt.get(enrollmentId) ?? null;

    return from === null || when >= startOfUtcDay(from);
  };

  const sessions = countedSessions.map((session) => ({
    sessionId: session.id,
    lessonNumber: session.lessonNumber,
    sessionDate: session.sessionDate,
    // الحاضر والمتأخّر كلاهما حضور — المتأخّر جلس الحصة
    presentCount: session.attendances.filter(
      (a) => isPresent(a.status) && memberAt(a.studentEnrollmentId, session.sessionDate),
    ).length,
    countedCount: session.attendances.filter(
      (a) =>
        isPresent(a.status) &&
        memberAt(a.studentEnrollmentId, session.sessionDate) &&
        eligibleEnrollments.has(a.studentEnrollmentId),
    ).length,
  }));

  /**
   * صفٌّ لكل طالب — حضورُه ودَينُه معاً.
   *
   * الجمع بينهما هنا لا في شاشتين: الأستاذ يُخلَّص في وقته سواء دفع
   * الطلبة أم لا، فيبقى ما لم يُدفع **ديناً على الطالب** لا خصماً من
   * الأستاذ (§2). ومَن ينظر في كشف التخليص يحتاج أن يرى الاثنين في
   * سطرٍ واحد: هذا حضر عشراً وعليه 1500.
   *
   * والدَّين مشتقٌّ لا مخزَّن: `Invoice.remaining` هو مصدره الوحيد،
   * فدفعُ الطالب يُطفئه من نفسه بلا خطوةٍ ثانية تُنسى.
   */
  const toNumber = (value: Prisma.Decimal) => Number(value);

  const invoiceByEnrollment = new Map(
    invoices.map((invoice) => [invoice.studentEnrollmentId, invoice]),
  );

  const attendanceOf = (enrollmentId: string) => {
    let attended = 0;
    let absent = 0;
    let late = 0;
    let excused = 0;
    let blank = 0;

    for (const session of countedSessions) {
      // حصةٌ سبقت التحاقه — لا تُعدّ عليه ولا له
      if (!memberAt(enrollmentId, session.sessionDate)) continue;

      const mark = session.attendances.find(
        (a) => a.studentEnrollmentId === enrollmentId,
      );

      if (!mark) {
        blank++;
        continue;
      }

      if (mark.status === "PRESENT") attended++;
      else if (mark.status === "LATE") late++;
      else if (mark.status === "ABSENT") absent++;
      else excused++;
    }

    return { attended, absent, late, excused, blank };
  };

  const students = assignment.enrollments
    .map((enrollment) => {
      const invoice = invoiceByEnrollment.get(enrollment.id) ?? null;
      const marks = attendanceOf(enrollment.id);

      const total = invoice ? toNumber(invoice.total) : 0;
      const debt = invoice ? toNumber(invoice.remaining) : 0;

      return {
        enrollmentId: enrollment.id,
        student: enrollment.student,
        ...marks,
        /* الحاضر والمتأخّر كلاهما حضور — المتأخّر جلس الحصة */
        present: marks.attended + marks.late,
        invoice: invoice
          ? {
              id: invoice.id,
              invoiceNumber: invoice.invoiceNumber,
              total,
              paid: total - debt,
              remaining: debt,
              status: invoice.status,
              dueDate: invoice.dueDate,
              /** تجاوز الاستحقاق ولم يُسدَّد */
              overdue: debt > 0 && invoice.dueDate < new Date(),
            }
          : null,
        /** مخلَّف: عليه دَينٌ في هذه المادة لهذه الفترة */
        defaulter: debt > 0,
        /** أسوأ من المخلَّف — لا فاتورة له أصلاً فلا دَين مقيَّد */
        uninvoiced: invoice === null,
      };
    })
    .sort((a, b) =>
      `${a.student.lastName} ${a.student.firstName}`.localeCompare(
        `${b.student.lastName} ${b.student.firstName}`,
        "ar",
      ),
    );

  const result = computeSettlement({
    method: policy.method,
    countBasis: policy.countBasis,
    roundingMode: policy.roundingMode,
    roundingPrecision: policy.roundingPrecision,
    teacherPercentage: policy.teacherPercentage,
    amountPerStudent: policy.amountPerStudent,
    amountPerSession: policy.amountPerSession,
    tuition: fee.amount,
    approvedSessions: sheet.sessionCount,
    enrolledCount: enrollmentIds.length,
    paidCount,
    sessions,
  });

  return {
    sheet,
    assignment,
    policy,
    fee,
    referenceDate,
    result,
    students,
    /** الحضور الخام لكل حصة — يُعرض بجانب المحتسب فيُفهم الفرق */
    sessions,
    totals: {
      grossTuition,
      collected,
      remaining,
      paidCount,
      enrolledCount: enrollmentIds.length,
      completedSessions: countedSessions.length,
      defaulterCount: students.filter((s) => s.defaulter).length,
      uninvoicedCount: students.filter((s) => s.uninvoiced).length,
    },
  };
};

// --------------------------------------------------
// رقم التخليص — STL-YYYY-NNNN
// --------------------------------------------------

const buildSettlementNumber = (year: number, sequence: number) =>
  `STL-${year}-${String(sequence).padStart(4, "0")}`;

const lastSequence = async (year: number) => {
  const last = await prisma.settlement.findFirst({
    where: { settlementNumber: { startsWith: `STL-${year}-` } },
    orderBy: { settlementNumber: "desc" },
    select: { settlementNumber: true },
  });

  if (!last) return 0;

  return Number(last.settlementNumber.split("-")[2] ?? 0);
};

// --------------------------------------------------
// Compute — إنشاء التخليص أو إعادة حسابه
//
// Idempotent بقيد (إسناد + كشف): الضغط مرتين لا يُنشئ تخليصين، بل
// يُعيد حساب المسوّدة. والمؤكَّد يُرفض — §21.
// --------------------------------------------------

export const computeSettlementService = async (
  body: ComputeSettlementInput,
  userId?: string,
) => {
  const facts = await gatherSettlementFacts(
    body.teachingAssignmentId,
    body.attendanceSheetId,
    body.policyId,
  );

  // الملغى لا يَشغل الموضع: البديل يأخذ revision تالياً، فالتاريخ
  // يُحفظ والتصحيح يبقى ممكناً معاً.
  const sheetScope = {
    teachingAssignmentId: body.teachingAssignmentId,
    attendanceSheetId: body.attendanceSheetId,
  };

  const existing = await prisma.settlement.findFirst({
    where: { ...sheetScope, status: { not: "CANCELLED" } },
    select: { id: true, status: true, settlementNumber: true, revision: true },
  });

  if (existing && existing.status !== "DRAFT") {
    throw new ConflictException(
      `Settlement ${existing.settlementNumber} is ${existing.status} and cannot be recomputed. ` +
        `Cancel it and compute a replacement.`,
      ErrorCodeEnum.SETTLEMENT_LOCKED,
    );
  }

  // رقم المحاولة التالية — يتخطّى الملغاة
  const lastRevision = await prisma.settlement.findFirst({
    where: sheetScope,
    orderBy: { revision: "desc" },
    select: { revision: true },
  });

  const { policy, fee, result, totals, sheet, assignment } = facts;

  const data = {
    teachingAssignmentId: body.teachingAssignmentId,
    attendanceSheetId: body.attendanceSheetId,
    academicYearId: assignment.academicYearId,
    teacherId: assignment.teacherId,
    policyId: policy.id,

    methodSnapshot: policy.method,
    countBasisSnapshot: policy.countBasis,
    roundingModeSnapshot: policy.roundingMode,
    roundingPrecisionSnapshot: policy.roundingPrecision,
    percentageSnapshot: policy.teacherPercentage,
    perStudentSnapshot: policy.amountPerStudent,
    perSessionSnapshot: policy.amountPerSession,

    tuitionSnapshot: fee.amount,
    approvedSessionsSnapshot: sheet.sessionCount,
    completedSessionsSnapshot: totals.completedSessions,
    studentCountSnapshot: totals.enrolledCount,
    paidStudentCountSnapshot: totals.paidCount,
    // الوحدات التي أنتجت المبلغ — لا الحضور الخام. فاللقطة تُفسّر
    // الرقم، ومَن راجع الكشف بعد سنة يقسم المبلغ عليها فيخرج له
    // قيمةُ الوحدة بلا حاجة إلى إعادة تصفية الحضور.
    attendedUnitsSnapshot: result.countedUnits,
    grossTuitionSnapshot: totals.grossTuition,
    collectedSnapshot: totals.collected,
    remainingSnapshot: totals.remaining,

    teacherAmount: result.teacherAmount,
    note: body.note ?? null,
  };

  const settlement = await prisma.$transaction(async (tx) => {
    if (existing) {
      // إعادة الحساب: الأسطر القديمة تُمحى بالكامل ثم تُبنى من جديد،
      // فلا تبقى أسطرُ حصةٍ حُذفت من الكشف
      await tx.settlementLine.deleteMany({
        where: { settlementId: existing.id },
      });

      const updated = await tx.settlement.update({
        where: { id: existing.id },
        data: { ...data, computedAt: new Date() },
        select: settlementSelect,
      });

      await tx.settlementLine.createMany({
        data: result.lines.map((line) => ({
          settlementId: existing.id,
          ...line,
        })),
      });

      return updated;
    }

    const sequence = (await lastSequence(facts.referenceDate.getUTCFullYear())) + 1;

    const created = await tx.settlement.create({
      data: {
        ...data,
        revision: (lastRevision?.revision ?? 0) + 1,
        settlementNumber: buildSettlementNumber(
          facts.referenceDate.getUTCFullYear(),
          sequence,
        ),
      },
      select: settlementSelect,
    });

    await tx.settlementLine.createMany({
      data: result.lines.map((line) => ({
        settlementId: created.id,
        ...line,
      })),
    });

    return created;
  });

  await recordAudit({
    entity: "Settlement",
    entityId: settlement.id,
    action: existing ? "RECOMPUTE" : "CREATE",
    field: "teacherAmount",
    newValue: String(result.teacherAmount),
    userId,
  });

  return toResponse(settlement);
};

// --------------------------------------------------
// List / Get
// --------------------------------------------------

export const listSettlementsService = async (query: SettlementQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.SettlementWhereInput = {
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.teachingAssignmentId && {
      teachingAssignmentId: query.teachingAssignmentId,
    }),
    ...(query.attendanceSheetId && {
      attendanceSheetId: query.attendanceSheetId,
    }),
    ...(query.status && { status: query.status }),
  };

  const [settlements, total] = await Promise.all([
    prisma.settlement.findMany({
      where,
      select: settlementSelect,
      skip,
      take,
      orderBy: { computedAt: "desc" },
    }),
    prisma.settlement.count({ where }),
  ]);

  return {
    settlements: settlements.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

export const getSettlementService = async (id: string) => {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    select: {
      ...settlementSelect,
      lines: { select: lineSelect, orderBy: { lessonNumber: "asc" } },
    },
  });

  if (!settlement) {
    throw new NotFoundException(
      "Settlement not found",
      ErrorCodeEnum.SETTLEMENT_NOT_FOUND,
    );
  }

  return {
    ...toResponse(settlement),
    lines: settlement.lines.map(toLineResponse),
  };
};

// --------------------------------------------------
// Confirm — التجميد
//
// بعده لا إعادة حساب ولا تعديل. وهذا هو الحاجز الذي يجعل §21 قابلاً
// للتطبيق: التاريخ المالي لا يتغيّر لأن تغييره ممنوع بنيوياً لا
// موصى بتجنّبه.
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const settlement = await prisma.settlement.findUnique({
    where: { id },
    select: { id: true, status: true, settlementNumber: true, teacherAmount: true },
  });

  if (!settlement) {
    throw new NotFoundException(
      "Settlement not found",
      ErrorCodeEnum.SETTLEMENT_NOT_FOUND,
    );
  }

  return settlement;
};

export const confirmSettlementService = async (
  id: string,
  body: ConfirmSettlementInput,
  userId: string,
) => {
  const existing = await findOrThrow(id);

  if (existing.status !== "DRAFT") {
    throw new ConflictException(
      `Only draft settlements can be confirmed (currently ${existing.status})`,
      ErrorCodeEnum.SETTLEMENT_LOCKED,
    );
  }

  const settlement = await prisma.settlement.update({
    where: { id },
    data: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedById: userId,
      ...(body.note !== undefined && { note: body.note }),
    },
    select: settlementSelect,
  });

  await recordAudit({
    entity: "Settlement",
    entityId: id,
    action: "CONFIRM",
    field: "status",
    oldValue: "DRAFT",
    newValue: "CONFIRMED",
    userId,
  });

  return toResponse(settlement);
};

/** التسليم الفعلي للأستاذ */
export const paySettlementService = async (id: string, userId: string) => {
  const existing = await findOrThrow(id);

  if (existing.status !== "CONFIRMED") {
    throw new ConflictException(
      `Only confirmed settlements can be marked paid (currently ${existing.status})`,
      ErrorCodeEnum.SETTLEMENT_LOCKED,
    );
  }

  const settlement = await prisma.settlement.update({
    where: { id },
    data: { status: "PAID", paidAt: new Date(), paidById: userId },
    select: settlementSelect,
  });

  await recordAudit({
    entity: "Settlement",
    entityId: id,
    action: "UPDATE",
    field: "status",
    oldValue: "CONFIRMED",
    newValue: "PAID",
    userId,
  });

  return toResponse(settlement);
};

// --------------------------------------------------
// Cancel — التصحيح الوحيد المتاح بعد التأكيد
//
// التخليص لا يُحذف: إثباتُ ما استُحقّ يبقى ولو أُلغي، ويُوثَّق مَن
// ألغى ومتى ولماذا. ثم يُحسب بديلٌ جديد.
// --------------------------------------------------

export const cancelSettlementService = async (
  id: string,
  body: CancelSettlementInput,
  userId: string,
) => {
  const existing = await findOrThrow(id);

  if (existing.status === "CANCELLED") {
    throw new ConflictException(
      "Settlement is already cancelled",
      ErrorCodeEnum.SETTLEMENT_LOCKED,
    );
  }

  const settlement = await prisma.settlement.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledById: userId,
      cancelReason: body.cancelReason,
    },
    select: settlementSelect,
  });

  await recordAudit({
    entity: "Settlement",
    entityId: id,
    action: "CANCEL",
    field: "status",
    oldValue: existing.status,
    newValue: "CANCELLED",
    reason: body.cancelReason,
    userId,
  });

  return toResponse(settlement);
};
