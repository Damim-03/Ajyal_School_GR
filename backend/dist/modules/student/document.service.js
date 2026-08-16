"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudentDocumentService = exports.putStudentDocumentService = exports.getStudentDocumentsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const document_types_1 = require("./document.types");
const documentSelect = {
    id: true,
    type: true,
    filePath: true,
    fileName: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    uploadedBy: { select: { id: true, username: true } },
};
const ensureStudent = async (studentId) => {
    const student = await client_1.prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true },
    });
    if (!student) {
        throw new app_errors_1.NotFoundException("Student not found", error_code_enum_1.ErrorCodeEnum.STUDENT_NOT_FOUND);
    }
};
// --------------------------------------------------
// قراءة ملف الطالب
//
// يُرجع الكتالوج كاملاً لا الموجود فقط: الواجهة تعرض خانةً لكل نوع
// — مملوءةً أو فارغة — فيرى المستخدم ما ينقص لا ما لديه فقط.
// --------------------------------------------------
const getStudentDocumentsService = async (studentId) => {
    await ensureStudent(studentId);
    const documents = await client_1.prisma.studentDocument.findMany({
        where: { studentId },
        select: documentSelect,
    });
    const byType = new Map(documents.map((d) => [d.type, d]));
    return {
        catalogue: document_types_1.DOCUMENT_TYPES.map((type) => ({
            ...type,
            document: byType.get(type.key) ?? null,
        })),
        completeness: (0, document_types_1.completenessOf)(documents.map((d) => d.type)),
    };
};
exports.getStudentDocumentsService = getStudentDocumentsService;
// --------------------------------------------------
// إرفاق وثيقة — استبدال لا تراكم
// --------------------------------------------------
const putStudentDocumentService = async (studentId, type, body, uploadedById) => {
    await ensureStudent(studentId);
    if (!(0, document_types_1.isKnownType)(type)) {
        throw new app_errors_1.BadRequestException(`نوع وثيقة غير معروف: ${type}`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    await client_1.prisma.studentDocument.upsert({
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
    return (0, exports.getStudentDocumentsService)(studentId);
};
exports.putStudentDocumentService = putStudentDocumentService;
// --------------------------------------------------
// حذف وثيقة
// --------------------------------------------------
const deleteStudentDocumentService = async (studentId, type) => {
    await ensureStudent(studentId);
    const existing = await client_1.prisma.studentDocument.findUnique({
        where: { studentId_type: { studentId, type } },
        select: { id: true },
    });
    if (!existing) {
        throw new app_errors_1.NotFoundException("الوثيقة غير موجودة", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    await client_1.prisma.studentDocument.delete({ where: { id: existing.id } });
    return (0, exports.getStudentDocumentsService)(studentId);
};
exports.deleteStudentDocumentService = deleteStudentDocumentService;
//# sourceMappingURL=document.service.js.map