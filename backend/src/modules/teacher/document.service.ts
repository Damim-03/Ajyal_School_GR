import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  TEACHER_DOCUMENT_TYPES,
  isCustomType,
  isKnownTeacherType,
} from "./document.types";

const documentSelect = {
  id: true,
  type: true,
  label: true,
  filePath: true,
  fileName: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, username: true } },
} as const;

const ensureTeacher = async (teacherId: string) => {
  const teacher = await prisma.teacher.findUnique({
    where: { id: teacherId },
    select: { id: true },
  });

  if (!teacher) {
    throw new NotFoundException(
      "Teacher not found",
      ErrorCodeEnum.TEACHER_NOT_FOUND,
    );
  }
};

// --------------------------------------------------
// قراءة ملفّ الأستاذ
//
// الكتالوجُ المعروض = الخاناتُ الافتراضية + ما أضافته الإدارة.
//
// والمضافُ يأتي من الصفوف نفسِها لا من قائمةٍ ثانية: نوعٌ أضافته
// الإدارةُ ولم تُرفق فيه ملفّاً لا أثرَ له — وهو الصواب، فخانةٌ فارغة
// اسمُها «شهادة الخبرة» تُوهم أنّها مطلوبة وهي مجرّد ضغطةِ زرّ سهت.
// --------------------------------------------------

export const getTeacherDocumentsService = async (teacherId: string) => {
  await ensureTeacher(teacherId);

  const documents = await prisma.teacherDocument.findMany({
    where: { teacherId },
    select: documentSelect,
    orderBy: { createdAt: "asc" },
  });

  const byType = new Map(documents.map((d) => [d.type, d]));

  const standard = TEACHER_DOCUMENT_TYPES.map((type) => ({
    ...type,
    custom: false,
    document: byType.get(type.key) ?? null,
  }));

  const custom = documents
    .filter((d) => isCustomType(d.type))
    .map((d) => ({
      key: d.type,
      label: d.label ?? "وثيقة",
      hint: undefined as string | undefined,
      custom: true,
      document: d,
    }));

  return {
    catalogue: [...standard, ...custom],
    /* عدّةٌ لا اكتمال: الإلزامُ ليس في الشيفرة، فلا نسبةَ تُحسب */
    delivered: documents.length,
  };
};

// --------------------------------------------------
// إرفاق وثيقة — استبدال لا تراكم
// --------------------------------------------------

export const putTeacherDocumentService = async (
  teacherId: string,
  type: string,
  body: {
    filePath: string;
    fileName?: string | null;
    label?: string | null;
    note?: string | null;
  },
  uploadedById?: string,
) => {
  await ensureTeacher(teacherId);

  if (!isKnownTeacherType(type)) {
    throw new BadRequestException(
      `نوع وثيقة غير معروف: ${type}`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  /*
   * التسمية إلزاميةٌ للنوع المضاف وحده.
   *
   * لأنّها مصدرُها الوحيد: لا كتالوجَ في الشيفرة يحمل اسمَ
   * `custom_a1b2c3`، فصفٌّ بلا تسميةٍ يظهر في الملفّ «وثيقة» ولا يعرف
   * أحدٌ ما هي بعد شهر.
   */
  const label = body.label?.trim() || null;

  if (isCustomType(type) && !label) {
    throw new BadRequestException(
      "تسمية الوثيقة مطلوبة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  await prisma.teacherDocument.upsert({
    where: { teacherId_type: { teacherId, type } },
    update: {
      filePath: body.filePath,
      fileName: body.fileName ?? null,
      note: body.note ?? null,
      /* التسميةُ لا تُمحى بإعادة رفعٍ لم تحملها */
      ...(isCustomType(type) && label ? { label } : {}),
      uploadedById: uploadedById ?? null,
    },
    create: {
      teacherId,
      type,
      label: isCustomType(type) ? label : null,
      filePath: body.filePath,
      fileName: body.fileName ?? null,
      note: body.note ?? null,
      uploadedById: uploadedById ?? null,
    },
  });

  return getTeacherDocumentsService(teacherId);
};

// --------------------------------------------------
// حذف وثيقة
// --------------------------------------------------

export const deleteTeacherDocumentService = async (
  teacherId: string,
  type: string,
) => {
  await ensureTeacher(teacherId);

  const existing = await prisma.teacherDocument.findUnique({
    where: { teacherId_type: { teacherId, type } },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundException(
      "الوثيقة غير موجودة",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  await prisma.teacherDocument.delete({ where: { id: existing.id } });

  return getTeacherDocumentsService(teacherId);
};
