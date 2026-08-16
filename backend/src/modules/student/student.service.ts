import { Prisma } from "../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  currentYearPrefix,
  nextStudentNumber,
} from "../../core/utils/student-number";
import {
  CreateStudentInput,
  UpdateStudentInput,
  StudentQueryInput,
  StudentEnrollmentQueryInput,
} from "./student.schema";
import { REQUIRED_KEYS, completenessOf } from "./document.types";

const studentSelect = {
  id: true,
  studentNumber: true,
  firstName: true,
  lastName: true,
  gender: true,
  birthDate: true,
  avatar: true,
  phone: true,
  parentPhone: true,
  address: true,
  schoolName: true,
  emergencyPhone: true,
  registrationDate: true,
  note: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const student = await prisma.student.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!student) {
    throw new NotFoundException(
      "Student not found",
      ErrorCodeEnum.STUDENT_NOT_FOUND,
    );
  }

  return student;
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listStudentsService = async (query: StudentQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  /*
   * شروط الإسناد التدريسي المرتبط بتسجيلات الطالب.
   * المستوى يمرّ عبر الفوج: TeachingAssignment ← StudyGroup ← Level.
   */
  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.teacherId && { teacherId: query.teacherId }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.levelId && { studyGroup: { levelId: query.levelId } }),
  };

  const hasEnrollmentFilter = Object.keys(assignmentFilter).length > 0;

  const where: Prisma.StudentWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.gender && { gender: query.gender }),
    ...(query.search && {
      OR: [
        /*
         * الرقم أوّلاً لأنّه المدخل الأسرع: ماسحُ الباركود يكتب رقم
         * البطاقة في حقل البحث ويضغط Enter، فيُفتح الطالب بمسحةٍ بدل
         * كتابة اسمه. والمطابقة تامّةٌ لا `contains` — «2026000014»
         * جزءٌ من لا شيء، و`contains` كانت ستُعيد معه كلَّ رقمٍ يحويه.
         */
        { studentNumber: query.search },
        { firstName: { contains: query.search } },
        { lastName: { contains: query.search } },
        { phone: { contains: query.search } },
        { parentPhone: { contains: query.search } },
      ],
    }),
    /*
     * `some` لا `every`: الطالب يُطابق إن كان **أحد** تسجيلاته يحقّق
     * الشرط. و`every` كانت ستعني «كل مواده هي هذه المادة» — وهو سؤال
     * لا يطرحه أحد.
     */
    ...(hasEnrollmentFilter && {
      enrollments: {
        some: {
          ...(query.includeInactiveEnrollments !== true && { isActive: true }),
          teachingAssignment: assignmentFilter,
        },
      },
    }),
  };

  /*
   * فلتر اكتمال الملف.
   *
   * «مكتمل» = يملك كلّ الأنواع المطلوبة، فيُترجَم إلى شرطٍ لكلّ نوع
   * على حدة. وهذا يبقيه استعلاماً واحداً يحترم الترقيم — بخلاف الترشيح
   * بعد الجلب الذي يكسر أعداد الصفحات.
   */
  if (query.documentsComplete !== undefined) {
    const hasAllRequired = REQUIRED_KEYS.map((type) => ({
      documents: { some: { type } },
    }));

    if (query.documentsComplete) where.AND = hasAllRequired;
    else where.NOT = { AND: hasAllRequired };
  }

  const [students, total] = await Promise.all([
    prisma.student.findMany({
      where,
      select: {
        ...studentSelect,
        _count: { select: { enrollments: true } },
        /*
         * أنواع الوثائق الموجودة فقط — لا مساراتها.
         * الاكتمال يُحسب منها في الواجهة بلا طلبٍ إضافي لكل طالب.
         */
        documents: { select: { type: true } },
      },
      skip,
      take,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.student.count({ where }),
  ]);

  return {
    students: students.map((student) => ({
      ...student,
      documentTypes: student.documents.map((d) => d.type),
      documents: undefined,
      completeness: completenessOf(student.documents.map((d) => d.type)),
    })),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getStudentService = async (id: string) => {
  await findOrThrow(id);

  return prisma.student.findUnique({
    where: { id },
    select: {
      ...studentSelect,
      _count: { select: { enrollments: true } },
    },
  });
};

// --------------------------------------------------
// Enrollments — GET /students/:id/enrollments
//
// المواد التي سجّل فيها الطالب، مع الأستاذ والفوج والسنة.
// --------------------------------------------------

export const getStudentEnrollmentsService = async (
  id: string,
  query: StudentEnrollmentQueryInput,
) => {
  await findOrThrow(id);

  return prisma.studentEnrollment.findMany({
    where: {
      studentId: id,
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.academicYearId && {
        teachingAssignment: { academicYearId: query.academicYearId },
      }),
    },
    select: {
      id: true,
      enrolledAt: true,
      isActive: true,
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
              /*
               * الطور مع المستوى — تطلبهما بطاقة الطالب معاً («أولى
               * متوسط» مستوى و«المتوسط» طور)، وهما حقلان في جدولين
               * فجلبُهما هنا يوفّر طلباً ثانياً لأجل سطرٍ في بطاقة.
               */
              level: {
                select: {
                  id: true,
                  name: true,
                  educationStage: { select: { id: true, name: true, type: true } },
                },
              },
            },
          },
          academicYear: { select: { id: true, name: true, isCurrent: true } },
        },
      },
      _count: { select: { invoices: true, attendances: true } },
    },
    orderBy: { enrolledAt: "desc" },
  });
};

