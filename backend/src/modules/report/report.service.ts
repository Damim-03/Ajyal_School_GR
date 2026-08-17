import { Prisma, DayOfWeek } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  startOfUtcDay,
  addUtcDays,
  formatTime,
  DAY_OF_WEEK_INDEX,
} from "../../core/utils/time";
import {
  FinancialReportQuery,
  OutstandingReportQuery,
  AttendanceReportQuery,
  DailyAttendanceReportQuery,
  MonthlyFeesReportQuery,
  SessionClearanceReportQuery,
  ExpectedSessionsReportQuery,
} from "./report.schema";

const toNumber = (value: Prisma.Decimal | null | undefined) =>
  value ? Number(value) : 0;

/** مدى تاريخي شامل ليوم النهاية */
const dateRange = (from?: Date, to?: Date) => {
  if (!from && !to) return undefined;

  return {
    ...(from && { gte: startOfUtcDay(from) }),
    ...(to && { lt: addUtcDays(startOfUtcDay(to), 1) }),
  };
};

// --------------------------------------------------
// Dashboard — أرقام الصفحة الرئيسية
// --------------------------------------------------

export const dashboardReportService = async () => {
  const currentYear = await prisma.academicYear.findFirst({
    where: { isCurrent: true },
    select: { id: true, name: true },
  });

  const now = new Date();
  const month = now.getUTCMonth() + 1;
  const year = now.getUTCFullYear();

  const [
    students,
    teachers,
    studyGroups,
    activeEnrollments,
    monthInvoices,
    monthCollected,
    outstanding,
  ] = await Promise.all([
    prisma.student.count({ where: { isActive: true } }),
    prisma.teacher.count({ where: { isActive: true } }),
    prisma.studyGroup.count({ where: { isActive: true } }),
    prisma.studentEnrollment.count({
      where: {
        isActive: true,
        ...(currentYear && {
          teachingAssignment: { academicYearId: currentYear.id },
        }),
      },
    }),
    prisma.invoice.aggregate({
      where: { month, year, status: { not: "CANCELLED" } },
      _sum: { total: true, remaining: true },
      _count: true,
    }),
    prisma.paymentInvoice.aggregate({
      where: {
        payment: { status: "ACTIVE" },
        invoice: { month, year },
      },
      _sum: { paidAmount: true },
    }),
    prisma.invoice.aggregate({
      where: {
        status: { not: "CANCELLED" },
        remaining: { gt: 0 },
        ...(currentYear && { academicYearId: currentYear.id }),
      },
      _sum: { remaining: true },
      _count: true,
    }),
  ]);

  return {
    academicYear: currentYear,
    counts: {
      activeStudents: students,
      activeTeachers: teachers,
      activeStudyGroups: studyGroups,
      activeEnrollments,
    },
    currentMonth: {
      month,
      year,
      invoiceCount: monthInvoices._count,
      invoiced: toNumber(monthInvoices._sum.total),
      collected: toNumber(monthCollected._sum.paidAmount),
      remaining: toNumber(monthInvoices._sum.remaining),
    },
    outstanding: {
      invoiceCount: outstanding._count,
      amount: toNumber(outstanding._sum.remaining),
    },
  };
};

// --------------------------------------------------
// Financial — المفوتَر والمحصَّل والمتبقّي
//
// المفوتَر يُقاس بتاريخ الاستحقاق، والمحصَّل بتاريخ
// الدفع، لأنهما حدثان مختلفان زمنياً.
// --------------------------------------------------

