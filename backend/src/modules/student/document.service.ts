import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  DOCUMENT_TYPES,
  completenessOf,
  isKnownType,
} from "./document.types";

const documentSelect = {
  id: true,
  type: true,
  filePath: true,
  fileName: true,
  note: true,
  createdAt: true,
  updatedAt: true,
  uploadedBy: { select: { id: true, username: true } },
} as const;

const ensureStudent = async (studentId: string) => {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });

  if (!student) {
    throw new NotFoundException(
      "Student not found",
      ErrorCodeEnum.STUDENT_NOT_FOUND,
    );
  }
};

// --------------------------------------------------
// قراءة ملف الطالب
//
// يُرجع الكتالوج كاملاً لا الموجود فقط: الواجهة تعرض خانةً لكل نوع
// — مملوءةً أو فارغة — فيرى المستخدم ما ينقص لا ما لديه فقط.
// --------------------------------------------------

export const getStudentDocumentsService = async (studentId: string) => {
  await ensureStudent(studentId);

  const documents = await prisma.studentDocument.findMany({
    where: { studentId },
    select: documentSelect,
  });

  const byType = new Map(documents.map((d) => [d.type, d]));

  return {
    catalogue: DOCUMENT_TYPES.map((type) => ({
      ...type,
      document: byType.get(type.key) ?? null,
    })),
    completeness: completenessOf(documents.map((d) => d.type)),
  };
};

// --------------------------------------------------
// إرفاق وثيقة — استبدال لا تراكم
// --------------------------------------------------

export const putStudentDocumentService = async (
  studentId: string,
  type: string,
  body: { filePath: string; fileName?: string | null; note?: string | null },
  uploadedById?: string,
) => {
  await ensureStudent(studentId);

  if (!isKnownType(type)) {
    throw new BadRequestException(
      `نوع وثيقة غير معروف: ${type}`,
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  await prisma.studentDocument.upsert({
    where: { studentId_type: { studentId, type } },
    update: {
      filePath: body.filePath,
      fileName: body.fileName ?? null,
      note: body.note ?? null,
      uploadedById: uploadedById ?? null,
    },
    create: {
      studentId,
      type,
      filePath: body.filePath,
      fileName: body.fileName ?? null,
      note: body.note ?? null,
      uploadedById: uploadedById ?? null,
    },
  });

  return getStudentDocumentsService(studentId);
};

// --------------------------------------------------
// حذف وثيقة
// --------------------------------------------------

export const deleteStudentDocumentService = async (
  studentId: string,
  type: string,
) => {
  await ensureStudent(studentId);

  const existing = await prisma.studentDocument.findUnique({
    where: { studentId_type: { studentId, type } },
    select: { id: true },
  });

  if (!existing) {
    throw new NotFoundException(
      "الوثيقة غير موجودة",
      ErrorCodeEnum.RESOURCE_NOT_FOUND,
    );
  }

  await prisma.studentDocument.delete({ where: { id: existing.id } });

  return getStudentDocumentsService(studentId);
};
