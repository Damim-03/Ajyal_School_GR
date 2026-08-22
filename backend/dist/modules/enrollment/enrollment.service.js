"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteEnrollmentService = exports.cancelPendingTransferService = exports.runPendingTransfersService = exports.transferEnrollmentService = exports.updateEnrollmentService = exports.createEnrollmentService = exports.getEnrollmentService = exports.listEnrollmentsService = void 0;
const client_1 = require("../../core/prisma/client");
const sessions_value_1 = require("../../core/pricing/sessions-value");
const invoice_service_1 = require("../invoice/invoice.service");
const school_schema_1 = require("../school/school.schema");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const enrollmentSelect = {
    id: true,
    studentId: true,
    teachingAssignmentId: true,
    enrolledAt: true,
    isActive: true,
    /** خبرُ التسجيل — يكتبه النقلُ ويقرؤه عمودُ «ملاحظات» في الكشف */
    note: true,
    /** مقصدُ زرّ الملاحظة، والكشفان: كشفُ هذا الفوج وكشفُ الآخر */
    transferPeerAssignmentId: true,
    transferSheetId: true,
    transferPeerSheetId: true,
    /** يومُ النقل — به تُفصل حصصُه عن حصص غيره في الكشف */
    transferAt: true,
    /** نقلٌ قُرِّر ولم يسرِ بعد — يُعرض في الكشف ولا يُخرج الطالب منه */
    pendingTransferToId: true,
    pendingTransferAt: true,
    pendingTransferSheetId: true,
    student: {
        select: {
            id: true,
            /*
             * رقمُ التسجيل — به يُبحث في الفوج ويُمسح باركود البطاقة.
             *
             * وبدونه كان البحثُ بالرقم في شاشة الإسناد يطابق فراغاً، والمسحُ
             * يقول «لا وجود لهذا الطالب في هذا الفوج» وهو فيه.
             */
            studentNumber: true,
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
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const enrollment = await client_1.prisma.studentEnrollment.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!enrollment) {
        throw new app_errors_1.NotFoundException("Enrollment not found", error_code_enum_1.ErrorCodeEnum.ENROLLMENT_NOT_FOUND);
    }
    return enrollment;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listEnrollmentsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    // الفلاتر على الإسناد تُمرَّر عبر العلاقة
    const assignmentFilter = {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
    };
    const where = {
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
        client_1.prisma.studentEnrollment.findMany({
            where,
            select: {
                ...enrollmentSelect,
                _count: { select: { invoices: true, attendances: true } },
            },
            skip,
            take,
            orderBy: { enrolledAt: "desc" },
        }),
        client_1.prisma.studentEnrollment.count({ where }),
    ]);
    return { enrollments, pagination: (0, api_response_1.buildPagination)(total, page, limit) };
};
exports.listEnrollmentsService = listEnrollmentsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getEnrollmentService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.studentEnrollment.findUnique({
        where: { id },
        select: {
            ...enrollmentSelect,
            _count: { select: { invoices: true, attendances: true } },
        },
    });
};
exports.getEnrollmentService = getEnrollmentService;
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
const createEnrollmentService = async (body) => {
    const { studentId, teachingAssignmentIds } = body;
    // 1. الطالب
    const student = await client_1.prisma.student.findUnique({
        where: { id: studentId },
        select: { id: true, isActive: true },
    });
    if (!student) {
        throw new app_errors_1.NotFoundException("Student not found", error_code_enum_1.ErrorCodeEnum.STUDENT_NOT_FOUND);
    }
    if (!student.isActive) {
        throw new app_errors_1.BadRequestException("Cannot enroll an inactive student", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    // 2. الإسنادات — نجلبها كلها دفعة واحدة
    const assignments = await client_1.prisma.teachingAssignment.findMany({
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
        throw new app_errors_1.NotFoundException(`Teaching assignment(s) not found: ${missing.join(", ")}`, error_code_enum_1.ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND);
    }
    const inactive = assignments.filter((a) => !a.isActive);
    if (inactive.length > 0) {
        throw new app_errors_1.BadRequestException(`Cannot enroll in inactive teaching assignment(s): ` +
            inactive.map((a) => a.subject.name).join(", "), error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    // 3. تسجيلات سابقة
    const existing = await client_1.prisma.studentEnrollment.findMany({
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
        throw new app_errors_1.ConflictException(`Student is already enrolled in: ` +
            existing.map((e) => e.teachingAssignment.subject.name).join(", "), error_code_enum_1.ErrorCodeEnum.ENROLLMENT_ALREADY_EXISTS);
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
    const identity = (a) => `${a.subjectId}|${a.studyGroupId}|${a.academicYearId}`;
    const withinRequest = new Map();
    for (const assignment of assignments) {
        const key = identity(assignment);
        const twin = withinRequest.get(key);
        if (twin) {
            throw new app_errors_1.ConflictException(`Duplicate subject in this request: '${assignment.subject.name}' for ` +
                `group '${assignment.studyGroup.name}' appears twice ` +
                `(${twin} / ${assignment.teacher.lastName} ${assignment.teacher.firstName}). ` +
                `Pick one teacher.`, error_code_enum_1.ErrorCodeEnum.ENROLLMENT_ALREADY_EXISTS);
        }
        withinRequest.set(key, `${assignment.teacher.lastName} ${assignment.teacher.firstName}`);
    }
    const sameSubject = await client_1.prisma.studentEnrollment.findMany({
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
        throw new app_errors_1.ConflictException(`Student is already enrolled in the same subject with another teacher: ` +
            sameSubject
                .map((e) => `${e.teachingAssignment.subject.name} — ` +
                `${e.teachingAssignment.studyGroup.name} ` +
                `(${e.teachingAssignment.teacher.lastName} ${e.teachingAssignment.teacher.firstName})`)
                .join(", "), error_code_enum_1.ErrorCodeEnum.ENROLLMENT_ALREADY_EXISTS);
    }
    // 4. طاقة الأفواج
    //    الطالب يُحتسب مرة واحدة في الفوج مهما تعددت مواده،
    //    لذلك نفحص كل فوج مرة واحدة ونتجاهل الطالب إن كان فيه أصلاً.
    const groupIds = [...new Set(assignments.map((a) => a.studyGroupId))];
    for (const groupId of groupIds) {
        const group = assignments.find((a) => a.studyGroupId === groupId)
            .studyGroup;
        if (!group.maxStudents)
            continue;
        const alreadyInGroup = await client_1.prisma.student.count({
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
        if (alreadyInGroup > 0)
            continue;
        const currentCount = await client_1.prisma.student.count({
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
            throw new app_errors_1.ConflictException(`Study group '${group.name}' is full ` +
                `(${currentCount}/${group.maxStudents})`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
        }
    }
    // 5. الكتابة
    const enrolledAt = body.enrolledAt ?? new Date();
    const created = await client_1.prisma.$transaction(teachingAssignmentIds.map((teachingAssignmentId) => client_1.prisma.studentEnrollment.create({
        data: { studentId, teachingAssignmentId, enrolledAt },
        select: enrollmentSelect,
    })));
    return created;
};
exports.createEnrollmentService = createEnrollmentService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateEnrollmentService = async (id, body) => {
    await findOrThrow(id);
    return client_1.prisma.studentEnrollment.update({
        where: { id },
        data: {
            ...(body.isActive !== undefined && { isActive: body.isActive }),
            ...(body.enrolledAt !== undefined && { enrolledAt: body.enrolledAt }),
        },
        select: enrollmentSelect,
    });
};
exports.updateEnrollmentService = updateEnrollmentService;
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
/**
 * كشفُ الإسناد الجاري — أعلاها رقماً.
 *
 * ملجأٌ حين يعجز التقويم. فالكشفُ لا يُشتقّ من نافذة تواريخ — ورقتُه
 * تحمل «الشهر 6» لا «فيفري» — فقد تُدوَّن حصصُ أفريل ويقع النقلُ في
 * أوت، فلا يجد `monthSheet` كشفاً لأوت ويخرج فارغاً. وفارغُه زرٌّ
 * يفتح الفوجَ على كشفه الافتراضيّ: ورقةٌ لا صلة لها بالنقل.
 */
const runningSheetId = async (teachingAssignmentId) => (await client_1.prisma.attendanceSheet.findFirst({
    where: { teachingAssignmentId },
    orderBy: { number: "desc" },
    select: { id: true },
}))?.id ?? null;
/**
 * الكشفُ الذي غادره — أحدثُ ورقةٍ كان فيها **فعلاً**.
 *
 * وليس الجاري: النقلُ المؤجَّل يُنفِّذه إنشاءُ كشفٍ جديد للفوج، فيقع
 * بعد ميلاد تلك الورقة بأجزاء من الثانية. فلو قيل «الجاري» لأشار
 * الزرُّ إلى الورقة الوحيدة التي **لم** يكن فيها — وهي بعينها الورقة
 * التي غادر قبل أن تبدأ.
 *
 * ولا التقويم: `took.sheets` تُصفّى بشهر تاريخ النقل، فحصصُ أفريل
 * ونقلٌ في أوت يخرجان فارغين.
 *
 * فالمقياسُ أثرُه هو: أحدثُ كشفٍ له فيه علامةُ حضور. فإن لم يُعلَّم
 * له بعد فأحدثُ كشفٍ بدأت حصصُه — كان فيه ولمّا يُحضر. وإن كانت
 * الكشوفُ كلُّها فارغةً فأحدثُها، إذ لا أثرَ يُرجَّح به.
 *
 * وهو مقصدُ الزرّ ومقياسُ العرض معاً: في هذا الكشف وحده يُقال «غادر
 * في أثنائه»، فلا يُنسب رحيلُه إلى ورقةٍ لم يبلغها.
 */
const sheetLeftFrom = async (teachingAssignmentId, enrollmentId) => {
    const sheets = await client_1.prisma.attendanceSheet.findMany({
        where: { teachingAssignmentId },
        orderBy: { number: "desc" },
        select: {
            id: true,
            _count: { select: { sessions: true } },
            sessions: {
                where: { attendances: { some: { studentEnrollmentId: enrollmentId } } },
                select: { id: true },
                take: 1,
            },
        },
    });
    return (sheets.find((sheet) => sheet.sessions.length > 0)?.id ??
        sheets.find((sheet) => sheet._count.sessions > 0)?.id ??
        sheets[0]?.id ??
        null);
};
const transferEnrollmentService = async (id, body) => {
    const current = await client_1.prisma.studentEnrollment.findUnique({
        where: { id },
        select: {
            id: true,
            studentId: true,
            teachingAssignmentId: true,
            isActive: true,
            /** منه تُعرف حصصُه إن التحق متأخّراً — وفارغُه عضويةٌ من البداية */
            eligibleFrom: true,
            teachingAssignment: {
                select: {
                    subjectId: true,
                    studyGroupId: true,
                    academicYearId: true,
                    subject: { select: { name: true } },
                    studyGroup: { select: { name: true } },
                    teacher: { select: { firstName: true, lastName: true } },
                },
            },
        },
    });
    if (!current) {
        throw new app_errors_1.NotFoundException("Enrollment not found", error_code_enum_1.ErrorCodeEnum.ENROLLMENT_NOT_FOUND);
    }
    if (current.teachingAssignmentId === body.teachingAssignmentId) {
        throw new app_errors_1.BadRequestException("الطالب مُسند إلى هذا الفوج بالفعل — اختر فوجاً آخر", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const target = await client_1.prisma.teachingAssignment.findUnique({
        where: { id: body.teachingAssignmentId },
        select: {
            id: true,
            isActive: true,
            subjectId: true,
            studyGroupId: true,
            academicYearId: true,
            subject: { select: { name: true } },
            teacher: { select: { firstName: true, lastName: true } },
            studyGroup: {
                select: { id: true, name: true, maxStudents: true },
            },
        },
    });
    if (!target) {
        throw new app_errors_1.NotFoundException("Target teaching assignment not found", error_code_enum_1.ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND);
    }
    if (!target.isActive) {
        throw new app_errors_1.BadRequestException("Cannot transfer into an inactive teaching assignment", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    // النقل داخل السنة نفسها — عبر السنوات تسجيلٌ جديد لا نقل
    if (target.academicYearId !== current.teachingAssignment.academicYearId) {
        throw new app_errors_1.BadRequestException("النقل لا يعبر السنوات الدراسية — سجّل الطالب في السنة الجديدة بدل نقله", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    // المادة نفسها: النقل تغييرُ فوجٍ أو أستاذ لا تغييرُ مادة.
    // تغييرُ المادة إسنادٌ جديد وإلغاءٌ للقديم، لا نقل.
    if (target.subjectId !== current.teachingAssignment.subjectId) {
        throw new app_errors_1.BadRequestException(`النقل يبقي المادة نفسها — من «${current.teachingAssignment.subject.name}» ` +
            `إلى «${target.subject.name}» ليس نقلاً. عطّل الإسناد القديم وأسند الجديد.`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    // تسجيلٌ سابق في الوجهة — يُحيا بدل أن يُنشأ نظير له
    const existingAtTarget = await client_1.prisma.studentEnrollment.findUnique({
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
        const alreadyInGroup = await client_1.prisma.studentEnrollment.count({
            where: {
                studentId: current.studentId,
                isActive: true,
                teachingAssignmentId: { not: current.id },
                teachingAssignment: { studyGroupId: target.studyGroupId },
            },
        });
        if (alreadyInGroup === 0) {
            const currentCount = await client_1.prisma.student.count({
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
                throw new app_errors_1.ConflictException(`الفوج «${target.studyGroup.name}» ممتلئ ` +
                    `(${currentCount}/${target.studyGroup.maxStudents})`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
            }
        }
    }
    const on = body.enrolledAt ?? new Date();
    /*
     * القرارُ يُكتب ولا يُنفَّذ — والطالب يبقى حيث هو.
     *
     * النقلُ في منتصف الكشف يُجزّئ الشهر بين فوجين، ومجموعُ حصصه
     * فيهما يتجاوز سقفَ الشهر حين يتداخل التقويمان. فيُؤجَّل السريان
     * إلى أوّل كشفٍ جديد: يُكمل شهره حيث هو ويُفوتَر كاملاً، ويبدأ
     * الجديد من عموده الأوّل. ولا حسابَ يُقسَّم فلا خطأ فيه.
     *
     * ويبقى التسجيلُ **نشطاً**: الحضورُ يُدوَّن والفاتورةُ تُولَّد كما
     * لو لم يكن قرار. وما تغيّر إنّما هو ملاحظتُه — تقول لمن ينظر إلى
     * أين يذهب ومتى.
     */
    if (body.defer) {
        const day = on.toLocaleDateString("fr-DZ", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
        });
        /* الكشفُ الجاري — إنشاءُ غيرِه هو ما يُطلق التنفيذ */
        const running = await client_1.prisma.attendanceSheet.findFirst({
            where: { teachingAssignmentId: current.teachingAssignmentId },
            orderBy: { number: "desc" },
            select: { id: true, number: true, label: true },
        });
        /**
         * الملاحظةُ تسمّي فوجَ المصدر صراحةً.
         *
         * كانت تقول «عند انتهاء هذا الكشف»، و«هذا» بلا مرجعٍ عند من يقرأ:
         * أكشفُ الفوج المغادَر أم كشفُ الوافد إليه؟ فيُنشئ كشفاً للفوج
         * الآخر وينتظر نقلاً لا يقع — والمُطلِقُ كشفُ المصدر وحده.
         *
         * وحين لا كشفَ جارياً تتبدّل الصيغة كلُّها: لا معنى لـ«انتهاء هذا
         * الكشف» وما من كشفٍ أصلاً، فيُقال إنّ أوّل كشفٍ يُنشأ هو المُنفِّذ.
         */
        const fromGroup = current.teachingAssignment.studyGroup.name;
        const trigger = running
            ? `عند انتهاء كشف «${fromGroup}» الجاري (${running.label?.trim() || `الشهر رقم ${running.number}`})`
            : `عند إنشاء كشفٍ جديد لـ«${fromGroup}»`;
        const moved = await client_1.prisma.studentEnrollment.update({
            where: { id },
            data: {
                pendingTransferToId: target.id,
                pendingTransferAt: on,
                pendingTransferSheetId: running?.id ?? null,
                note: `سيُنقل إلى «${target.studyGroup.name}» ${trigger} — قُرِّر في ${day}`.slice(0, 255),
            },
            select: enrollmentSelect,
        });
        return {
            from: {
                id: current.id,
                subject: current.teachingAssignment.subject.name,
                studyGroup: current.teachingAssignment.studyGroup.name,
            },
            to: moved,
            revived: false,
            /** لم يقع النقل بعد — يقع عند إنشاء الكشف التالي */
            pending: true,
        };
    }
    /*
     * أثرُ النقل يُكتب في التسجيلين — لا في الطالب.
     *
     * الأستاذُ يفتح كشفه فيجد اسماً لم يكن فيه أمس، أو يجد اسماً غاب
     * بلا خبر. وليس له أن يسأل الإدارة عن كلّ اسم: فيُكتب الخبرُ حيث
     * ينظر، في عمود «ملاحظات».
     *
     * وفي **التسجيل** لا في `Student.note`: تلك ملاحظةٌ واحدةٌ للطالب
     * في المؤسسة كلِّها يكتبها الموظّف بيده — والكتابةُ فيها تطمس ما
     * كتب، وتُخبر أستاذَ الفرنسية بنقلٍ وقع في الإنجليزية.
     */
    const day = on.toLocaleDateString("fr-DZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        timeZone: "UTC",
    });
    const fromGroup = current.teachingAssignment.studyGroup.name;
    const toGroup = target.studyGroup.name;
    /*
     * قيمةُ ما أخذه من الفوج القديم — تُكتب مع الخبر لا تُترك للحساب.
     *
     * «درس أربع حصصٍ ثمّ انتقل» سؤالٌ مالي يُطرح بعد شهرٍ حين لا أحد
     * يذكر متى انتقل ولا كم كان سعرُ الحصة يومها. فيُثبَّت الجواب لحظةَ
     * وقوعه بقاعدة الفاتورة نفسها.
     *
     * ولا سعرَ فلا رقم: إن لم يُضبط حقُّ الاشتراك للفوج بقي الخبرُ
     * تاريخاً بلا مال — أهونُ من رقمٍ مخترَع يُبنى عليه قرار.
     */
    const took = await (0, sessions_value_1.valueOfSessionsTaken)({
        teachingAssignmentId: current.teachingAssignmentId,
        subjectId: current.teachingAssignment.subjectId,
        studyGroupId: current.teachingAssignment.studyGroupId,
        academicYearId: current.teachingAssignment.academicYearId,
        eligibleFrom: current.eligibleFrom,
        until: on,
    });
    const currency = (await client_1.prisma.setting.findUnique({
        where: { key: "school.currency" },
        select: { value: true },
    }))?.value?.trim() || school_schema_1.SCHOOL_DEFAULTS["school.currency"];
    /**
     * «أُجريت له هنا 5 حصص من 8 — كشف الشهر رقم 1، حقُّ المؤسسة 937.50 دج»
     *
     * **ولا يُقال «درس».** الفعلُ يُفهم حضوراً، فيقرأ الموظّف «درس 5»
     * ويرى في السطر نفسه «0 / 5» وخمسَ غياباتٍ حمراء، فيظنّ الرقمين
     * متناقضين. وليسا: الخمسُ ما **أُجري له** وهو في الفوج، والصفرُ ما
     * جلسه منها. والحقُّ يُحسب على الأولى لا على الثانية — وهي قاعدةُ
     * `eligibility` نفسها: «الغيابُ لا يُنقص شيئاً».
     *
     * والكشفُ يُذكر لأنّه المرجع: من أراد التثبّت بعد شهرٍ يفتح ورقةً
     * بعينها، ولا يكفيه «5 من 8» ليعرف أيَّ ورقةٍ يفتح.
     */
    const tookLine = (where) => {
        if (!took || took.taken === 0)
            return "";
        const titles = took.sheets.map(sessions_value_1.sheetTitle);
        /* كشفٌ واحد في الغالب — والكشفُ وحدةٌ إدارية فقد يلمس الشهرَ كشفان */
        const from = titles.length === 1
            ? ` — كشف ${titles[0]}`
            : titles.length > 1
                ? ` — كشفا ${titles.join(" و")}`
                : "";
        const count = took.taken === 1
            ? `حصةٌ واحدة من ${took.approved}`
            : `${took.taken} حصص من ${took.approved}`;
        return (` · أُجريت له ${where} ${count}${from}، ` +
            `حقُّ المؤسسة عنها ${took.amount.toFixed(2)} ${currency}`);
    };
    /* العمودُ 255 حرفاً — واسمُ فوجٍ طويلٌ لا يُسقط الحفظ */
    const trim = (text) => text.slice(0, 255);
    /*
     * كشفُ الانقسام — واحدٌ يُحفظ في الجانبين.
     *
     * منه يفتح الوافدُ الكشفَ القديم مباشرةً، وفيه وحده يُعرض المغادِر
     * في كشف فوجه السابق: من غادر في كشف مارس لا شأن له بكشف جانفي.
     *
     * وآخرُ كشوفه لا أوّلُها حين لمس الشهرَ كشفان: المغادرةُ وقعت في
     * الأحدث. فإن لم يُعرف له كشفٌ من التقويم — وحصصُ أفريل مع نقلٍ في
     * أوت لا يجتمعان في شهر — فأثرُه في الكشوف هو الحَكَم، لا الفراغ.
     */
    const lastTookSheetId = took?.sheets.length
        ? took.sheets[took.sheets.length - 1].id
        : null;
    const splitSheetId = lastTookSheetId ?? (await sheetLeftFrom(current.teachingAssignmentId, id));
    /*
     * وكشفُ الفوج الآخر في الشهر نفسه — إليه يذهب زرُّ المغادِر.
     *
     * ولا يكفي أن يُمرَّر كشفُ الفوج القديم إلى الجديد: ليس من كشوفه،
     * فيسقط الاختيار ويُفتح كشفُه الافتراضيّ — شهرٌ لا صلة له بالنقل.
     * والمقياسُ `monthSheet` نفسُه الذي تُنسب به الفواتير، فلا يفترق
     * زرٌّ عن فاتورة في تحديد «كشف هذا الشهر». فإن لم يجد — والكشفُ
     * لا يُشتقّ من التقويم فقد لا يوافق شهرُ حصصه شهرَ النقل — فالجاري.
     */
    const peerSheetId = (await (0, invoice_service_1.monthSheet)(target.id, on.getUTCFullYear(), on.getUTCMonth() + 1)) ??
        (await runningSheetId(target.id));
    const [, moved] = await client_1.prisma.$transaction([
        // القديم يُعطَّل ولا يُحذف — فواتيره وحضوره تبقى معلَّقة به
        client_1.prisma.studentEnrollment.update({
            where: { id },
            data: {
                isActive: false,
                note: trim(`نُقل إلى «${toGroup}» — ${day}${tookLine("هنا")}`),
                transferAt: on,
                /* من هنا يُفتح الفوجُ الذي ذهب إليه — عند كشفه هو */
                transferPeerAssignmentId: target.id,
                transferSheetId: splitSheetId,
                transferPeerSheetId: peerSheetId,
                /*
                  وقع النقلُ فسقط تعليقُه.
        
                  ولولا هذا لبقي `pendingTransferToId` مكتوباً بعد التنفيذ،
                  فأعاد `runPendingTransfers` نقلَه عند كلّ كشفٍ يُفتح — نقلاً
                  لا يطلبه أحد، ذهاباً وإياباً بين الفوجين إلى آخر السنة.
                */
                pendingTransferToId: null,
                pendingTransferAt: null,
                pendingTransferSheetId: null,
            },
        }),
        existingAtTarget
            ? client_1.prisma.studentEnrollment.update({
                where: { id: existingAtTarget.id },
                data: {
                    isActive: true,
                    enrolledAt: on,
                    /*
                      «درس في «الفوج 1»» لا «درس فيه»: السطرُ يُقرأ في كشف
                      الفوج الجديد، والضميرُ فيه يعود — في عين القارئ — إلى
                      الفوج الذي أمامه. فيُسمّى الفوجُ صراحةً، وإلّا فُهم أنّ
                      الخمسَ حصصٌ أخذها هنا وهي حصصُ فوجه السابق.
                    */
                    note: trim(`مُنقَل من «${fromGroup}» — ${day}${tookLine(`في «${fromGroup}»`)}`),
                    /* ومن هنا يُفتح الكشفُ الذي جاء منه */
                    transferPeerAssignmentId: current.teachingAssignmentId,
                    transferSheetId: peerSheetId,
                    transferPeerSheetId: splitSheetId,
                    pendingTransferToId: null,
                    pendingTransferAt: null,
                    pendingTransferSheetId: null,
                    transferAt: on,
                },
                select: enrollmentSelect,
            })
            : client_1.prisma.studentEnrollment.create({
                data: {
                    studentId: current.studentId,
                    teachingAssignmentId: target.id,
                    enrolledAt: on,
                    /*
                      «درس في «الفوج 1»» لا «درس فيه»: السطرُ يُقرأ في كشف
                      الفوج الجديد، والضميرُ فيه يعود — في عين القارئ — إلى
                      الفوج الذي أمامه. فيُسمّى الفوجُ صراحةً، وإلّا فُهم أنّ
                      الخمسَ حصصٌ أخذها هنا وهي حصصُ فوجه السابق.
                    */
                    note: trim(`مُنقَل من «${fromGroup}» — ${day}${tookLine(`في «${fromGroup}»`)}`),
                    /* ومن هنا يُفتح الكشفُ الذي جاء منه */
                    transferPeerAssignmentId: current.teachingAssignmentId,
                    transferSheetId: peerSheetId,
                    transferPeerSheetId: splitSheetId,
                    pendingTransferToId: null,
                    pendingTransferAt: null,
                    pendingTransferSheetId: null,
                    transferAt: on,
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
exports.transferEnrollmentService = transferEnrollmentService;
/**
 * تنفيذُ النقول المؤجَّلة لإسنادٍ فتح كشفاً جديداً.
 *
 * يُنادى من `createSheetService` بعد إنشاء الكشف. وشرطُه أن يكون
 * الكشفُ الجديد **غيرَ** الذي قُرِّر النقلُ في أثنائه — وإلّا سرى
 * النقلُ في اللحظة نفسها التي قُرِّر فيها. ومَن قُرِّر نقلُه ولا كشفَ
 * جارٍ لفوجه يُنفَّذ عند أوّل كشفٍ كائناً ما كان.
 *
 * ولا يُوقفه فشلُ واحد: طالبٌ صار فوجُه الجديد ممتلئاً بين القرار
 * والتنفيذ يُترك معلَّقاً بملاحظته، ويُنقل الباقون. فالخطأ في حالةٍ
 * لا يُجمّد البقيّة، والمعلَّقُ يبقى ظاهراً لمن يُصلحه.
 */
const runPendingTransfersService = async (teachingAssignmentId, newSheetId) => {
    const due = await client_1.prisma.studentEnrollment.findMany({
        where: {
            teachingAssignmentId,
            isActive: true,
            pendingTransferToId: { not: null },
            /**
             * «كشفٌ غيرُ الذي قُرِّر فيه» — والفارغُ داخلٌ في المعنى.
             *
             * `NOT: { pendingTransferSheetId: newSheetId }` وحدَه يُسقط الفارغ:
             * SQL تحسب `NULL = 'x'` فارغةً و`NOT NULL` فارغةً، والفارغُ ليس
             * TRUE فيسقط الصفّ. فمَن قُرِّر نقلُه ولا كشفَ جارٍ لفوجه — وهو
             * حالُ أوّل نقلٍ في سنةٍ لم يُفتح فيها كشفٌ بعد — كان يعلَق أبداً:
             * لا كشفَ يُطلقه لأنّه غائبٌ عن النتيجة أصلاً.
             */
            OR: [
                { pendingTransferSheetId: null },
                { pendingTransferSheetId: { not: newSheetId } },
            ],
        },
        select: { id: true, pendingTransferToId: true, pendingTransferAt: true },
    });
    const moved = [];
    const failed = [];
    for (const row of due) {
        try {
            await (0, exports.transferEnrollmentService)(row.id, {
                teachingAssignmentId: row.pendingTransferToId,
                /* يومُ السريان هو اليوم لا يومُ القرار — الحصصُ تُقسم عليه */
                enrolledAt: new Date(),
                /* وهنا يقع فعلاً — لا يُؤجَّل ثانية */
                defer: false,
            });
            moved.push(row.id);
        }
        catch (error) {
            failed.push({
                id: row.id,
                reason: error instanceof Error ? error.message : "خطأ غير متوقّع",
            });
        }
    }
    return { moved: moved.length, failed };
};
exports.runPendingTransfersService = runPendingTransfersService;
/** إلغاءُ نقلٍ مؤجَّلٍ قبل أن يسري — يُعيد التسجيل كما كان */
const cancelPendingTransferService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.studentEnrollment.update({
        where: { id },
        data: {
            pendingTransferToId: null,
            pendingTransferAt: null,
            pendingTransferSheetId: null,
            note: null,
        },
        select: enrollmentSelect,
    });
};
exports.cancelPendingTransferService = cancelPendingTransferService;
// --------------------------------------------------
// Delete — ممنوع إن كان له فواتير أو حذف
// --------------------------------------------------
const deleteEnrollmentService = async (id) => {
    await findOrThrow(id);
    const relations = await client_1.prisma.studentEnrollment.findUnique({
        where: { id },
        select: { _count: { select: { invoices: true, attendances: true } } },
    });
    const invoices = relations?._count.invoices ?? 0;
    const attendances = relations?._count.attendances ?? 0;
    if (invoices > 0 || attendances > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: enrollment has ${invoices} invoice(s) and ` +
            `${attendances} attendance record(s). Deactivate it instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.studentEnrollment.delete({ where: { id } });
};
exports.deleteEnrollmentService = deleteEnrollmentService;
//# sourceMappingURL=enrollment.service.js.map