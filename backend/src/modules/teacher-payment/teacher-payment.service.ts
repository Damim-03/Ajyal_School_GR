import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { uniqueDocumentNumber } from "../../core/utils/document-number";
import { gatherSettlementFacts } from "../settlement/settlement.service";
import {
  CancelTeacherPaymentInput,
  PayTeacherInput,
  TeacherPaymentQueryInput,
} from "./teacher-payment.schema";

/**
 * دفعُ الأستاذ — إثباتٌ واحد لكلّ ما استحقّه.
 *
 * التخليص واحدٌ لكل (إسناد + كشف): مادةٌ وفوجٌ وشهر. والأستاذ يدرّس
 * ثلاثة أفواج، فكان إثباتُ الدفع ثلاثَ عمليّاتٍ وثلاثَ أوراق. وهذا
 * يجمعها: دفعةٌ برقمها، موزَّعةٌ على تخليصاتها بـ`TeacherPaymentAllocation`.
 *
 * وثلاثة أشياء تقع **معاً أو لا تقع**: الدفعة، وتحويلُ التخليصات إلى
 * «مدفوع»، ولقطةُ الكشفين. فلو نجح الأوّل وسقط الثالث لبقي في الأرشيف
 * دفعٌ بلا ورقةٍ تُقرأ.
 */

/*
 * `Prisma.validator` لا كائنٌ حرّ.
 *
 * الاختيار المرفوع إلى ثابتٍ خارج الاستدعاء يفقد تحقّق الأنواع: كتبتُ
 * `fullName` على `User` — ولا وجودَ له — فمرّ `tsc` صامتاً وسقط
 * الطلب في وجه المستخدم. والمُصادِق يعيد التحقّق إلى وقت الترجمة.
 */
