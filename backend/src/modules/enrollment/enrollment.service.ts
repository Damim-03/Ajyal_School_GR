import { Prisma } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateEnrollmentInput,
  UpdateEnrollmentInput,
  TransferEnrollmentInput,
  EnrollmentQueryInput,
} from "./enrollment.schema";

const enrollmentSelect = {
  id: true,
  studentId: true,
  teachingAssignmentId: true,
  enrolledAt: true,
  isActive: true,
  student: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      parentPhone: true,
      // الصورة والجنس — منهما أفاتار الصفّ. حقلان صغيران يوفّران
      // طلبَ `getStudent` لمجرّد رسم دائرةٍ بجانب الاسم
      avatar: true,
      gender: true,
      // الملاحظة الإدارية — يعرضها كشف الحضور في عموده الأخير،
      // وجلبها هنا يوفّر طلباً لكل طالب عند فتح الكشف
      note: true,
    },
  },
  teachingAssignment: {
    select: {
      id: true,
      isActive: true,
      subject: { select: { id: true, name: true, code: true } },
      teacher: { select: { id: true, firstName: true, lastName: true } },
      studyGroup: {
        select: {
          id: true,
          name: true,
          type: true,
          maxStudents: true,
          level: { select: { id: true, name: true } },
        },
      },
      academicYear: { select: { id: true, name: true, isCurrent: true } },
    },
  },
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!enrollment) {
    throw new NotFoundException(
      "Enrollment not found",
      ErrorCodeEnum.ENROLLMENT_NOT_FOUND,
    );
  }

  return enrollment;
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listEnrollmentsService = async (query: EnrollmentQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  // الفلاتر على الإسناد تُمرَّر عبر العلاقة
  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
  };

  const where: Prisma.StudentEnrollmentWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.studentId && { studentId: query.studentId }),
    ...(query.teachingAssignmentId && {
      teachingAssignmentId: query.teachingAssignmentId,
    }),
    ...(Object.keys(assignmentFilter).length > 0 && {
      teachingAssignment: assignmentFilter,
    }),
  };

  const [enrollments, total] = await Promise.all([
    prisma.studentEnrollment.findMany({
      where,
      select: {
        ...enrollmentSelect,
        _count: { select: { invoices: true, attendances: true } },
      },
      skip,
      take,
      orderBy: { enrolledAt: "desc" },
    }),
    prisma.studentEnrollment.count({ where }),
  ]);

  return { enrollments, pagination: buildPagination(total, page, limit) };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getEnrollmentService = async (id: string) => {
  await findOrThrow(id);

  return prisma.studentEnrollment.findUnique({
    where: { id },
    select: {
      ...enrollmentSelect,
      _count: { select: { invoices: true, attendances: true } },
    },
  });
};

// --------------------------------------------------
// Create — تسجيل جماعي
//
// الفحوص قبل الكتابة:
//   1. الطالب موجود ونشط
//   2. كل الإسنادات موجودة ونشطة
//   3. لا تسجيل سابق في أيٍّ منها
//   4. طاقة الفوج (maxStudents) لا تُتجاوَز
//
// كله داخل transaction — إما الكل أو لا شيء.
// --------------------------------------------------

