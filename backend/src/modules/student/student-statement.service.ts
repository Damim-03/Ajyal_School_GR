import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";

/**
 * كشفُ حساب الطالب — سنةٌ كاملة في ورقةٍ واحدة.
 *
 * الوليُّ يسأل سؤالاً واحداً: «ماذا على ابني وماذا دفع؟» وكان جوابُه
 * يُجمع من ثلاث شاشات — الحضور من كشفه، والحقّ من الفواتير، والإيصال
 * من المالية — فيُقرأ ثلاث مرّات ويُخطأ فيه مرّة. فهذه الورقة تجمعها
 * في سطرٍ لكلّ شهر: حضورُه وغيابُه، وحقُّ الشهر وما سُدّد منه وما بقي،
 * ورقمُ الإيصال الذي يُثبت السداد.
 *
 * **وسطرُها وحدةٌ واحدة: (تسجيلٌ في مادة × كشفُ شهر).** فالطالب
 * المسجَّل في مادّتين له سطران في الشهر الواحد، لكلٍّ أستاذُه وفوجُه
 * وحقُّه — والجمعُ في سطرٍ واحد يُخفي أيَّ المادّتين لم تُسدَّد.
 *
 * ونسبةُ الفاتورة إلى كشفها تُقرأ من `Invoice.attendanceSheetId` لا
 * بمطابقةِ شهرٍ محسوبةٍ هنا: الكشف يمتدّ على شهرين بطبعه، والمطابقةُ
 * بالشهر تُخطئ حتماً حين يتقاسمه كشفان (انظر `monthSheet` في
 * `invoice.service`).
 */

type StatementRow = {
  sheetId: string;
  sheetCode: string;
  sheetNumber: number;
  sheetLabel: string | null;
  /** شهرُ أوّل حصة وسنتُها — ترتيبُ الورقة عليهما */
  month: number | null;
  year: number | null;
  firstSession: Date | null;
  lastSession: Date | null;
  subject: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string };
  studyGroup: { id: string; name: string };
  /** الحصص المنجزة في الكشف — عليها يُقرأ الحضور والغياب */
  completedSessions: number;
  attended: number;
  absent: number;
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    paid: number;
    remaining: number;
    status: string;
  } | null;
  receipts: {
    receiptNumber: string;
    paidAmount: number;
    paymentDate: Date;
  }[];
};

const num = (value: unknown) => Number(value);

