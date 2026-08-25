import { Prisma } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  activeInvoice,
  attendance as attendanceMetric,
  countsFromGroupBy,
  emptyAttendanceCounts,
  rate,
  toNumber,
} from "../../core/reporting";
import type { ReportQuery } from "./reports.filters";
import { attendanceScope, enrollmentScope, invoiceScope } from "./reports.scope";
import { skipTake, type ResolvedSort, type TableRequest } from "./reports.table";

// ======================================================
// صفوفُ الجداول — §41 و§51
//
// القاعدةُ الحاكمة: **لا استعلامَ داخل حلقة**.
//
// الطريقةُ الساذجة لبناء جدول الطلبة أن تجلب الطلبةَ ثم تسأل عن
// حضور كلٍّ منهم وفواتيره — خمسون طالباً = مئةٌ وواحدُ استعلام.
// يعمل في التجريب ويسقط عند مئتي طالب.
//
// فالنمطُ هنا ثلاث خطوات:
//   1. صفحةُ الطلبة (استعلام واحد)
//   2. تجميعُ الحضور لهؤلاء وحدهم بـ`groupBy` (استعلام واحد)
//   3. تجميعُ الفواتير لهؤلاء وحدهم بـ`groupBy` (استعلام واحد)
//   4. الدمجُ في الذاكرة بخرائط
//
// ثلاثةُ استعلاماتٍ مهما كان حجمُ الصفحة. والخطوتان 2 و3 مقيَّدتان
// بمعرّفات الصفحة لا بكلّ القاعدة — فالتجميعُ لا يمسّ إلا ما يُعرض.
// ======================================================

// --------------------------------------------------
// صفوفُ الطلبة — §8
// --------------------------------------------------

export type StudentRow = {
  id: string;
  studentNumber: string | null;
  name: string;
  gender: string;
  enrollmentCount: number;
  attendanceRate: number | null;
  invoiced: number;
  paid: number;
  outstanding: number;
  isActive: boolean;
};