export const createEnrollmentService = async (body: CreateEnrollmentInput) => {
  const { studentId, teachingAssignmentIds } = body;

  // 1. الطالب
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true, isActive: true },
  });

  if (!student) {
    throw new NotFoundException(
      "Student not found",
      ErrorCodeEnum.STUDENT_NOT_FOUND,
    );
  }

  if (!student.isActive) {
    throw new BadRequestException(
      "Cannot enroll an inactive student",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 2. الإسنادات — نجلبها كلها دفعة واحدة
  const assignments = await prisma.teachingAssignment.findMany({
    where: { id: { in: teachingAssignmentIds } },
    select: {
      id: true,
      isActive: true,
      studyGroupId: true,
      subjectId: true,
      academicYearId: true,
      teacher: { select: { firstName: true, lastName: true } },
      subject: { select: { name: true } },
      studyGroup: { select: { name: true, maxStudents: true } },
    },
  });

  if (assignments.length !== teachingAssignmentIds.length) {
    const found = new Set(assignments.map((a) => a.id));
    const missing = teachingAssignmentIds.filter((id) => !found.has(id));

    throw new NotFoundException(
      `Teaching assignment(s) not found: ${missing.join(", ")}`,
      ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND,
    );
  }

  const inactive = assignments.filter((a) => !a.isActive);

  if (inactive.length > 0) {
    throw new BadRequestException(
      `Cannot enroll in inactive teaching assignment(s): ` +
        inactive.map((a) => a.subject.name).join(", "),
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // 3. تسجيلات سابقة
  const existing = await prisma.studentEnrollment.findMany({
    where: {
      studentId,
      teachingAssignmentId: { in: teachingAssignmentIds },
    },
    select: {
      teachingAssignmentId: true,
      teachingAssignment: { select: { subject: { select: { name: true } } } },
    },
  });

  if (existing.length > 0) {
    throw new ConflictException(
      `Student is already enrolled in: ` +
        existing.map((e) => e.teachingAssignment.subject.name).join(", "),
      ErrorCodeEnum.ENROLLMENT_ALREADY_EXISTS,
    );
  }

  // 3b. المادة نفسها مرّتين — بأستاذين مختلفين
  //
  //     مادةٌ واحدة يجوز أن يدرّسها أستاذان لنفس الفوج (قرار المؤسسة)،
  //     ومفتاحُ التفرّد يسمح بذلك لأنّه يشمل الأستاذ. لكن الفاتورة تُولَّد
  //     عن **التسجيل** لا عن الأستاذ: صفٌّ لكل (تسجيل + شهر). فطالبٌ
  //     مسجَّلٌ عند الاثنين يُفوتَر عن العلوم مرّتين في الشهر الواحد.
  //
  //     فالمنع هنا على مستوى (مادة + فوج + سنة) لا على مستوى الإسناد:
  //     يختار الطالب أستاذاً واحداً، وتغييرُه نقلٌ لا إضافة.
  const identity = (a: {
    subjectId: string;
    studyGroupId: string;
    academicYearId: string;
  }) => `${a.subjectId}|${a.studyGroupId}|${a.academicYearId}`;

  const withinRequest = new Map<string, string>();

  for (const assignment of assignments) {
    const key = identity(assignment);
    const twin = withinRequest.get(key);

    if (twin) {
      throw new ConflictException(
        `Duplicate subject in this request: '${assignment.subject.name}' for ` +
          `group '${assignment.studyGroup.name}' appears twice ` +
          `(${twin} / ${assignment.teacher.lastName} ${assignment.teacher.firstName}). ` +
          `Pick one teacher.`,
        ErrorCodeEnum.ENROLLMENT_ALREADY_EXISTS,
      );
    }

    withinRequest.set(
      key,
      `${assignment.teacher.lastName} ${assignment.teacher.firstName}`,
    );
  }

  const sameSubject = await prisma.studentEnrollment.findMany({
    where: {
      studentId,
      isActive: true,
      teachingAssignmentId: { notIn: teachingAssignmentIds },
      teachingAssignment: {
        OR: assignments.map((a) => ({
          subjectId: a.subjectId,
          studyGroupId: a.studyGroupId,
          academicYearId: a.academicYearId,
        })),
      },
    },
    select: {
      teachingAssignment: {
        select: {
          subject: { select: { name: true } },
          studyGroup: { select: { name: true } },
          teacher: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (sameSubject.length > 0) {
    throw new ConflictException(
      `Student is already enrolled in the same subject with another teacher: ` +
        sameSubject
          .map(
            (e) =>
              `${e.teachingAssignment.subject.name} — ` +
              `${e.teachingAssignment.studyGroup.name} ` +
              `(${e.teachingAssignment.teacher.lastName} ${e.teachingAssignment.teacher.firstName})`,
          )
          .join(", "),
      ErrorCodeEnum.ENROLLMENT_ALREADY_EXISTS,
    );
  }

  // 4. طاقة الأفواج
  //    الطالب يُحتسب مرة واحدة في الفوج مهما تعددت مواده،
  //    لذلك نفحص كل فوج مرة واحدة ونتجاهل الطالب إن كان فيه أصلاً.
  const groupIds = [...new Set(assignments.map((a) => a.studyGroupId))];

  for (const groupId of groupIds) {
    const group = assignments.find((a) => a.studyGroupId === groupId)!
      .studyGroup;

    if (!group.maxStudents) continue;

    const alreadyInGroup = await prisma.student.count({
      where: {
        id: studentId,
        enrollments: {
          some: {
            isActive: true,
            teachingAssignment: { studyGroupId: groupId },
          },
        },
      },
    });

    if (alreadyInGroup > 0) continue;

    const currentCount = await prisma.student.count({
      where: {
        enrollments: {
          some: {
            isActive: true,
            teachingAssignment: { studyGroupId: groupId },
          },
        },
      },
    });

    if (currentCount + 1 > group.maxStudents) {
      throw new ConflictException(
        `Study group '${group.name}' is full ` +
          `(${currentCount}/${group.maxStudents})`,
        ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
      );
    }
  }

  // 5. الكتابة
  const enrolledAt = body.enrolledAt ?? new Date();

  const created = await prisma.$transaction(
    teachingAssignmentIds.map((teachingAssignmentId) =>
      prisma.studentEnrollment.create({
        data: { studentId, teachingAssignmentId, enrolledAt },
        select: enrollmentSelect,
      }),
    ),
  );

  return created;
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateEnrollmentService = async (
  id: string,
  body: UpdateEnrollmentInput,
) => {
  await findOrThrow(id);

  return prisma.studentEnrollment.update({
    where: { id },
    data: {
      ...(body.isActive !== undefined && { isActive: body.isActive }),
      ...(body.enrolledAt !== undefined && { enrolledAt: body.enrolledAt }),
    },
    select: enrollmentSelect,
  });
};

// --------------------------------------------------
// Transfer — نقل الطالب من فوج إلى فوج
//
// النقل ليس «حذفاً ثم إسناداً»: لو نُفِّذ خطوتين من الواجهة وسقطت
// الثانية لبقي الطالب في فوجين — وهو الخلط الذي وُجدت الشاشة لمنعه.
// فالخطوتان هنا داخل transaction واحدة.
//
// والقديم يُعطَّل ولا يُحذف: فواتيرُه وحضورُه معلَّقةٌ به، وحذفُه يمحو
// تاريخ الطالب في الفوج الذي غادره.
//
// وإحياءُ المعطَّل بدل إنشاء جديد ضرورة لا تحسين: قيد
// @@unique([studentId, teachingAssignmentId]) يرفض صفّاً ثانياً، فطالبٌ
// عاد إلى فوجٍ سبق أن غادره كان سيصطدم بخطأٍ لا معنى له.
// --------------------------------------------------

export const transferEnrollmentService = async (
  id: string,
  body: TransferEnrollmentInput,
) => {
  const current = await prisma.studentEnrollment.findUnique({
    where: { id },
    select: {
      id: true,
      studentId: true,
      teachingAssignmentId: true,
      isActive: true,
      teachingAssignment: {
        select: {
          subjectId: true,
          studyGroupId: true,
          academicYearId: true,
          subject: { select: { name: true } },
          studyGroup: { select: { name: true } },
        },
      },
    },
  });

  if (!current) {
    throw new NotFoundException(
      "Enrollment not found",
      ErrorCodeEnum.ENROLLMENT_NOT_FOUND,
    );
  }

  if (current.teachingAssignmentId === body.teachingAssignmentId) {
    throw new BadRequestException(
      "الطالب مُسند إلى هذا الفوج بالفعل — اختر فوجاً آخر",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const target = await prisma.teachingAssignment.findUnique({
    where: { id: body.teachingAssignmentId },
    select: {
      id: true,
      isActive: true,
      subjectId: true,
      studyGroupId: true,
      academicYearId: true,
      subject: { select: { name: true } },
      studyGroup: {
        select: { id: true, name: true, maxStudents: true },
      },
    },
  });

  if (!target) {
    throw new NotFoundException(
      "Target teaching assignment not found",
      ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND,
    );
  }

  if (!target.isActive) {
    throw new BadRequestException(
      "Cannot transfer into an inactive teaching assignment",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // النقل داخل السنة نفسها — عبر السنوات تسجيلٌ جديد لا نقل
  if (target.academicYearId !== current.teachingAssignment.academicYearId) {
    throw new BadRequestException(
      "النقل لا يعبر السنوات الدراسية — سجّل الطالب في السنة الجديدة بدل نقله",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // المادة نفسها: النقل تغييرُ فوجٍ أو أستاذ لا تغييرُ مادة.
  // تغييرُ المادة إسنادٌ جديد وإلغاءٌ للقديم، لا نقل.
  if (target.subjectId !== current.teachingAssignment.subjectId) {
    throw new BadRequestException(
      `النقل يبقي المادة نفسها — من «${current.teachingAssignment.subject.name}» ` +
        `إلى «${target.subject.name}» ليس نقلاً. عطّل الإسناد القديم وأسند الجديد.`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  // تسجيلٌ سابق في الوجهة — يُحيا بدل أن يُنشأ نظير له
  const existingAtTarget = await prisma.studentEnrollment.findUnique({
    where: {
      studentId_teachingAssignmentId: {
        studentId: current.studentId,
        teachingAssignmentId: target.id,
      },
    },
    select: { id: true, isActive: true },
  });

  // طاقة الفوج — تُفحص فقط إن كان الطالب خارجه فعلاً
  if (target.studyGroup.maxStudents) {
    const alreadyInGroup = await prisma.studentEnrollment.count({
      where: {
        studentId: current.studentId,
        isActive: true,
        teachingAssignmentId: { not: current.id },
        teachingAssignment: { studyGroupId: target.studyGroupId },
      },
    });

    if (alreadyInGroup === 0) {
      const currentCount = await prisma.student.count({
        where: {
          enrollments: {
            some: {
              isActive: true,
              teachingAssignment: { studyGroupId: target.studyGroupId },
            },
          },
        },
      });

      if (currentCount + 1 > target.studyGroup.maxStudents) {
        throw new ConflictException(
          `الفوج «${target.studyGroup.name}» ممتلئ ` +
            `(${currentCount}/${target.studyGroup.maxStudents})`,
          ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
        );
      }
    }
  }

  const [, moved] = await prisma.$transaction([
    // القديم يُعطَّل ولا يُحذف — فواتيره وحضوره تبقى معلَّقة به
    prisma.studentEnrollment.update({
      where: { id },
      data: { isActive: false },
    }),

    existingAtTarget
      ? prisma.studentEnrollment.update({
          where: { id: existingAtTarget.id },
          data: { isActive: true, enrolledAt: body.enrolledAt ?? new Date() },
          select: enrollmentSelect,
        })
      : prisma.studentEnrollment.create({
          data: {
            studentId: current.studentId,
            teachingAssignmentId: target.id,
            enrolledAt: body.enrolledAt ?? new Date(),
          },
          select: enrollmentSelect,
        }),
  ]);

  return {
    from: {
      id: current.id,
      subject: current.teachingAssignment.subject.name,
      studyGroup: current.teachingAssignment.studyGroup.name,
    },
    to: moved,
    revived: Boolean(existingAtTarget),
  };
};

// --------------------------------------------------
// Delete — ممنوع إن كان له فواتير أو حضور
// --------------------------------------------------

export const deleteEnrollmentService = async (id: string) => {
  await findOrThrow(id);

  const relations = await prisma.studentEnrollment.findUnique({
    where: { id },
    select: { _count: { select: { invoices: true, attendances: true } } },
  });

  const invoices = relations?._count.invoices ?? 0;
  const attendances = relations?._count.attendances ?? 0;

  if (invoices > 0 || attendances > 0) {
    throw new ConflictException(
      `Cannot delete: enrollment has ${invoices} invoice(s) and ` +
        `${attendances} attendance record(s). Deactivate it instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.studentEnrollment.delete({ where: { id } });
};