const paymentSelect = Prisma.validator<Prisma.TeacherPaymentSelect>()({
  id: true,
  paymentNumber: true,
  teacherId: true,
  amount: true,
  paymentMethod: true,
  paymentDate: true,
  reference: true,
  note: true,
  status: true,
  cancelledAt: true,
  cancelReason: true,
  createdAt: true,
  teacher: { select: { id: true, firstName: true, lastName: true, phone: true } },
  paidBy: { select: { id: true, firstName: true, lastName: true } },
  cancelledBy: { select: { id: true, firstName: true, lastName: true } },
  allocations: {
    select: {
      id: true,
      amount: true,
      /* حصةُ دَينٍ محصَّل — بمصدرها: أيُّ كشفٍ نشأ فيه وأيُّ طالبٍ سدّده */
      teacherDebtShare: {
        select: {
          id: true,
          shareAmount: true,
          collectedAmount: true,
          attendedUnits: true,
          debtCollection: {
            select: {
              originalMonth: true,
              originalYear: true,
              collectedAt: true,
              invoice: {
                select: {
                  studentEnrollment: {
                    select: {
                      student: { select: { id: true, firstName: true, lastName: true } },
                    },
                  },
                },
              },
            },
          },
          originalSettlement: {
            select: {
              id: true,
              settlementNumber: true,
              attendanceSheet: {
                select: { id: true, code: true, number: true, label: true },
              },
              teachingAssignment: {
                select: {
                  id: true,
                  subject: { select: { id: true, name: true } },
                  studyGroup: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
      settlement: {
        select: {
          id: true,
          settlementNumber: true,
          teacherAmount: true,
          status: true,
          attendanceSheet: {
            select: { id: true, code: true, number: true, label: true },
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
        },
      },
    },
  },
});

/**
 * لقطةُ الكشفين — الورقة كما وُقّع عليها.
 *
 * `SettlementLine` يحفظ الكشف التقديري. وهذان الآخران معطياتُهما حيّة:
 * حضورٌ يُصحَّح، ودَينٌ يُسدَّد. فتُجمَّد صورتُهما هنا.
 *
 * ولا تُحفظ أسماءُ الأعمدة ولا تنسيقُها — بل ما يُبنى منه الكشفان:
 * الحصصُ بتواريخها، وحضورُ كلِّ مسجَّل، وحالتُه المالية.
 */
const buildSnapshot = async (
  teachingAssignmentId: string,
  attendanceSheetId: string,
) => {
  const facts = await gatherSettlementFacts(teachingAssignmentId, attendanceSheetId);

  const header = {
    subject: facts.assignment.subject,
    teacher: facts.assignment.teacher,
    studyGroup: facts.assignment.studyGroup,
    sheet: {
      id: facts.sheet.id,
      number: facts.sheet.number,
      label: facts.sheet.label,
      sessionCount: facts.sheet.sessionCount,
    },
  };

  const dailySheet = {
    header,
    sessions: facts.sheet.sessions.map((session) => ({
      id: session.id,
      lessonNumber: session.lessonNumber,
      sessionDate: session.sessionDate,
      status: session.status,
      marks: session.attendances.map((mark) => ({
        studentEnrollmentId: mark.studentEnrollmentId,
        status: mark.status,
      })),
    })),
    students: facts.students.map((row) => ({
      enrollmentId: row.enrollmentId,
      student: row.student,
      attended: row.attended,
      late: row.late,
      absent: row.absent,
      excused: row.excused,
      blank: row.blank,
      present: row.present,
    })),
  };

  const monthlyFees = {
    header,
    tuition: facts.fee.amount,
    students: facts.students.map((row) => ({
      enrollmentId: row.enrollmentId,
      student: row.student,
      present: row.present,
      absent: row.absent,
      blank: row.blank,
      invoice: row.invoice,
      defaulter: row.defaulter,
      uninvoiced: row.uninvoiced,
    })),
    totals: facts.totals,
  };

  return { dailySheet, monthlyFees };
};

// --------------------------------------------------
// Pay — إثبات الدفع
// --------------------------------------------------

export const payTeacherService = async (body: PayTeacherInput, userId: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: body.teacherId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!teacher) {
    throw new NotFoundException("Teacher not found", ErrorCodeEnum.RESOURCE_NOT_FOUND);
  }

  const settlements = await prisma.settlement.findMany({
    where: { id: { in: body.settlementIds } },
    select: {
      id: true,
      teacherId: true,
      status: true,
      teacherAmount: true,
      settlementNumber: true,
      teachingAssignmentId: true,
      attendanceSheetId: true,
    },
  });

  if (settlements.length !== body.settlementIds.length) {
    throw new NotFoundException(
      "One or more settlements were not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  /* أستاذٌ واحد: دفعةٌ تخلط تخليصات أستاذين لا معنى لورقتها */
  const stranger = settlements.find((s) => s.teacherId !== body.teacherId);

  if (stranger) {
    throw new BadRequestException(
      `Settlement ${stranger.settlementNumber} belongs to another teacher`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  /*
   * المؤكَّد وحده يُدفع.
   *
   * المسوّدة رقمٌ لم يُراجَع بعد، والمدفوعُ دُفع مرّة — وإعادتُه دفعٌ
   * مزدوج لا يكشفه إلّا الجرد.
   */
  const notReady = settlements.find((s) => s.status !== "CONFIRMED");

  if (notReady) {
    throw new ConflictException(
      `Settlement ${notReady.settlementNumber} is ${notReady.status.toLowerCase()} — only confirmed settlements can be paid`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  /*
   * حصصُ الديون المحصَّلة — تُدفع مع الراتب لا وحدها.
   *
   * والمدفوعةُ لا تُدفع ثانيةً، والملغاة لا تُدفع أصلاً: يُقبل
   * المعلَّقُ والمعتمد وحدهما.
   */
  const shares =
    body.debtShareIds.length > 0
      ? await prisma.teacherDebtShare.findMany({
          where: { id: { in: body.debtShareIds } },
          select: { id: true, teacherId: true, status: true, shareAmount: true },
        })
      : [];

  if (shares.length !== body.debtShareIds.length) {
    throw new NotFoundException(
      "One or more debt shares were not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  const strangeShare = shares.find((s) => s.teacherId !== body.teacherId);

  if (strangeShare) {
    throw new BadRequestException(
      "A selected debt share belongs to another teacher",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const settledShare = shares.find(
    (s) => s.status !== "PENDING" && s.status !== "APPROVED",
  );

  if (settledShare) {
    throw new ConflictException(
      `Debt share is ${settledShare.status.toLowerCase()} — it cannot be paid`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const amount = [
    ...settlements.map((s) => s.teacherAmount),
    ...shares.map((s) => s.shareAmount),
  ].reduce((sum, value) => sum.add(value), new Prisma.Decimal(0));

  /* اللقطات تُبنى قبل المعاملة — استعلاماتٌ طويلة لا تُحبس فيها الصفوف */
  const snapshots = await Promise.all(
    settlements.map(async (settlement) => ({
      settlementId: settlement.id,
      ...(await buildSnapshot(
        settlement.teachingAssignmentId,
        settlement.attendanceSheetId,
      )),
    })),
  );

  const paidAt = body.paymentDate ?? new Date();

  const payment = await prisma.$transaction(async (tx) => {
    const number = await uniqueDocumentNumber(
      async (candidate) =>
        (await tx.teacherPayment.count({ where: { paymentNumber: candidate } })) > 0,
    );

    if (!number) {
      throw new ConflictException(
        "Could not allocate a payment number",
        ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
      );
    }

    const created = await tx.teacherPayment.create({
      data: {
        paymentNumber: number,
        teacherId: body.teacherId,
        amount,
        paymentMethod: body.paymentMethod,
        paymentDate: paidAt,
        reference: body.reference ?? null,
        note: body.note ?? null,
        paidById: userId,
        allocations: {
          create: [
            ...settlements.map((s) => ({
              settlementId: s.id,
              amount: s.teacherAmount,
            })),
            ...shares.map((s) => ({
              teacherDebtShareId: s.id,
              amount: s.shareAmount,
            })),
          ],
        },
      },
      select: { id: true },
    });

    await tx.settlement.updateMany({
      where: { id: { in: settlements.map((s) => s.id) } },
      data: { status: "PAID", paidAt, paidById: userId },
    });

    if (shares.length > 0) {
      /*
       * تُعتمد وتُدفع في خطوةٍ واحدة: أخذُ مال الطالب واعتمادُ حصة
       * أستاذه قرارٌ واحد اتّخذه من ضغط «إثبات الدفع».
       *
       * و`collectionSettlementId` يقيّد أيَّ راتبٍ حملها — فيُقرأ في
       * الأرشيف «متأخّراتٌ دُفعت مع تخليص الشهر 2».
       */
      await tx.teacherDebtShare.updateMany({
        where: { id: { in: shares.map((s) => s.id) } },
        data: {
          status: "PAID",
          approvedAt: paidAt,
          approvedById: userId,
          paidAt,
          ...(settlements[0] ? { collectionSettlementId: settlements[0].id } : {}),
        },
      });
    }

    for (const snapshot of snapshots) {
      await tx.settlementSnapshot.upsert({
        where: { settlementId: snapshot.settlementId },
        create: {
          settlementId: snapshot.settlementId,
          dailySheet: snapshot.dailySheet as Prisma.InputJsonValue,
          monthlyFees: snapshot.monthlyFees as Prisma.InputJsonValue,
        },
        update: {
          dailySheet: snapshot.dailySheet as Prisma.InputJsonValue,
          monthlyFees: snapshot.monthlyFees as Prisma.InputJsonValue,
        },
      });
    }

    return created;
  });

  return getTeacherPaymentService(payment.id);
};

// --------------------------------------------------
// List & Get
// --------------------------------------------------

export const listTeacherPaymentsService = async (query: TeacherPaymentQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.TeacherPaymentWhereInput = {
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.status && { status: query.status }),
    ...((query.dateFrom || query.dateTo) && {
      paymentDate: {
        ...(query.dateFrom && { gte: query.dateFrom }),
        ...(query.dateTo && { lte: query.dateTo }),
      },
    }),
    /* السنة الدراسية تُقرأ من تخليصات الدفعة — لا حقلَ لها عليها */
    ...(query.academicYearId && {
      allocations: {
        some: { settlement: { academicYearId: query.academicYearId } },
      },
    }),
  };

  const [payments, total] = await Promise.all([
    prisma.teacherPayment.findMany({
      where,
      select: paymentSelect,
      skip,
      take,
      orderBy: { paymentDate: "desc" },
    }),
    prisma.teacherPayment.count({ where }),
  ]);

  return { payments, pagination: buildPagination(total, page, limit) };
};

export const getTeacherPaymentService = async (id: string) => {
  const payment = await prisma.teacherPayment.findUnique({
    where: { id },
    select: paymentSelect,
  });

  if (!payment) {
    throw new NotFoundException(
      "Teacher payment not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  return payment;
};

// --------------------------------------------------
// Cancel — الدفعة لا تُحذف
// --------------------------------------------------

export const cancelTeacherPaymentService = async (
  id: string,
  body: CancelTeacherPaymentInput,
  userId: string,
) => {
  const payment = await prisma.teacherPayment.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      allocations: { select: { settlementId: true, teacherDebtShareId: true } },
    },
  });

  if (!payment) {
    throw new NotFoundException(
      "Teacher payment not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  if (payment.status === "CANCELLED") {
    throw new ConflictException(
      "Payment is already cancelled",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.teacherPayment.update({
      where: { id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelledById: userId,
        cancelReason: body.reason,
      },
    });

    /*
     * التخليصات تعود «مؤكَّدة» لا «مسوّدة»: الحساب صحيحٌ وموقَّع، وإنّما
     * بطل التسليم. واللقطةُ تبقى — أثرُ ما وُقّع عليه لا يُمحى بإلغاء.
     */
    const settlementIds = payment.allocations
      .map((a) => a.settlementId)
      .filter((value): value is string => Boolean(value));

    if (settlementIds.length > 0) {
      await tx.settlement.updateMany({
        where: { id: { in: settlementIds } },
        data: { status: "CONFIRMED", paidAt: null, paidById: null },
      });
    }

    /* وحصصُ الديون تعود «معتمدة» تنتظر دفعاً آخر — الحساب صحيحٌ وإنّما بطل التسليم */
    const shareIds = payment.allocations
      .map((a) => a.teacherDebtShareId)
      .filter((value): value is string => Boolean(value));

    if (shareIds.length > 0) {
      await tx.teacherDebtShare.updateMany({
        where: { id: { in: shareIds } },
        data: { status: "APPROVED", paidAt: null, collectionSettlementId: null },
      });
    }
  });

  return getTeacherPaymentService(id);
};