export const getStudentStatementService = async (
  studentId: string,
  academicYearId: string,
) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    /* الحقول تُقيَّد بنوعها: قائمةٌ حرّة تمرّ من tsc وتسقط عند التشغيل */
    select: Prisma.validator<Prisma.StudentSelect>()({
      id: true,
      studentNumber: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      phone: true,
      parentPhone: true,
      level: { select: { id: true, name: true } },
    }),
  });

  if (!student) {
    throw new NotFoundException(
      "Student not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  const academicYear = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true, name: true, startDate: true, endDate: true },
  });

  if (!academicYear) {
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: { studentId, teachingAssignment: { academicYearId } },
    select: {
      id: true,
      teachingAssignmentId: true,
      teachingAssignment: {
        select: {
          id: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          studyGroup: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (enrollments.length === 0) {
    return {
      student,
      academicYear,
      rows: [] as StatementRow[],
      totals: {
        sheets: 0,
        completedSessions: 0,
        attended: 0,
        absent: 0,
        due: 0,
        paid: 0,
        remaining: 0,
      },
    };
  }

  const enrollmentIds = enrollments.map((e) => e.id);
  const assignmentIds = enrollments.map((e) => e.teachingAssignmentId);

  const [sheets, marks, invoices] = await Promise.all([
    prisma.attendanceSheet.findMany({
      where: { teachingAssignmentId: { in: assignmentIds }, academicYearId },
      select: {
        id: true,
        code: true,
        number: true,
        label: true,
        teachingAssignmentId: true,
        sessions: {
          where: { status: { not: "CANCELLED" } },
          select: { id: true, sessionDate: true, status: true },
          orderBy: { sessionDate: "asc" },
        },
      },
      orderBy: { number: "asc" },
    }),

    /*
     * علاماتُ الحضور كلُّها دفعةً واحدة ثمّ تُوزَّع في الذاكرة.
     *
     * والبديل استعلامٌ لكلّ (تسجيل × كشف) — عشراتُ الرحلات لورقةٍ
     * واحدة، وكلُّها على فهرسٍ واحد.
     */
    prisma.attendance.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        session: { sheetId: { not: null } },
      },
      select: {
        studentEnrollmentId: true,
        status: true,
        session: { select: { sheetId: true } },
      },
    }),

    prisma.invoice.findMany({
      where: {
        studentEnrollmentId: { in: enrollmentIds },
        status: { not: "CANCELLED" },
      },
      select: {
        id: true,
        invoiceNumber: true,
        total: true,
        remaining: true,
        status: true,
        attendanceSheetId: true,
        studentEnrollmentId: true,
        paymentInvoices: {
          select: {
            paidAmount: true,
            payment: {
              select: {
                paymentDate: true,
                status: true,
                receipt: { select: { receiptNumber: true, status: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
  ]);

  /* الحضور: (تسجيل|كشف) → حاضر/غائب */
  const attendanceBy = new Map<string, { attended: number; absent: number }>();

  for (const mark of marks) {
    const sheetId = mark.session.sheetId;

    if (!sheetId) continue;

    const key = `${mark.studentEnrollmentId}|${sheetId}`;
    const tally = attendanceBy.get(key) ?? { attended: 0, absent: 0 };

    /* الحاضرُ والمتأخّر كلاهما حضور — والمقياس نفسه في حساب حصص الدَّين */
    if (mark.status === "PRESENT" || mark.status === "LATE") tally.attended += 1;
    else if (mark.status === "ABSENT") tally.absent += 1;

    attendanceBy.set(key, tally);
  }

  /* الفاتورة: (تسجيل|كشف) → فاتورةٌ واحدة */
  const invoiceBy = new Map<string, (typeof invoices)[number]>();

  for (const invoice of invoices) {
    if (!invoice.attendanceSheetId) continue;

    invoiceBy.set(
      `${invoice.studentEnrollmentId}|${invoice.attendanceSheetId}`,
      invoice,
    );
  }

  const byAssignment = new Map(enrollments.map((e) => [e.teachingAssignmentId, e]));

  const rows: StatementRow[] = [];

  for (const sheet of sheets) {
    const enrollment = byAssignment.get(sheet.teachingAssignmentId);

    if (!enrollment) continue;

    const key = `${enrollment.id}|${sheet.id}`;
    const tally = attendanceBy.get(key) ?? { attended: 0, absent: 0 };
    const invoice = invoiceBy.get(key) ?? null;

    const first = sheet.sessions[0]?.sessionDate ?? null;
    const last = sheet.sessions[sheet.sessions.length - 1]?.sessionDate ?? null;

    /*
     * الإيصالات — من دفعاتٍ سارية وحدها.
     *
     * الدفعةُ الملغاة يبقى سطرُها في `PaymentInvoice` للتدقيق، وعرضُ
     * رقم إيصالها في كشف حسابٍ يُثبت سداداً رُدَّ.
     */
    const receipts = (invoice?.paymentInvoices ?? [])
      .filter(
        (line) =>
          line.payment.status !== "CANCELLED" &&
          line.payment.receipt &&
          line.payment.receipt.status !== "CANCELLED",
      )
      .map((line) => ({
        receiptNumber: line.payment.receipt!.receiptNumber,
        paidAmount: num(line.paidAmount),
        paymentDate: line.payment.paymentDate,
      }));

    const total = invoice ? num(invoice.total) : 0;
    const remaining = invoice ? num(invoice.remaining) : 0;

    rows.push({
      sheetId: sheet.id,
      sheetCode: sheet.code,
      sheetNumber: sheet.number,
      sheetLabel: sheet.label,
      month: first ? first.getUTCMonth() + 1 : null,
      year: first ? first.getUTCFullYear() : null,
      firstSession: first,
      lastSession: last,
      subject: enrollment.teachingAssignment.subject,
      teacher: enrollment.teachingAssignment.teacher,
      studyGroup: enrollment.teachingAssignment.studyGroup,
      completedSessions: sheet.sessions.filter((s) => s.status === "COMPLETED")
        .length,
      attended: tally.attended,
      absent: tally.absent,
      invoice: invoice
        ? {
            id: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            total,
            paid: total - remaining,
            remaining,
            status: invoice.status,
          }
        : null,
      receipts,
    });
  }

  /* الترتيب بالزمن لا برقم الكشف: مادّتان لهما ترقيمٌ مستقلّ */
  rows.sort((a, b) => {
    const at = a.firstSession?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bt = b.firstSession?.getTime() ?? Number.MAX_SAFE_INTEGER;

    if (at !== bt) return at - bt;

    return a.subject.name.localeCompare(b.subject.name, "ar");
  });

  const totals = rows.reduce(
    (sum, row) => ({
      sheets: sum.sheets + 1,
      completedSessions: sum.completedSessions + row.completedSessions,
      attended: sum.attended + row.attended,
      absent: sum.absent + row.absent,
      due: sum.due + (row.invoice?.total ?? 0),
      paid: sum.paid + (row.invoice?.paid ?? 0),
      remaining: sum.remaining + (row.invoice?.remaining ?? 0),
    }),
    {
      sheets: 0,
      completedSessions: 0,
      attended: 0,
      absent: 0,
      due: 0,
      paid: 0,
      remaining: 0,
    },
  );

  return { student, academicYear, rows, totals };
};