export const financialReportService = async (query: FinancialReportQuery) => {
  const invoiceWhere: Prisma.InvoiceWhereInput = {
    status: { not: "CANCELLED" },
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(dateRange(query.dateFrom, query.dateTo) && {
      dueDate: dateRange(query.dateFrom, query.dateTo),
    }),
  };

  const paymentWhere: Prisma.PaymentWhereInput = {
    status: "ACTIVE",
    ...(dateRange(query.dateFrom, query.dateTo) && {
      paymentDate: dateRange(query.dateFrom, query.dateTo),
    }),
    ...(query.academicYearId && {
      paymentInvoices: {
        some: { invoice: { academicYearId: query.academicYearId } },
      },
    }),
  };

  const [invoiced, collected, byMonth, byMethod, cancelled, collectedRows] = await Promise.all([
    prisma.invoice.aggregate({
      where: invoiceWhere,
      _sum: { total: true, discount: true, remaining: true },
      _count: true,
    }),
    prisma.payment.aggregate({
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ["year", "month"],
      where: invoiceWhere,
      _sum: { total: true, remaining: true },
      _count: true,
      orderBy: [{ year: "asc" }, { month: "asc" }],
    }),
    prisma.payment.groupBy({
      by: ["paymentMethod"],
      where: paymentWhere,
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.aggregate({
      where: {
        status: "CANCELLED",
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
      },
      _count: true,
    }),
    prisma.payment.findMany({
      where: paymentWhere,
      select: { amount: true, paymentDate: true },
      orderBy: { paymentDate: "asc" },
    }),
  ]);

  const totalInvoiced = toNumber(invoiced._sum.total);
  const totalRemaining = toNumber(invoiced._sum.remaining);

  return {
    summary: {
      invoiceCount: invoiced._count,
      invoiced: totalInvoiced,
      discounts: toNumber(invoiced._sum.discount),
      collected: totalInvoiced - totalRemaining,
      remaining: totalRemaining,
      collectionRate:
        totalInvoiced > 0
          ? Math.round(((totalInvoiced - totalRemaining) / totalInvoiced) * 10000) / 100
          : 0,
      cancelledInvoices: cancelled._count,
    },
    payments: {
      count: collected._count,
      total: toNumber(collected._sum.amount),
    },
    byMonth: byMonth.map((row) => ({
      year: row.year,
      month: row.month,
      invoiceCount: row._count,
      invoiced: toNumber(row._sum.total),
      remaining: toNumber(row._sum.remaining),
      collected: toNumber(row._sum.total) - toNumber(row._sum.remaining),
    })),
    byPaymentMethod: byMethod.map((row) => ({
      paymentMethod: row.paymentMethod,
      count: row._count,
      total: toNumber(row._sum.amount),
    })),
    // المحصَّل موزَّعاً على الزمن بالدقّة المطلوبة —
    // هذا ما يجعل «التقرير اليومي» و«الشهري» و«السنوي» تقريراً واحداً
    groupBy: query.groupBy,
    collectedSeries: buildSeries(collectedRows, query.groupBy),
  };
};

// --------------------------------------------------
// تجميع المدفوعات على الزمن
//
// التجميع في JS لا في SQL: الدقّات الثلاث تحتاج دوال
// تاريخ مختلفة، وحجم دفعات مركزٍ في سنة لا يبرّر raw SQL.
// --------------------------------------------------

const periodKey = (date: Date, groupBy: "day" | "month" | "year"): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  if (groupBy === "year") return `${year}`;
  if (groupBy === "month") return `${year}-${month}`;

  return `${year}-${month}-${day}`;
};

const buildSeries = (
  rows: { amount: Prisma.Decimal; paymentDate: Date }[],
  groupBy: "day" | "month" | "year",
) => {
  const buckets = new Map<string, { period: string; count: number; total: number }>();

  for (const row of rows) {
    const period = periodKey(row.paymentDate, groupBy);
    const bucket = buckets.get(period);

    if (bucket) {
      bucket.count++;
      bucket.total += toNumber(row.amount);
    } else {
      buckets.set(period, { period, count: 1, total: toNumber(row.amount) });
    }
  }

  return [...buckets.values()].sort((a, b) => a.period.localeCompare(b.period));
};

// --------------------------------------------------
// Outstanding — من عليه مستحقات
// --------------------------------------------------

export const outstandingReportService = async (
  query: OutstandingReportQuery,
) => {
  const where: Prisma.InvoiceWhereInput = {
    status: { not: "CANCELLED" },
    remaining: { gt: 0 },
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.overdueOnly && { dueDate: { lt: startOfUtcDay(new Date()) } }),
    ...(query.studyGroupId && {
      studentEnrollment: {
        teachingAssignment: { studyGroupId: query.studyGroupId },
      },
    }),
  };

  const invoices = await prisma.invoice.findMany({
    where,
    select: {
      id: true,
      invoiceNumber: true,
      month: true,
      year: true,
      total: true,
      remaining: true,
      dueDate: true,
      status: true,
      studentEnrollment: {
        select: {
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              parentPhone: true,
            },
          },
          teachingAssignment: {
            select: {
              subject: { select: { id: true, name: true } },
              studyGroup: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
    orderBy: { dueDate: "asc" },
    take: query.limit,
  });

  // تجميع حسب الطالب — الفرونت يعرض دَيناً واحداً لكل طالب
  const byStudent = new Map<
    string,
    {
      student: { id: string; firstName: string; lastName: string; parentPhone: string };
      invoiceCount: number;
      totalRemaining: number;
      oldestDueDate: Date;
    }
  >();

  for (const invoice of invoices) {
    const student = invoice.studentEnrollment.student;
    const entry = byStudent.get(student.id);

    if (entry) {
      entry.invoiceCount++;
      entry.totalRemaining += toNumber(invoice.remaining);
    } else {
      byStudent.set(student.id, {
        student,
        invoiceCount: 1,
        totalRemaining: toNumber(invoice.remaining),
        oldestDueDate: invoice.dueDate,
      });
    }
  }

  return {
    invoices: invoices.map((invoice) => ({
      ...invoice,
      total: toNumber(invoice.total),
      remaining: toNumber(invoice.remaining),
    })),
    byStudent: [...byStudent.values()].sort(
      (a, b) => b.totalRemaining - a.totalRemaining,
    ),
    totals: {
      invoiceCount: invoices.length,
      amount: invoices.reduce(
        (sum, invoice) => sum + toNumber(invoice.remaining),
        0,
      ),
      studentCount: byStudent.size,
    },
  };
};

// --------------------------------------------------
// Attendance — نسب الحضور
// --------------------------------------------------

export const attendanceReportService = async (
  query: AttendanceReportQuery,
) => {
  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
  };

  const where: Prisma.AttendanceWhereInput = {
    ...(query.studentId && {
      studentEnrollment: { studentId: query.studentId },
    }),
    ...((Object.keys(assignmentFilter).length > 0 ||
      query.dateFrom ||
      query.dateTo) && {
      session: {
        ...(dateRange(query.dateFrom, query.dateTo) && {
          sessionDate: dateRange(query.dateFrom, query.dateTo),
        }),
        ...(Object.keys(assignmentFilter).length > 0 && {
          schedule: { teachingAssignment: assignmentFilter },
        }),
      },
    }),
  };

  const byStatus = await prisma.attendance.groupBy({
    by: ["status"],
    where,
    _count: true,
  });

  const counts = {
    PRESENT: 0,
    ABSENT: 0,
    LATE: 0,
    EXCUSED: 0,
  };

  for (const row of byStatus) {
    counts[row.status] = row._count;
  }

  const total = Object.values(counts).reduce((sum, value) => sum + value, 0);

  // الحاضر والمتأخر يُحتسبان حضوراً
  const attended = counts.PRESENT + counts.LATE;

  return {
    counts,
    total,
    attendanceRate:
      total > 0 ? Math.round((attended / total) * 10000) / 100 : 0,
    absenceRate:
      total > 0 ? Math.round((counts.ABSENT / total) * 10000) / 100 : 0,
  };
};

// --------------------------------------------------
// Daily attendance — كشف الحضور اليومي
//
// ورقة يومٍ واحد: كل حصة وقعت في ذلك اليوم ومن حضرها.
// تُقرأ من Session و Attendance مباشرة، فلا جدول كشوف.
// --------------------------------------------------

export const dailyAttendanceReportService = async (
  query: DailyAttendanceReportQuery,
) => {
  const day = startOfUtcDay(query.date);

  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
  };

  const sessions = await prisma.session.findMany({
    where: {
      sessionDate: { gte: day, lt: addUtcDays(day, 1) },
      ...(Object.keys(assignmentFilter).length > 0 && {
        schedule: { teachingAssignment: assignmentFilter },
      }),
    },
    select: {
      id: true,
      lessonNumber: true,
      sessionDate: true,
      status: true,
      note: true,
      schedule: {
        select: {
          id: true,
          dayOfWeek: true,
          classroom: { select: { id: true, name: true } },
          lessonSlot: {
            select: { id: true, name: true, order: true, startTime: true, endTime: true },
          },
          teachingAssignment: {
            select: {
              id: true,
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
              studyGroup: { select: { id: true, name: true } },
            },
          },
        },
      },
      attendances: {
        select: {
          id: true,
          status: true,
          note: true,
          studentEnrollment: {
            select: {
              id: true,
              student: {
                select: { id: true, firstName: true, lastName: true, parentPhone: true },
              },
            },
          },
        },
      },
    },
    orderBy: [{ lessonNumber: "asc" }],
  });

  const rows = sessions.map((session) => {
    const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 };

    for (const attendance of session.attendances) {
      counts[attendance.status]++;
    }

    const { schedule, ...rest } = session;

    return {
      ...rest,
      lessonSlot: {
        ...schedule.lessonSlot,
        startTime: formatTime(schedule.lessonSlot.startTime),
        endTime: formatTime(schedule.lessonSlot.endTime),
      },
      classroom: schedule.classroom,
      subject: schedule.teachingAssignment.subject,
      teacher: schedule.teachingAssignment.teacher,
      studyGroup: schedule.teachingAssignment.studyGroup,
      counts,
      recorded: session.attendances.length,
      students: session.attendances.map((attendance) => ({
        attendanceId: attendance.id,
        status: attendance.status,
        note: attendance.note,
        student: attendance.studentEnrollment.student,
      })),
    };
  });

  const totals = rows.reduce(
    (sum, row) => ({
      sessions: sum.sessions + 1,
      PRESENT: sum.PRESENT + row.counts.PRESENT,
      ABSENT: sum.ABSENT + row.counts.ABSENT,
      LATE: sum.LATE + row.counts.LATE,
      EXCUSED: sum.EXCUSED + row.counts.EXCUSED,
    }),
    { sessions: 0, PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
  );

  return { date: day, sessions: rows, totals };
};

// --------------------------------------------------
// Monthly fees — كشف الحقوق الشهرية
//
// هذا هو الكشف الذي تراه الإدارة قبل التحصيل:
// لكل طالب صفٌّ لكل مادة بمبلغها وحالتها، ومجموعُ ما عليه.
// --------------------------------------------------

export const monthlyFeesReportService = async (
  query: MonthlyFeesReportQuery,
) => {
  const invoices = await prisma.invoice.findMany({
    where: {
      month: query.month,
      year: query.year,
      // الملغاة ليست حقاً على الطالب
      status: query.status ?? { not: "CANCELLED" },
      ...(query.academicYearId && { academicYearId: query.academicYearId }),
      ...((query.studentId || query.studyGroupId) && {
        studentEnrollment: {
          ...(query.studentId && { studentId: query.studentId }),
          ...(query.studyGroupId && {
            teachingAssignment: { studyGroupId: query.studyGroupId },
          }),
        },
      }),
    },
    select: {
      id: true,
      invoiceNumber: true,
      amount: true,
      discount: true,
      total: true,
      remaining: true,
      status: true,
      dueDate: true,
      studentEnrollment: {
        select: {
          id: true,
          student: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              parentPhone: true,
            },
          },
          teachingAssignment: {
            select: {
              subject: { select: { id: true, name: true } },
              studyGroup: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      },
    },
    orderBy: { invoiceNumber: "asc" },
  });

  type StudentRow = {
    student: {
      id: string;
      firstName: string;
      lastName: string;
      parentPhone: string;
    };
    items: {
      invoiceId: string;
      invoiceNumber: string;
      subject: { id: string; name: string };
      studyGroup: { id: string; name: string };
      teacher: { id: string; firstName: string; lastName: string };
      amount: number;
      discount: number;
      total: number;
      paid: number;
      remaining: number;
      status: string;
      dueDate: Date;
    }[];
    totals: { due: number; paid: number; remaining: number };
  };

  const byStudent = new Map<string, StudentRow>();

  for (const invoice of invoices) {
    const { student, teachingAssignment } = invoice.studentEnrollment;

    const total = toNumber(invoice.total);
    const remaining = toNumber(invoice.remaining);
    const paid = total - remaining;

    const item = {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      subject: teachingAssignment.subject,
      studyGroup: teachingAssignment.studyGroup,
      teacher: teachingAssignment.teacher,
      amount: toNumber(invoice.amount),
      discount: toNumber(invoice.discount),
      total,
      paid,
      remaining,
      status: invoice.status,
      dueDate: invoice.dueDate,
    };

    const row = byStudent.get(student.id);

    if (row) {
      row.items.push(item);
      row.totals.due += total;
      row.totals.paid += paid;
      row.totals.remaining += remaining;
    } else {
      byStudent.set(student.id, {
        student,
        items: [item],
        totals: { due: total, paid, remaining },
      });
    }
  }

  const students = [...byStudent.values()].sort((a, b) =>
    `${a.student.lastName} ${a.student.firstName}`.localeCompare(
      `${b.student.lastName} ${b.student.firstName}`,
    ),
  );

  return {
    month: query.month,
    year: query.year,
    students,
    totals: {
      studentCount: students.length,
      itemCount: invoices.length,
      due: students.reduce((sum, row) => sum + row.totals.due, 0),
      paid: students.reduce((sum, row) => sum + row.totals.paid, 0),
      remaining: students.reduce((sum, row) => sum + row.totals.remaining, 0),
    },
  };
};

// --------------------------------------------------
// Session clearance — كشف التخليص اليومي للحصص
//
// «مُخلَّصة» = حصةٌ سُجّل حضور كل مسجَّليها.
// المقارنة بين عدد سجلات الحضور وعدد المسجَّلين في
// الإسناد هي ما يكشف الحصص التي بقيت بلا تخليص.
// --------------------------------------------------

export const sessionClearanceReportService = async (
  query: SessionClearanceReportQuery,
) => {
  const day = startOfUtcDay(query.date);

  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
  };

  const sessions = await prisma.session.findMany({
    where: {
      sessionDate: { gte: day, lt: addUtcDays(day, 1) },
      ...(Object.keys(assignmentFilter).length > 0 && {
        schedule: { teachingAssignment: assignmentFilter },
      }),
    },
    select: {
      id: true,
      lessonNumber: true,
      status: true,
      schedule: {
        select: {
          lessonSlot: {
            select: {
              id: true,
              name: true,
              order: true,
              startTime: true,
              endTime: true,
            },
          },
          classroom: { select: { id: true, name: true } },
          teachingAssignment: {
            select: {
              id: true,
              subject: { select: { id: true, name: true } },
              teacher: { select: { id: true, firstName: true, lastName: true } },
              studyGroup: { select: { id: true, name: true } },
            },
          },
        },
      },
      _count: { select: { attendances: true } },
    },
    orderBy: [{ lessonNumber: "asc" }],
  });

  // عدد المسجَّلين النشطين لكل إسناد — المرجع الذي يُقاس عليه التخليص
  const assignmentIds = [
    ...new Set(sessions.map((s) => s.schedule.teachingAssignment.id)),
  ];

  const enrolled = await prisma.studentEnrollment.groupBy({
    by: ["teachingAssignmentId"],
    where: { isActive: true, teachingAssignmentId: { in: assignmentIds } },
    _count: true,
  });

  const enrolledCount = new Map(
    enrolled.map((row) => [row.teachingAssignmentId, row._count]),
  );

  const rows = sessions.map((session) => {
    const assignment = session.schedule.teachingAssignment;
    const expected = enrolledCount.get(assignment.id) ?? 0;
    const recorded = session._count.attendances;

    return {
      sessionId: session.id,
      lessonNumber: session.lessonNumber,
      status: session.status,
      lessonSlot: {
        ...session.schedule.lessonSlot,
        startTime: formatTime(session.schedule.lessonSlot.startTime),
        endTime: formatTime(session.schedule.lessonSlot.endTime),
      },
      classroom: session.schedule.classroom,
      subject: assignment.subject,
      teacher: assignment.teacher,
      studyGroup: assignment.studyGroup,
      enrolled: expected,
      recorded,
      // الحصة الملغاة لا تُنتظر منها ورقة حضور
      cleared:
        session.status === "CANCELLED" ||
        (expected > 0 && recorded >= expected),
    };
  });

  // تجميع بالأستاذ — الإدارة تُخلّص مع كل أستاذ على حدة
  const byTeacher = new Map<
    string,
    {
      teacher: { id: string; firstName: string; lastName: string };
      sessions: number;
      completed: number;
      cancelled: number;
      cleared: number;
      pending: number;
    }
  >();

  for (const row of rows) {
    const entry = byTeacher.get(row.teacher.id) ?? {
      teacher: row.teacher,
      sessions: 0,
      completed: 0,
      cancelled: 0,
      cleared: 0,
      pending: 0,
    };

    entry.sessions++;
    if (row.status === "COMPLETED") entry.completed++;
    if (row.status === "CANCELLED") entry.cancelled++;
    if (row.cleared) entry.cleared++;
    else entry.pending++;

    byTeacher.set(row.teacher.id, entry);
  }

  return {
    date: day,
    sessions: rows,
    byTeacher: [...byTeacher.values()],
    totals: {
      sessions: rows.length,
      completed: rows.filter((row) => row.status === "COMPLETED").length,
      cancelled: rows.filter((row) => row.status === "CANCELLED").length,
      cleared: rows.filter((row) => row.cleared).length,
      pending: rows.filter((row) => !row.cleared).length,
    },
  };
};

// --------------------------------------------------
// Expected sessions — الكشف التقديري للحصص
//
// المتوقَّع يُحسب من الجدول الأسبوعي: حصةٌ كل أسبوع في
// يومها، فعددُها في المدى = عدد مرات ورود ذلك اليوم.
// ولأن الجدول هو المصدر — وهو مربوط بحصص سنةٍ بعينها —
// فتغييرُ سياسةِ سنةٍ لاحقة لا يُغيّر تقديرَ سنةٍ مضت.
// --------------------------------------------------

/** عدد مرات ورود كل يوم أسبوع بين تاريخين، شاملاً الطرفين */
const countWeekdays = (from: Date, to: Date): Record<number, number> => {
  const counts: Record<number, number> = {
    0: 0,
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
    6: 0,
  };

  for (
    let date = startOfUtcDay(from);
    date <= startOfUtcDay(to);
    date = addUtcDays(date, 1)
  ) {
    counts[date.getUTCDay()]!++;
  }

  return counts;
};

export const expectedSessionsReportService = async (
  query: ExpectedSessionsReportQuery,
) => {
  const from = startOfUtcDay(query.dateFrom);
  const to = startOfUtcDay(query.dateTo);

  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
  };

  const schedules = await prisma.schedule.findMany({
    where: {
      isActive: true,
      ...(Object.keys(assignmentFilter).length > 0 && {
        teachingAssignment: assignmentFilter,
      }),
    },
    select: {
      id: true,
      dayOfWeek: true,
      lessonSlot: { select: { id: true, name: true, order: true } },
      teachingAssignment: {
        select: {
          id: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          studyGroup: { select: { id: true, name: true } },
          academicYear: { select: { id: true, name: true } },
        },
      },
    },
  });

  const actual = await prisma.session.groupBy({
    by: ["scheduleId", "status"],
    where: {
      scheduleId: { in: schedules.map((schedule) => schedule.id) },
      sessionDate: { gte: from, lt: addUtcDays(to, 1) },
    },
    _count: true,
  });

  const actualBySchedule = new Map<
    string,
    { total: number; completed: number; cancelled: number }
  >();

  for (const row of actual) {
    const entry = actualBySchedule.get(row.scheduleId) ?? {
      total: 0,
      completed: 0,
      cancelled: 0,
    };

    entry.total += row._count;
    if (row.status === "COMPLETED") entry.completed += row._count;
    if (row.status === "CANCELLED") entry.cancelled += row._count;

    actualBySchedule.set(row.scheduleId, entry);
  }

  const weekdayCounts = countWeekdays(from, to);

  const rows = schedules.map((schedule) => {
    const dayIndex = DAY_OF_WEEK_INDEX[schedule.dayOfWeek as DayOfWeek];
    const expected = weekdayCounts[dayIndex] ?? 0;
    const held = actualBySchedule.get(schedule.id) ?? {
      total: 0,
      completed: 0,
      cancelled: 0,
    };

    return {
      scheduleId: schedule.id,
      dayOfWeek: schedule.dayOfWeek,
      lessonSlot: schedule.lessonSlot,
      subject: schedule.teachingAssignment.subject,
      teacher: schedule.teachingAssignment.teacher,
      studyGroup: schedule.teachingAssignment.studyGroup,
      academicYear: schedule.teachingAssignment.academicYear,
      expected,
      actual: held.total,
      completed: held.completed,
      cancelled: held.cancelled,
      missing: Math.max(expected - held.total, 0),
    };
  });

  return {
    dateFrom: from,
    dateTo: to,
    schedules: rows,
    totals: {
      scheduleCount: rows.length,
      expected: rows.reduce((sum, row) => sum + row.expected, 0),
      actual: rows.reduce((sum, row) => sum + row.actual, 0),
      completed: rows.reduce((sum, row) => sum + row.completed, 0),
      cancelled: rows.reduce((sum, row) => sum + row.cancelled, 0),
      missing: rows.reduce((sum, row) => sum + row.missing, 0),
    },
  };
};
