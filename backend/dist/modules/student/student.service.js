"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteStudentService = exports.updateStudentService = exports.createStudentService = exports.getStudentEnrollmentsService = exports.getStudentService = exports.listStudentsService = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const student_number_1 = require("../../core/utils/student-number");
const document_types_1 = require("./document.types");
const text_match_1 = require("../../core/search/text-match");
const studentSelect = {
    id: true,
    studentNumber: true,
    firstName: true,
    lastName: true,
    gender: true,
    birthDate: true,
    birthPlace: true,
    avatar: true,
    phone: true,
    parentPhone: true,
    address: true,
    schoolName: true,
    emergencyPhone: true,
    registrationDate: true,
    registrationFeePaid: true,
    registrationFeeAmount: true,
    registrationFeePaidAt: true,
    note: true,
    isActive: true,
    levelId: true,
    createdAt: true,
    updatedAt: true,
    /*
     * المستوى ومعه طورُه — تطلبهما البطاقة وشاشة الطالب معاً، والطور
     * حقلٌ في جدولٍ ثالث فجلبُه هنا يوفّر طلباً لأجل سطر.
     */
    level: {
        select: {
            id: true,
            name: true,
            educationStage: { select: { id: true, name: true, type: true } },
        },
    },
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const student = await client_1.prisma.student.findUnique({
        where: { id },
        select: { id: true },
    });
    if (!student) {
        throw new app_errors_1.NotFoundException("Student not found", error_code_enum_1.ErrorCodeEnum.STUDENT_NOT_FOUND);
    }
    return student;
};
/**
 * المستوى المُسنَد موجودٌ ونشط.
 *
 * والمعطَّل يُرفض للجديد ولا يُرفض للقائم: مستوًى أُوقف بعد أن سُجّل
 * فيه طلبة يبقى مستواهم كما كان — الرفض هنا يمنع **اختياره**، لا
 * يُبطل ما مضى.
 */
