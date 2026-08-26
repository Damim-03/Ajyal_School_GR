"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTeacherDocumentService = exports.putTeacherDocumentService = exports.getTeacherDocumentsService = void 0;
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const document_types_1 = require("./document.types");
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
};
const ensureTeacher = async (teacherId) => {
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: { id: true },
    });
    if (!teacher) {
        throw new app_errors_1.NotFoundException("Teacher not found", error_code_enum_1.ErrorCodeEnum.TEACHER_NOT_FOUND);
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
const getTeacherDocumentsService = async (teacherId) => {
    await ensureTeacher(teacherId);
    const documents = await client_1.prisma.teacherDocument.findMany({
        where: { teacherId },
        select: documentSelect,
        orderBy: { createdAt: "asc" },
    });
    const byType = new Map(documents.map((d) => [d.type, d]));
    const standard = document_types_1.TEACHER_DOCUMENT_TYPES.map((type) => ({
        ...type,
        custom: false,
        document: byType.get(type.key) ?? null,
    }));
    const custom = documents
        .filter((d) => (0, document_types_1.isCustomType)(d.type))
        .map((d) => ({
        key: d.type,
        label: d.label ?? "وثيقة",
        hint: undefined,
        custom: true,
        document: d,
    }));
    return {
        catalogue: [...standard, ...custom],
        /* عدّةٌ لا اكتمال: الإلزامُ ليس في الشيفرة، فلا نسبةَ تُحسب */
        delivered: documents.length,
    };
};
exports.getTeacherDocumentsService = getTeacherDocumentsService;
// --------------------------------------------------
// إرفاق وثيقة — استبدال لا تراكم
// --------------------------------------------------
const putTeacherDocumentService = async (teacherId, type, body, uploadedById) => {
    await ensureTeacher(teacherId);
    if (!(0, document_types_1.isKnownTeacherType)(type)) {
        throw new app_errors_1.BadRequestException(`نوع وثيقة غير معروف: ${type}`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    /*
     * التسمية إلزاميةٌ للنوع المضاف وحده.
     *
     * لأنّها مصدرُها الوحيد: لا كتالوجَ في الشيفرة يحمل اسمَ
     * `custom_a1b2c3`، فصفٌّ بلا تسميةٍ يظهر في الملفّ «وثيقة» ولا يعرف
     * أحدٌ ما هي بعد شهر.
     */
    const label = body.label?.trim() || null;
    if ((0, document_types_1.isCustomType)(type) && !label) {
        throw new app_errors_1.BadRequestException("تسمية الوثيقة مطلوبة", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    await client_1.prisma.teacherDocument.upsert({
        where: { teacherId_type: { teacherId, type } },
        update: {
            filePath: body.filePath,
            fileName: body.fileName ?? null,
            note: body.note ?? null,
            /* التسميةُ لا تُمحى بإعادة رفعٍ لم تحملها */
            ...((0, document_types_1.isCustomType)(type) && label ? { label } : {}),
            uploadedById: uploadedById ?? null,
        },
        create: {
            teacherId,
            type,
            label: (0, document_types_1.isCustomType)(type) ? label : null,
            filePath: body.filePath,
            fileName: body.fileName ?? null,
            note: body.note ?? null,
            uploadedById: uploadedById ?? null,
        },
    });
    return (0, exports.getTeacherDocumentsService)(teacherId);
};
exports.putTeacherDocumentService = putTeacherDocumentService;
// --------------------------------------------------
// حذف وثيقة
// --------------------------------------------------
const deleteTeacherDocumentService = async (teacherId, type) => {
    await ensureTeacher(teacherId);
    const existing = await client_1.prisma.teacherDocument.findUnique({
        where: { teacherId_type: { teacherId, type } },
        select: { id: true },
    });
    if (!existing) {
        throw new app_errors_1.NotFoundException("الوثيقة غير موجودة", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    await client_1.prisma.teacherDocument.delete({ where: { id: existing.id } });
    return (0, exports.getTeacherDocumentsService)(teacherId);
};
exports.deleteTeacherDocumentService = deleteTeacherDocumentService;
//# sourceMappingURL=document.service.js.map