export const fetchStudentRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: StudentRow[]; total: number }> => {
  const enrollment = enrollmentScope(query);

  /*
   * الطالبُ يدخل الجدول متى كان له تسجيلٌ واحد داخل النطاق.
   *
   * `some` لا `every`: طالبٌ مسجَّلٌ في ثلاث مواد إحداها الرياضيات
   * يظهر في تقرير الرياضيات. و`every` كانت ستقصره على من لا يدرس
   * غيرَها — وهو سؤالٌ آخر لم يطرحه أحد.
   */
  const where: Prisma.StudentWhereInput =
    Object.keys(enrollment).length > 0
      ? { enrollments: { some: enrollment } }
      : {};

  const [total, students] = await prisma.$transaction([
    prisma.student.count({ where }),
    prisma.student.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.StudentOrderByWithRelationInput,
      select: {
        id: true,
        studentNumber: true,
        firstName: true,
        lastName: true,
        gender: true,
        isActive: true,
        _count: { select: { enrollments: true } },
      },
    }),
  ]);

  const ids = students.map((student) => student.id);

  if (ids.length === 0) return { rows: [], total };

  /*
   * التجميعان مقيَّدان بمعرّفات الصفحة.
   *
   * ولولا التقييد لجمع الحضورَ لكلّ طلبة المؤسسة ثم أُهمل أكثرُه —
   * عملٌ يتضخّم مع نموّ المؤسسة بينما الصفحةُ تبقى خمسين صفّاً.
   */
  /*
   * الحضورُ يحتاج ربطاً بالطالب، و`groupBy` على الحالة وحدها لا
   * يعطيه — Prisma لا تجمّع عبر علاقة. فيُجلب تفصيلُ (طالب ×
   * حالة) باستعلامٍ واحد ويُطوى في الذاكرة.
   *
   * والحقلان المختاران اثنان فقط، فالمنقولُ عبر الشبكة صغيرٌ ولو
   * كثرت السجلّات. والبديلُ — استعلامٌ لكلّ طالب — كان خمسين
   * رحلةً لصفحةٍ واحدة.
   */
  const [perStudent, invoiceRows] = await Promise.all([
    prisma.attendance.findMany({
      where: {
        ...attendanceScope(query),
        studentEnrollment: { studentId: { in: ids } },
      },
      select: {
        status: true,
        studentEnrollment: { select: { studentId: true } },
      },
    }),
    prisma.invoice.groupBy({
      by: ["studentEnrollmentId"],
      where: {
        ...invoiceScope(query),
        studentEnrollment: { studentId: { in: ids } },
      },
      _sum: { total: true, remaining: true },
    }),
  ]);

  const attendanceByStudent = new Map<string, ReturnType<typeof emptyAttendanceCounts>>();

  for (const record of perStudent) {
    const studentId = record.studentEnrollment.studentId;
    const counts = attendanceByStudent.get(studentId) ?? emptyAttendanceCounts();
    counts[record.status] += 1;
    attendanceByStudent.set(studentId, counts);
  }

  /*
   * الفواتيرُ مجمَّعةٌ بالتسجيل، والتسجيلُ يخصّ طالباً — فيُبنى
   * جسرٌ من التسجيل إلى الطالب باستعلامٍ واحد.
   */
  const enrollmentIds = invoiceRows.map((row) => row.studentEnrollmentId);

  const enrollmentOwners = enrollmentIds.length
    ? await prisma.studentEnrollment.findMany({
        where: { id: { in: enrollmentIds } },
        select: { id: true, studentId: true },
      })
    : [];

  const ownerOf = new Map(
    enrollmentOwners.map((row) => [row.id, row.studentId]),
  );

  const moneyByStudent = new Map<string, { invoiced: number; remaining: number }>();

  for (const row of invoiceRows) {
    const studentId = ownerOf.get(row.studentEnrollmentId);
    if (!studentId) continue;

    const current = moneyByStudent.get(studentId) ?? { invoiced: 0, remaining: 0 };
    current.invoiced += toNumber(row._sum.total);
    current.remaining += toNumber(row._sum.remaining);
    moneyByStudent.set(studentId, current);
  }

  const rows: StudentRow[] = students.map((student) => {
    const counts = attendanceByStudent.get(student.id);
    const money = moneyByStudent.get(student.id) ?? { invoiced: 0, remaining: 0 };

    return {
      id: student.id,
      studentNumber: student.studentNumber,
      name: `${student.firstName} ${student.lastName}`.trim(),
      gender: student.gender,
      enrollmentCount: student._count.enrollments,
      /*
       * `null` لا صفر حين لا سجلّاتِ حضور — طالبٌ سُجّل ولم تبدأ
       * دراستُه ليس غائباً بنسبة 100%.
       */
      attendanceRate: counts ? attendanceMetric(counts).attendanceRate : null,
      invoiced: money.invoiced,
      paid: money.invoiced - money.remaining,
      outstanding: money.remaining,
      isActive: student.isActive,
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// صفوفُ الحضور — §19
// --------------------------------------------------

export type AttendanceRow = {
  id: string;
  studentName: string;
  subject: string;
  teacher: string;
  studyGroup: string;
  sessionDate: string;
  lessonNumber: number;
  status: string;
  note: string | null;
};

export const fetchAttendanceRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: AttendanceRow[]; total: number }> => {
  const where = attendanceScope(query);

  /*
   * `include` متداخلٌ في استعلامٍ واحد لا استعلامٌ لكلّ صفّ.
   *
   * Prisma تترجم هذا إلى وصلاتٍ واحدة، فخمسون صفّاً تُكلّف استعلاماً
   * واحداً. وقراءةُ الأستاذ والمادة لكلّ صفٍّ على حدة كانت الـN+1
   * بعينها.
   */
  const [total, records] = await prisma.$transaction([
    prisma.attendance.count({ where }),
    prisma.attendance.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.AttendanceOrderByWithRelationInput,
      select: {
        id: true,
        status: true,
        note: true,
        studentEnrollment: {
          select: {
            student: { select: { firstName: true, lastName: true } },
          },
        },
        session: {
          select: {
            sessionDate: true,
            lessonNumber: true,
            schedule: {
              select: {
                teachingAssignment: {
                  select: {
                    subject: { select: { name: true } },
                    teacher: { select: { firstName: true, lastName: true } },
                    studyGroup: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    }),
  ]);

  const rows: AttendanceRow[] = records.map((record) => {
    const assignment = record.session.schedule.teachingAssignment;

    return {
      id: record.id,
      studentName:
        `${record.studentEnrollment.student.firstName} ${record.studentEnrollment.student.lastName}`.trim(),
      subject: assignment.subject.name,
      teacher:
        `${assignment.teacher.firstName} ${assignment.teacher.lastName}`.trim(),
      studyGroup: assignment.studyGroup.name,
      sessionDate: record.session.sessionDate.toISOString(),
      lessonNumber: record.session.lessonNumber,
      status: record.status,
      note: record.note,
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// صفوفُ الأساتذة — §27
// --------------------------------------------------

export type TeacherRow = {
  id: string;
  name: string;
  assignmentCount: number;
  studentCount: number;
  entitlement: number;
  paid: number;
  outstanding: number;
};

export const fetchTeacherRows = async (
  query: Partial<ReportQuery>,
  request: TableRequest,
  sort: ResolvedSort,
): Promise<{ rows: TeacherRow[]; total: number }> => {
  const where: Prisma.TeacherWhereInput = query.teacherId
    ? { id: query.teacherId }
    : {};

  const [total, teachers] = await prisma.$transaction([
    prisma.teacher.count({ where }),
    prisma.teacher.findMany({
      where,
      ...skipTake(request),
      orderBy: sort.orderBy as Prisma.TeacherOrderByWithRelationInput,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        _count: { select: { teachingAssignments: true } },
      },
    }),
  ]);

  const ids = teachers.map((teacher) => teacher.id);

  if (ids.length === 0) return { rows: [], total };

  const [settlements, shares, allocations, enrollments] = await Promise.all([
    prisma.settlement.groupBy({
      by: ["teacherId"],
      where: { teacherId: { in: ids }, status: { not: "CANCELLED" } },
      _sum: { teacherAmount: true },
    }),
    prisma.teacherDebtShare.groupBy({
      by: ["teacherId"],
      where: { teacherId: { in: ids }, status: { not: "CANCELLED" } },
      _sum: { shareAmount: true },
    }),
    prisma.teacherPaymentAllocation.groupBy({
      by: ["teacherPaymentId"],
      where: {
        teacherPayment: { teacherId: { in: ids }, status: "ACTIVE" },
      },
      _sum: { amount: true },
    }),
    prisma.studentEnrollment.groupBy({
      by: ["teachingAssignmentId"],
      where: { teachingAssignment: { teacherId: { in: ids } } },
      _count: true,
    }),
  ]);

  /*
   * التخصيصاتُ مجمَّعةٌ بالدفعة لا بالأستاذ — فيُبنى جسرٌ من الدفعة
   * إلى صاحبها. و`groupBy` لا يقبل التجميعَ عبر علاقة، فالجسرُ
   * استعلامٌ واحدٌ إضافي لا حلقة.
   */
  const paymentIds = allocations.map((row) => row.teacherPaymentId);

  const paymentOwners = paymentIds.length
    ? await prisma.teacherPayment.findMany({
        where: { id: { in: paymentIds } },
        select: { id: true, teacherId: true },
      })
    : [];

  const teacherOfPayment = new Map(
    paymentOwners.map((row) => [row.id, row.teacherId]),
  );

  const paidByTeacher = new Map<string, number>();

  for (const row of allocations) {
    const teacherId = teacherOfPayment.get(row.teacherPaymentId);
    if (!teacherId) continue;

    paidByTeacher.set(
      teacherId,
      (paidByTeacher.get(teacherId) ?? 0) + toNumber(row._sum.amount),
    );
  }

  /* التسجيلاتُ مجمَّعةٌ بالإسناد — والجسرُ إلى الأستاذ بنفس النمط */
  const assignmentIds = enrollments.map((row) => row.teachingAssignmentId);

  const assignmentOwners = assignmentIds.length
    ? await prisma.teachingAssignment.findMany({
        where: { id: { in: assignmentIds } },
        select: { id: true, teacherId: true },
      })
    : [];

  const teacherOfAssignment = new Map(
    assignmentOwners.map((row) => [row.id, row.teacherId]),
  );

  const studentsByTeacher = new Map<string, number>();

  for (const row of enrollments) {
    const teacherId = teacherOfAssignment.get(row.teachingAssignmentId);
    if (!teacherId) continue;

    studentsByTeacher.set(
      teacherId,
      (studentsByTeacher.get(teacherId) ?? 0) + row._count,
    );
  }

  const settlementByTeacher = new Map(
    settlements.map((row) => [row.teacherId, toNumber(row._sum.teacherAmount)]),
  );
  const shareByTeacher = new Map(
    shares.map((row) => [row.teacherId, toNumber(row._sum.shareAmount)]),
  );

  const rows: TeacherRow[] = teachers.map((teacher) => {
    const entitlement =
      (settlementByTeacher.get(teacher.id) ?? 0) +
      (shareByTeacher.get(teacher.id) ?? 0);
    const paid = paidByTeacher.get(teacher.id) ?? 0;

    return {
      id: teacher.id,
      name: `${teacher.firstName} ${teacher.lastName}`.trim(),
      assignmentCount: teacher._count.teachingAssignments,
      studentCount: studentsByTeacher.get(teacher.id) ?? 0,
      entitlement,
      paid,
      outstanding: entitlement - paid,
    };
  });

  return { rows, total };
};

// --------------------------------------------------
// أعدادُ الطلبة — §8
// --------------------------------------------------

export const studentCounts = async (query: Partial<ReportQuery>) => {
  const enrollment = enrollmentScope(query);
  const scoped: Prisma.StudentWhereInput =
    Object.keys(enrollment).length > 0
      ? { enrollments: { some: enrollment } }
      : {};

  const [total, active, byGender, withDebt] = await Promise.all([
    prisma.student.count({ where: scoped }),
    prisma.student.count({ where: { ...scoped, isActive: true } }),
    prisma.student.groupBy({
      by: ["gender"],
      where: scoped,
      _count: true,
    }),
    prisma.invoice.findMany({
      where: { ...invoiceScope(query), ...activeInvoice, remaining: { gt: 0 } },
      select: { studentEnrollment: { select: { studentId: true } } },
      distinct: ["studentEnrollmentId"],
    }),
  ]);

  return {
    total,
    active,
    inactive: total - active,
    byGender,
    studentsInDebt: new Set(withDebt.map((row) => row.studentEnrollment.studentId))
      .size,
    /** نسبةُ النشطين — `null` حين لا طلبة */
    activeRate: rate(active, total),
  };
};