const ensureLevelExists = async (levelId) => {
    const level = await client_1.prisma.level.findUnique({
        where: { id: levelId },
        select: { id: true, isActive: true },
    });
    if (!level) {
        throw new app_errors_1.NotFoundException("Level not found", error_code_enum_1.ErrorCodeEnum.LEVEL_NOT_FOUND);
    }
    if (!level.isActive) {
        throw new app_errors_1.ConflictException("Cannot assign a deactivated level", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
};
// --------------------------------------------------
// List
// --------------------------------------------------
/**
 * الاسمُ كما يُكتب على عجل — بلا همزةٍ ولا تاءٍ مربوطة.
 *
 * `utf8mb4_general_ci` تتغاضى عن حالة الحرف ولا تتغاضى عن شكله: من
 * كتب «اروى» لا يجد «أروى»، و«فاطمه» لا تجد «فاطمة». وهو أغلبُ ما
 * يُكتب في الشبّاك — الهمزة تُهمل عادةً في الكتابة السريعة — فكان
 * البحثُ يقول «لا نتيجة» عن طالبٍ موجود، فيُظنّ غيرَ مسجَّل.
 *
 * والعلاج في الاستعلام لا في القاعدة: الحروفُ المتشابهة تُبدَّل بـ`_`
 * وهي في LIKE «حرفٌ واحد أيّاً كان» — فـ«اروى» تصير «_روى» فتُطابق
 * «أروى» و«اروى» معاً. ولا تُصعَّد إلى `%` فيصير البحثُ فضفاضاً بلا
 * معنى.
 *
 * **وهي إضافةٌ لا استبدال:** الشروط الأصلية تبقى كما هي، فما كان
 * يُطابق يبقى مطابقاً وتُزاد عليه صورةٌ أوسع.
 *
 * وشرطان يحرسانها من أن تُعيد كلَّ شيء:
 *   • حرفان فأكثر — والحرفُ الواحد المبهَم يُطابق كلَّ شيء.
 *   • وأن يبقى فيها حرفٌ صريحٌ واحد على الأقلّ، فـ«ام» تصير «__»
 *     فتُرفض، و«ار» تصير «_ر» فتُقبل.
 */
/*
 * الحروفُ التي تُكتب على أوجه: الألف بهمزتها وبدونها، والهاءُ والتاء
 * المربوطة، والياءُ والألفُ المقصورة. والواوُ خارجها عمداً — «مؤمن»
 * و«مومن» أندرُ من أن تُدفع بها كلُّ واوٍ إلى الإبهام، وكلُّ حرفٍ
 * يُبهَم يُنقص دقّة البحث.
 */
const LOOSE = /[\u0627\u0623\u0625\u0622\u0671\u0629\u0647\u0649\u064A\u0626]/g;
const looseName = (search) => {
    const term = search.trim();
    if (term.length < 2)
        return [];
    const loose = term.replace(LOOSE, "_");
    if (loose === term)
        return [];
    /*
     * حرفٌ صريحٌ واحد يكفي — والخطرُ المحروسُ منه نمطٌ كلُّه إبهام:
     * «اوي» تصير «___» فتُطابق كلَّ اسمٍ من ثلاثة أحرف.
     */
    const literal = loose.length - (loose.match(/_/g)?.length ?? 0);
    if (literal === 0)
        return [];
    /* `_` يبقى إبهاماً هنا — وهو مقصودُ هذه الدالّة كلِّها */
    const pattern = `%${(0, text_match_1.escapeLike)(loose, true)}%`;
    return [
        { column: "firstName", pattern },
        { column: "lastName", pattern },
    ];
};
const listStudentsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    /* شروط الإسناد التدريسي المرتبط بتسجيلات الطالب */
    const assignmentFilter = {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
    };
    const hasEnrollmentFilter = Object.keys(assignmentFilter).length > 0;
    /*
     * فلتر المستوى — على الطالب أو على أفواجه.
     *
     * صار للطالب عمود `levelId` يُختار عند تسجيله، وكان الفلتر يمرّ عبر
     * الفوج وحده (تسجيل ← إسناد ← فوج ← مستوى). فلو بقي كذلك لغاب عن
     * القائمة كلُّ طالبٍ سُجّل ولم يُسنَد بعد — وهم بالضبط من يُبحث عنهم
     * لإسنادهم. والعكس أيضاً: صفٌّ لم تبلغه التعبئة الرجعية يبقى ظاهراً
     * بمستوى أفواجه. فالشرطان بـOR لا أحدهما.
     */
    const levelFilter = query.levelId
        ? {
            OR: [
                { levelId: query.levelId },
                {
                    enrollments: {
                        some: {
                            ...(query.includeInactiveEnrollments !== true && {
                                isActive: true,
                            }),
                            teachingAssignment: {
                                studyGroup: { levelId: query.levelId },
                            },
                        },
                    },
                },
            ],
        }
        : undefined;
    /*
     * مطابقةُ النصّ تُحلّ إلى معرّفات قبل الاستعلام — انظر
     * `core/search/text-match`. والسببُ ترتيبٌ صريح لا يقع معه تضارب،
     * وما عدا ذلك يبقى كما كان: المرشِّحاتُ والترقيمُ والأعمدة.
     */
    const searchIds = query.search
        ? await (0, text_match_1.matchTextIds)("Student", [
            ...(0, text_match_1.containsOn)(["firstName", "lastName", "phone", "parentPhone"], query.search),
            ...looseName(query.search),
        ])
        : null;
    const numberIds = query.studentNumber
        ? await (0, text_match_1.matchTextIds)("Student", (0, text_match_1.containsOn)(["studentNumber"], query.studentNumber))
        : null;
    const where = {
        ...(query.isActive !== undefined && { isActive: query.isActive }),
        ...(query.gender && { gender: query.gender }),
        ...(numberIds && { id: { in: numberIds } }),
        ...(query.search && {
            OR: [
                /*
                 * الرقم أوّلاً لأنّه المدخل الأسرع: ماسحُ الباركود يكتب رقم
                 * البطاقة في حقل البحث ويضغط Enter، فيُفتح الطالب بمسحةٍ بدل
                 * كتابة اسمه. والمطابقة تامّةٌ لا `contains` — «2026000014»
                 * جزءٌ من لا شيء، و`contains` كانت ستُعيد معه كلَّ رقمٍ يحويه.
                 *
                 * وهي مطابقةٌ تامّة فلا `LIKE` فيها، فتبقى في Prisma.
                 */
                { studentNumber: query.search },
                { id: { in: searchIds ?? [] } },
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
     * الشروط المركّبة تُجمَع في `AND` لا تُسنَد إلى `where` مباشرة:
     * فلتر المستوى واكتمالُ الملف كلاهما يحتاج `AND`، وإسنادُ الثاني
     * يمحو الأوّل صامتاً. و`OR` محجوزٌ للبحث النصّي أعلاه.
     */
    const and = [];
    if (levelFilter)
        and.push(levelFilter);
    /*
     * فلتر اكتمال الملف.
     *
     * «مكتمل» = يملك كلّ الأنواع المطلوبة، فيُترجَم إلى شرطٍ لكلّ نوع
     * على حدة. وهذا يبقيه استعلاماً واحداً يحترم الترقيم — بخلاف الترشيح
     * بعد الجلب الذي يكسر أعداد الصفحات.
     */
    if (query.documentsComplete !== undefined) {
        const hasAllRequired = document_types_1.REQUIRED_KEYS.map((type) => ({
            documents: { some: { type } },
        }));
        if (query.documentsComplete)
            and.push(...hasAllRequired);
        else
            where.NOT = { AND: hasAllRequired };
    }
    if (and.length > 0)
        where.AND = and;
    const [students, total] = await Promise.all([
        client_1.prisma.student.findMany({
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
        client_1.prisma.student.count({ where }),
    ]);
    return {
        students: students.map((student) => ({
            ...student,
            documentTypes: student.documents.map((d) => d.type),
            documents: undefined,
            completeness: (0, document_types_1.completenessOf)(student.documents.map((d) => d.type)),
        })),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listStudentsService = listStudentsService;
// --------------------------------------------------
// Get by id
// --------------------------------------------------
const getStudentService = async (id) => {
    await findOrThrow(id);
    return client_1.prisma.student.findUnique({
        where: { id },
        select: {
            ...studentSelect,
            _count: { select: { enrollments: true } },
        },
    });
};
exports.getStudentService = getStudentService;
// --------------------------------------------------
// Enrollments — GET /students/:id/enrollments
//
// المواد التي سجّل فيها الطالب، مع الأستاذ والفوج والسنة.
// --------------------------------------------------
const getStudentEnrollmentsService = async (id, query) => {
    await findOrThrow(id);
    return client_1.prisma.studentEnrollment.findMany({
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
exports.getStudentEnrollmentsService = getStudentEnrollmentsService;
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
const createStudentService = async (body) => {
    /* خارج الحلقة والمعاملة: فحصُ قراءةٍ لا يتغيّر بإعادة المحاولة */
    if (body.levelId)
        await ensureLevelExists(body.levelId);
    for (let attempt = 0; attempt < NUMBER_ATTEMPTS; attempt++) {
        try {
            return await client_1.prisma.$transaction(async (tx) => {
                const prefix = await (0, student_number_1.currentYearPrefix)(tx);
                return tx.student.create({
                    data: {
                        studentNumber: await (0, student_number_1.nextStudentNumber)(tx, prefix),
                        firstName: body.firstName,
                        lastName: body.lastName,
                        gender: body.gender,
                        birthDate: body.birthDate ?? null,
                        birthPlace: body.birthPlace ?? null,
                        avatar: body.avatar ?? null,
                        phone: body.phone ?? null,
                        parentPhone: body.parentPhone,
                        address: body.address ?? null,
                        schoolName: body.schoolName ?? null,
                        emergencyPhone: body.emergencyPhone ?? null,
                        levelId: body.levelId ?? null,
                        ...(body.registrationDate && { registrationDate: body.registrationDate }),
                        registrationFeePaid: body.registrationFeePaid ?? false,
                        registrationFeeAmount: body.registrationFeeAmount ?? null,
                        registrationFeePaidAt: body.registrationFeePaidAt ?? null,
                        note: body.note ?? null,
                        isActive: body.isActive ?? true,
                    },
                    select: studentSelect,
                });
            });
        }
        catch (error) {
            const clash = error instanceof prisma_1.Prisma.PrismaClientKnownRequestError &&
                error.code === "P2002" &&
                String(error.meta?.target ?? "").includes("studentNumber");
            if (!clash || attempt === NUMBER_ATTEMPTS - 1)
                throw error;
        }
    }
    /* لا يُبلَغ: الحلقة إمّا تُرجع أو ترمي في الدورة الأخيرة */
    throw new app_errors_1.ConflictException("Could not allocate a student number", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
};
exports.createStudentService = createStudentService;
// --------------------------------------------------
// Update
// --------------------------------------------------
const updateStudentService = async (id, body) => {
    await findOrThrow(id);
    /* `null` صريحٌ يمسح المستوى — الفحص للقيمة الفعلية وحدها */
    if (body.levelId)
        await ensureLevelExists(body.levelId);
    return client_1.prisma.student.update({
        where: { id },
        data: {
            ...(body.levelId !== undefined && { levelId: body.levelId ?? null }),
            ...(body.firstName !== undefined && { firstName: body.firstName }),
            ...(body.lastName !== undefined && { lastName: body.lastName }),
            ...(body.gender !== undefined && { gender: body.gender }),
            ...(body.birthDate !== undefined && { birthDate: body.birthDate }),
            ...(body.birthPlace !== undefined && { birthPlace: body.birthPlace }),
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
            /* حقوق التسجيل — ثلاثةُ حقولٍ تُرسَل معاً أو منفردة */
            ...(body.registrationFeePaid !== undefined && {
                registrationFeePaid: body.registrationFeePaid,
            }),
            ...(body.registrationFeeAmount !== undefined && {
                registrationFeeAmount: body.registrationFeeAmount,
            }),
            ...(body.registrationFeePaidAt !== undefined && {
                registrationFeePaidAt: body.registrationFeePaidAt,
            }),
            ...(body.note !== undefined && { note: body.note }),
            ...(body.isActive !== undefined && { isActive: body.isActive }),
        },
        select: studentSelect,
    });
};
exports.updateStudentService = updateStudentService;
// --------------------------------------------------
// Delete — ممنوع إن كان مسجَّلاً في أي مادة
// --------------------------------------------------
const deleteStudentService = async (id) => {
    await findOrThrow(id);
    const enrollments = await client_1.prisma.studentEnrollment.count({
        where: { studentId: id },
    });
    if (enrollments > 0) {
        throw new app_errors_1.ConflictException(`Cannot delete: student has ${enrollments} enrollment(s). ` +
            `Deactivate the student instead.`, error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    await client_1.prisma.student.delete({ where: { id } });
};
exports.deleteStudentService = deleteStudentService;
//# sourceMappingURL=student.service.js.map