// --------------------------------------------------
// Create
// --------------------------------------------------

/**
 * محاولاتُ الرقم عند التزاحم.
 *
 * `nextStudentNumber` يقرأ الأكبر ويزيد، ومعاملتان متزامنتان قد تقرآن
 * الأكبرَ نفسه. القاعدة تردّ الثانية بـP2002 وتُعاد المحاولة فتقرأ
 * الرقم الذي حفظته الأولى. وثلاثٌ تكفي لموظّفَين يسجّلان معاً، والحدُّ
 * موجودٌ لأنّ حلقةً بلا سقفٍ عند خللٍ في القاعدة أسوأ من خطأٍ صريح.
 */
const NUMBER_ATTEMPTS = 3;

export const createStudentService = async (body: CreateStudentInput) => {
  for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(async (tx) => {
        const prefix = await currentYearPrefix(tx);

        return tx.student.create({
          data: {
            studentNumber: await nextStudentNumber(tx, prefix),
            firstName: body.firstName,
            lastName: body.lastName,
            gender: body.gender,
            birthDate: body.birthDate ?? null,
            avatar: body.avatar ?? null,
            phone: body.phone ?? null,
            parentPhone: body.parentPhone,
            address: body.address ?? null,
            schoolName: body.schoolName ?? null,
            emergencyPhone: body.emergencyPhone ?? null,
            ...(body.registrationDate && { registrationDate: body.registrationDate }),
            note: body.note ?? null,
            isActive: body.isActive ?? true,
          },
          select: studentSelect,
        });
      });
    } catch (error) {
      const clash =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002" &&
        String(error.meta?.target ?? "").includes("studentNumber");

      if (!clash || attempt === NUMBER_ATTEMPTS - 1) throw error;
    }
  }

  /* لا يُبلَغ: الحلقة إمّا تُرجع أو ترمي في الدورة الأخيرة */
  throw new ConflictException(
    "Could not allocate a student number",
    ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
  );
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateStudentService = async (
  id: string,
  body: UpdateStudentInput,
) => {
  await findOrThrow(id);

  return prisma.student.update({
    where: { id },
    data: {
      ...(body.firstName !== undefined && { firstName: body.firstName }),
      ...(body.lastName !== undefined && { lastName: body.lastName }),
      ...(body.gender !== undefined && { gender: body.gender }),
      ...(body.birthDate !== undefined && { birthDate: body.birthDate }),
      ...(body.avatar !== undefined && { avatar: body.avatar }),
      ...(body.phone !== undefined && { phone: body.phone }),
      ...(body.parentPhone !== undefined && { parentPhone: body.parentPhone }),
      ...(body.address !== undefined && { address: body.address }),
      ...(body.schoolName !== undefined && { schoolName: body.schoolName }),
      ...(body.emergencyPhone !== undefined && {
        emergencyPhone: body.emergencyPhone,
      }),
      ...(body.registrationDate !== undefined && {
        registrationDate: body.registrationDate,
      }),
      ...(body.note !== undefined && { note: body.note }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: studentSelect,
  });
};

// --------------------------------------------------
// Delete — ممنوع إن كان مسجَّلاً في أي مادة
// --------------------------------------------------

export const deleteStudentService = async (id: string) => {
  await findOrThrow(id);

  const enrollments = await prisma.studentEnrollment.count({
    where: { studentId: id },
  });

  if (enrollments > 0) {
    throw new ConflictException(
      `Cannot delete: student has ${enrollments} enrollment(s). ` +
        `Deactivate the student instead.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  await prisma.student.delete({ where: { id } });
};
