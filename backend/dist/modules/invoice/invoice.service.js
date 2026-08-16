"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelInvoiceService = exports.updateInvoiceService = exports.generateInvoicesService = exports.createInvoiceService = exports.getInvoiceService = exports.listInvoicesService = void 0;
const prisma_1 = require("../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const document_number_1 = require("../../core/utils/document-number");
const tuition_scope_1 = require("../../core/pricing/tuition-scope");
const eligibility_1 = require("../../core/pricing/eligibility");
/**
 * الدفعات الموزَّعة على الفاتورة — في القائمة كما في التفصيل.
 *
 * كانت في التفصيل وحده، فكان كشفُ حقوقٍ يعرض ثلاثين طالباً مضطراً إلى
 * ثلاثين طلباً ليكتب عمود «التاريخ». والتاريخ ليس زينة: الورقة تُوقَّع
 * على «دُفع في 13/01» لا على «مسدَّدة».
 */
const paymentInvoicesSelect = {
    select: {
        id: true,
        paidAmount: true,
        createdAt: true,
        payment: {
            select: {
                id: true,
                paymentNumber: true,
                paymentMethod: true,
                paymentDate: true,
                status: true,
            },
        },
    },
    orderBy: { createdAt: "asc" },
};
const invoiceSelect = {
    id: true,
    invoiceNumber: true,
    studentEnrollmentId: true,
    academicYearId: true,
    month: true,
    year: true,
    amount: true,
    discount: true,
    total: true,
    remaining: true,
    status: true,
    dueDate: true,
    note: true,
    createdById: true,
    cancelledAt: true,
    cancelledById: true,
    cancelReason: true,
    createdAt: true,
    updatedAt: true,
    studentEnrollment: {
        select: {
            id: true,
            isActive: true,
            student: {
                select: { id: true, firstName: true, lastName: true, parentPhone: true },
            },
            teachingAssignment: {
                select: {
                    id: true,
                    subject: { select: { id: true, name: true } },
                    teacher: { select: { id: true, firstName: true, lastName: true } },
                    /* المستوى والطور معه — الفوج وحده لا يُعرِّف موضعَ الطالب */
                    studyGroup: {
                        select: {
                            id: true,
                            name: true,
                            level: {
                                select: {
                                    id: true,
                                    name: true,
                                    educationStage: { select: { id: true, name: true } },
                                },
                            },
                        },
                    },
                },
            },
        },
    },
    academicYear: { select: { id: true, name: true } },
    attendanceSheetId: true,
    attendanceSheet: { select: { id: true, number: true, label: true } },
    createdBy: { select: { id: true, username: true } },
    cancelledBy: { select: { id: true, username: true } },
    paymentInvoices: paymentInvoicesSelect,
};
/** المبالغ تُرسل أرقاماً لا كائنات Decimal */
const toResponse = (invoice) => ({
    ...invoice,
    amount: Number(invoice.amount),
    discount: Number(invoice.discount),
    total: Number(invoice.total),
    remaining: Number(invoice.remaining),
    ...(invoice.paymentInvoices && {
        paymentInvoices: invoice.paymentInvoices.map((pi) => ({
            ...pi,
            paidAmount: Number(pi.paidAmount),
        })),
    }),
});
// --------------------------------------------------
// حساب الحقول المشتقّة
//
//   total     = amount - discount
//   remaining = total - المدفوع
//   status    مشتقّة من remaining والمدفوع
//
// (موثَّقة في schema.prisma كقاعدة على service layer)
// --------------------------------------------------
const computeTotals = (amount, discount, paid) => {
    const total = amount.minus(discount);
    const remaining = total.minus(paid);
    const status = remaining.lte(0)
        ? "PAID"
        : paid.gt(0)
            ? "PARTIAL"
            : "PENDING";
    return { total, remaining, status };
};
/**
 * المدفوع فعلياً — الدفعات الملغاة لا تُحتسب.
 * صفوف PaymentInvoice تبقى بعد الإلغاء للتدقيق.
 */
const paidAmountOf = async (invoiceId) => {
    const result = await client_1.prisma.paymentInvoice.aggregate({
        where: { invoiceId, payment: { status: "ACTIVE" } },
        _sum: { paidAmount: true },
    });
    return result._sum.paidAmount ?? new prisma_1.Prisma.Decimal(0);
};
// --------------------------------------------------
// أدوات الشهر
// --------------------------------------------------
const firstDayOfMonth = (year, month) => new Date(Date.UTC(year, month - 1, 1));
const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0));
// --------------------------------------------------
// ترقيم الفواتير — ثلاث عشرة خانة عشوائية
//
// كان `INV-2026-08-0001`: يُقرأ، لكنّه لا يُمسح ويُفشي حجم الحركة —
// من رأى `0037` عرف أنّ المؤسسة أصدرت سبعاً وثلاثين فاتورة هذا الشهر.
// وصار كرقم الدفعة والإيصال: ثلاث عشرة خانة تُشفَّر في باركود Code128
// أسفل الورقة، فتُسترجع الفاتورة بمسحةٍ بدل نقل رقمها باليد.
//
// والتفرّد محروسٌ بطبقتين: فحصٌ قبل الحفظ، وقيد `@@unique` في القاعدة.
// --------------------------------------------------
/**
 * رقمُ فاتورةٍ لم يُستعمل.
 *
 * و`reserved` للتوليد الجُملي: عشرون فاتورةً تُنشأ في نداءٍ واحد لم
 * تُكتب بعدُ في القاعدة، فلا يراها الفحص — والمجموعة تمنع تصادمها
 * فيما بينها.
 */
const nextInvoiceNumber = async (reserved) => {
    const number = await (0, document_number_1.uniqueDocumentNumber)(async (candidate) => {
        if (reserved?.has(candidate))
            return true;
        return (await client_1.prisma.invoice.count({ where: { invoiceNumber: candidate } })) > 0;
    });
    if (!number) {
        throw new app_errors_1.ConflictException("تعذّر توليد رقمٍ فريد للفاتورة — أعد المحاولة", error_code_enum_1.ErrorCodeEnum.RESOURCE_ALREADY_EXISTS);
    }
    reserved?.add(number);
    return number;
};
// --------------------------------------------------
// Helpers
// --------------------------------------------------
const findOrThrow = async (id) => {
    const invoice = await client_1.prisma.invoice.findUnique({
        where: { id },
        select: {
            id: true,
            amount: true,
            discount: true,
            status: true,
            month: true,
            year: true,
        },
    });
    if (!invoice) {
        throw new app_errors_1.NotFoundException("Invoice not found", error_code_enum_1.ErrorCodeEnum.INVOICE_NOT_FOUND);
    }
    return invoice;
};
/**
 * سعر هذا (مادة + فوج) في سنةٍ دراسية.
 *
 * الترجيح في core/pricing: الفوج لم يعد الطريق الوحيد إلى السعر، فقد
 * يأتي من المستوى أو الطور أو نوعية الفوج. وأخصُّ نطاقٍ مطابق يفوز،
 * فسلوكُ «سعرٌ لهذا الفوج بعينه» يبقى كما كان — أعلى الأوزان.
 *
 * والمعيار السنةُ لا تاريخُ الشهر: المؤسسة تسعّر لسنةٍ دراسية،
 * وحمايةُ التاريخ المالي بنسخ `amount` في الفاتورة لا بفترة سريان.
 */
const resolveTuitionFee = async (subjectId, studyGroupId, academicYearId) => {
    const fee = await (0, tuition_scope_1.resolveTuitionFeeForGroup)(subjectId, studyGroupId, academicYearId);
    return fee?.amount ?? null;
};
/**
 * كشفُ هذا الإسناد في هذا الشهر — إن كان واحداً لا لبس فيه.
 *
 * يبقى فارغاً حين لا كشف، أو حين تتقاسم الشهرَ كشوف: الفراغُ أصدق من
 * تخمينٍ يَنسب فاتورةً إلى كشفٍ ليست منه. وقد رأينا كشفاً يمتدّ من
 * جويلية إلى أوت، فلا مجال للاشتقاق بالشهر وحده.
 */
const monthSheet = async (teachingAssignmentId, year, month) => {
    const sheets = await client_1.prisma.attendanceSheet.findMany({
        where: {
            teachingAssignmentId,
            sessions: {
                some: {
                    status: { not: "CANCELLED" },
                    sessionDate: {
                        gte: firstDayOfMonth(year, month),
                        lte: lastDayOfMonth(year, month),
                    },
                },
            },
        },
        select: { id: true },
        take: 2,
    });
    return sheets.length === 1 ? sheets[0].id : null;
};
/**
 * حصصُ الإسناد في شهر الفاتورة — مرتَّبةً بالتاريخ.
 *
 * لا تُطلب إلّا لمن قُيّدت أهليتُه بتاريخ، وهم القلّة. فالمسارُ الغالب
 * — مؤهَّلٌ من البداية — لا يمسّ القاعدة بعد.
 */
const monthSessions = async (teachingAssignmentId, year, month) => client_1.prisma.session.findMany({
    where: {
        schedule: { teachingAssignmentId },
        status: { not: "CANCELLED" },
        sessionDate: {
            gte: firstDayOfMonth(year, month),
            lte: lastDayOfMonth(year, month),
        },
    },
    select: { sessionDate: true },
    orderBy: { sessionDate: "asc" },
});
const getEnrollmentOrThrow = async (studentEnrollmentId) => {
    const enrollment = await client_1.prisma.studentEnrollment.findUnique({
        where: { id: studentEnrollmentId },
        select: {
            id: true,
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
    if (!enrollment) {
        throw new app_errors_1.NotFoundException("Enrollment not found", error_code_enum_1.ErrorCodeEnum.ENROLLMENT_NOT_FOUND);
    }
    return enrollment;
};
// --------------------------------------------------
// List
// --------------------------------------------------
const listInvoicesService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const assignmentFilter = {
        ...(query.subjectId && { subjectId: query.subjectId }),
        ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    };
    const enrollmentFilter = {
        ...(query.studentId && { studentId: query.studentId }),
        ...(Object.keys(assignmentFilter).length > 0 && {
            teachingAssignment: assignmentFilter,
        }),
    };
    const where = {
        ...(query.status && { status: query.status }),
        ...(query.month !== undefined && { month: query.month }),
        ...(query.year !== undefined && { year: query.year }),
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(query.studentEnrollmentId && {
            studentEnrollmentId: query.studentEnrollmentId,
        }),
        /*
         * البحث الواحد يقبل الثلاثة: رقم الفاتورة (وهو ما يُشفّره الباركود
         * أسفل الورقة)، أو لقب الطالب، أو اسمه.
         *
         * ومسحُ الباركود يكتب الرقم في الحقل نفسه كأنّه طُبع بلوحة مفاتيح،
         * فلا يحتاج مسلكاً ثانياً — يكفي أن يُطابَق رقمُ الفاتورة.
         */
        ...(query.search && {
            OR: [
                { invoiceNumber: { contains: query.search } },
                {
                    studentEnrollment: {
                        student: {
                            OR: [
                                { lastName: { contains: query.search } },
                                { firstName: { contains: query.search } },
                            ],
                        },
                    },
                },
            ],
        }),
        ...(Object.keys(enrollmentFilter).length > 0 && {
            studentEnrollment: enrollmentFilter,
        }),
        // متأخرة: تجاوزت الاستحقاق ولها متبقٍّ ولم تُلغَ
        ...(query.overdue === true && {
            dueDate: { lt: (0, time_1.startOfUtcDay)(new Date()) },
            remaining: { gt: 0 },
            status: { not: "CANCELLED" },
        }),
    };
    const [invoices, total] = await Promise.all([
        client_1.prisma.invoice.findMany({
            where,
            select: { ...invoiceSelect, _count: { select: { paymentInvoices: true } } },
            skip,
            take,
            orderBy: [{ year: "desc" }, { month: "desc" }, { invoiceNumber: "asc" }],
        }),
        client_1.prisma.invoice.count({ where }),
    ]);
    return {
        invoices: invoices.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listInvoicesService = listInvoicesService;
// --------------------------------------------------
// Get by id — مع تفصيل الدفعات
// --------------------------------------------------
const getInvoiceService = async (id) => {
    await findOrThrow(id);
    const invoice = await client_1.prisma.invoice.findUnique({
        where: { id },
        select: invoiceSelect,
    });
    if (!invoice)
        return null;
    return toResponse(invoice);
};
exports.getInvoiceService = getInvoiceService;
// --------------------------------------------------
// Create — فاتورة واحدة
// --------------------------------------------------
const createInvoiceService = async (body, createdById) => {
    const enrollment = await getEnrollmentOrThrow(body.studentEnrollmentId);
    const duplicate = await client_1.prisma.invoice.findFirst({
        where: {
            studentEnrollmentId: body.studentEnrollmentId,
            month: body.month,
            year: body.year,
        },
        select: { invoiceNumber: true },
    });
    if (duplicate) {
        throw new app_errors_1.ConflictException(`An invoice already exists for this enrollment in ${body.month}/${body.year} ` +
            `(${duplicate.invoiceNumber})`, error_code_enum_1.ErrorCodeEnum.INVOICE_ALREADY_EXISTS);
    }
    const periodStart = firstDayOfMonth(body.year, body.month);
    // المبلغ من الطلب، وإلا من حقوق الاشتراك السارية
    let amount;
    if (body.amount !== undefined) {
        amount = new prisma_1.Prisma.Decimal(body.amount);
    }
    else {
        const fee = await resolveTuitionFee(enrollment.teachingAssignment.subjectId, enrollment.teachingAssignment.studyGroupId, enrollment.teachingAssignment.academicYearId);
        if (!fee) {
            const target = await (0, tuition_scope_1.loadPricingTarget)(enrollment.teachingAssignment.subjectId, enrollment.teachingAssignment.studyGroupId);
            const reason = target
                ? await (0, tuition_scope_1.explainMissingFee)(target, enrollment.teachingAssignment.academicYearId)
                : "تعذّر قراءة نسب الفوج.";
            throw new app_errors_1.NotFoundException(`لا حقّ اشتراك ساري لـ${enrollment.teachingAssignment.subject.name} — ` +
                `${enrollment.teachingAssignment.studyGroup.name} في ${body.month}/${body.year}. ${reason}`, error_code_enum_1.ErrorCodeEnum.TUITION_FEE_NOT_FOUND);
        }
        amount = fee;
    }
    const discount = new prisma_1.Prisma.Decimal(body.discount ?? 0);
    if (discount.gt(amount)) {
        throw new app_errors_1.BadRequestException("Discount must not exceed the amount", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const { total, remaining, status } = computeTotals(amount, discount, new prisma_1.Prisma.Decimal(0));
    const invoice = await client_1.prisma.invoice.create({
        data: {
            invoiceNumber: await nextInvoiceNumber(),
            studentEnrollmentId: body.studentEnrollmentId,
            academicYearId: enrollment.teachingAssignment.academicYearId,
            month: body.month,
            year: body.year,
            amount,
            discount,
            total,
            remaining,
            status,
            dueDate: body.dueDate
                ? (0, time_1.startOfUtcDay)(body.dueDate)
                : lastDayOfMonth(body.year, body.month),
            note: body.note ?? null,
            createdById: createdById ?? null,
        },
        select: invoiceSelect,
    });
    return toResponse(invoice);
};
exports.createInvoiceService = createInvoiceService;
// --------------------------------------------------
// Generate — فواتير الشهر لكل المسجَّلين النشطين
//
// تُتخطّى الفواتير القائمة، وتُجمَع التسجيلات التي
// لا سعر لها في تقرير منفصل بدل إفشال العملية كلها.
// --------------------------------------------------
const generateInvoicesService = async (body, createdById) => {
    const academicYear = await client_1.prisma.academicYear.findUnique({
        where: { id: body.academicYearId },
        select: { id: true },
    });
    if (!academicYear) {
        throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND);
    }
    const enrollments = await client_1.prisma.studentEnrollment.findMany({
        where: {
            isActive: true,
            teachingAssignment: {
                academicYearId: body.academicYearId,
                isActive: true,
                ...(body.studyGroupIds?.length && {
                    studyGroupId: { in: body.studyGroupIds },
                }),
            },
            ...(body.studentIds?.length && { studentId: { in: body.studentIds } }),
        },
        select: {
            id: true,
            /** فارغُه أهليةٌ كاملة — وهو الغالب، فلا حساب إضافيّ له */
            eligibleFrom: true,
            teachingAssignmentId: true,
            teachingAssignment: {
                select: {
                    subjectId: true,
                    studyGroupId: true,
                    subject: { select: { name: true } },
                    studyGroup: { select: { name: true } },
                },
            },
            student: { select: { firstName: true, lastName: true } },
        },
    });
    const existing = await client_1.prisma.invoice.findMany({
        where: {
            month: body.month,
            year: body.year,
            studentEnrollmentId: { in: enrollments.map((e) => e.id) },
        },
        select: { studentEnrollmentId: true },
    });
    const alreadyInvoiced = new Set(existing.map((invoice) => invoice.studentEnrollmentId));
    const periodStart = firstDayOfMonth(body.year, body.month);
    const dueDate = body.dueDate
        ? (0, time_1.startOfUtcDay)(body.dueDate)
        : lastDayOfMonth(body.year, body.month);
    // السعر يتكرر كثيراً لنفس (مادة + فوج) — نُخزّنه مؤقتاً
    const feeCache = new Map();
    /** هل تُناسَب رسومُ الملتحق متأخّراً؟ قاعدةٌ في `TuitionFee` لكل نطاق */
    const prorateByScope = new Map();
    /** حصصُ الشهر لكل إسناد — تُجلب لمن قُيّدت أهليتُه وحده */
    const sessionSchema = new Map();
    const sessionCache = sessionSchema;
    /** كشفُ الشهر لكل إسناد — يُحلّ مرّةً ويُعاد استعمالُه لطلبة الفوج كلِّهم */
    const sheetCache = new Map();
    /*
     * الحصص المعتمدة للشهر — من سياسة السنة.
     *
     * سقفٌ لا يُنزَل عنه: لو أُنجزت خمسُ حصصٍ من ثمانٍ ثم وُلّدت الفواتير،
     * لكان القسمة على خمسٍ تجعل حصة الملتحق أغلى من حصة القديم.
     */
    const sheetSessions = (await client_1.prisma.academicYear.findUnique({
        where: { id: body.academicYearId },
        select: { sessionsPerMonth: true },
    }))?.sessionsPerMonth ?? 0;
    const missingFee = [];
    /** المتعثّرون مجمَّعين بـ (مادة + فوج) — سببُهم واحد لا يُكرَّر */
    const missingByScope = new Map();
    const rows = [];
    /* أرقامُ هذه الدفعة — تمنع تصادمها فيما بينها قبل أن تُكتب */
    const reserved = new Set();
    for (const enrollment of enrollments) {
        if (alreadyInvoiced.has(enrollment.id))
            continue;
        const { subjectId, studyGroupId } = enrollment.teachingAssignment;
        const key = `${subjectId}:${studyGroupId}`;
        if (!feeCache.has(key)) {
            const resolved = await (0, tuition_scope_1.resolveTuitionFeeForGroup)(subjectId, studyGroupId, body.academicYearId);
            feeCache.set(key, resolved?.amount ?? null);
            prorateByScope.set(key, resolved?.lateEnrollmentMode !== "FULL_MONTH");
        }
        const fee = feeCache.get(key) ?? null;
        if (!fee) {
            const subject = enrollment.teachingAssignment.subject.name;
            const studyGroup = enrollment.teachingAssignment.studyGroup.name;
            missingFee.push({
                studentEnrollmentId: enrollment.id,
                student: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
                subject,
                studyGroup,
            });
            const entry = missingByScope.get(key);
            if (entry)
                entry.students++;
            else
                missingByScope.set(key, {
                    subjectId,
                    studyGroupId,
                    subject,
                    studyGroup,
                    students: 1,
                });
            continue;
        }
        /*
         * الالتحاق المتأخّر — يُحسب الحقُّ بقدر ما صار الطالب مسؤولاً عنه.
         *
         * ولا يُقرأ إلّا لمن قُيّدت أهليتُه بتاريخ: `eligibleFrom` فارغٌ في
         * كل تسجيلٍ قائم، فالمسار الغالب يمرّ بلا استعلامٍ واحد ولا يتغيّر
         * فيه رقم. والغيابُ بعد الالتحاق لا ينقص شيئاً — المقياس الحصصُ
         * المؤهَّلة لا المحضورة.
         */
        let charge = {
            amount: fee,
            approvedSessions: null,
            eligibleSessions: null,
            sessionRate: null,
        };
        if (enrollment.eligibleFrom) {
            const key2 = enrollment.teachingAssignmentId;
            if (!sessionCache.has(key2)) {
                sessionCache.set(key2, await monthSessions(key2, body.year, body.month));
            }
            const sessions = sessionCache.get(key2);
            const approved = Math.max(sessions.length, sheetSessions);
            charge = (0, eligibility_1.computeCharge)({
                tuition: fee,
                approvedSessions: approved,
                eligibleSessions: (0, eligibility_1.countEligible)(enrollment, sessions),
                prorate: prorateByScope.get(key) ?? true,
            });
        }
        /* كشفُ الفترة — يُنسب مرّةً للإسناد ويُشارَك بين طلبته */
        if (!sheetCache.has(enrollment.teachingAssignmentId)) {
            sheetCache.set(enrollment.teachingAssignmentId, await monthSheet(enrollment.teachingAssignmentId, body.year, body.month));
        }
        const discount = new prisma_1.Prisma.Decimal(0);
        const { total, remaining, status } = computeTotals(charge.amount, discount, new prisma_1.Prisma.Decimal(0));
        rows.push({
            invoiceNumber: await nextInvoiceNumber(reserved),
            studentEnrollmentId: enrollment.id,
            academicYearId: body.academicYearId,
            month: body.month,
            year: body.year,
            amount: charge.amount,
            approvedSessions: charge.approvedSessions,
            eligibleSessions: charge.eligibleSessions,
            sessionRate: charge.sessionRate,
            attendanceSheetId: sheetCache.get(enrollment.teachingAssignmentId) ?? null,
            discount,
            total,
            remaining,
            status,
            dueDate,
            createdById: createdById ?? null,
        });
    }
    if (rows.length > 0) {
        await client_1.prisma.invoice.createMany({ data: rows });
    }
    const invoices = await client_1.prisma.invoice.findMany({
        where: { invoiceNumber: { in: rows.map((row) => row.invoiceNumber) } },
        select: invoiceSelect,
        orderBy: { invoiceNumber: "asc" },
    });
    /*
     * لماذا لم يُولَّد.
     *
     * «بلا حقّ اشتراك» جوابٌ صحيح لا يُفيد: المستخدم يرى التسعيرة أمامه
     * في القائمة ويقرأ أنها غير موجودة، فيظنّ الخلل في النظام. والسببُ
     * الغالب تاريخُ السريان لا الغياب.
     *
     * والتشخيص لكل (مادة + فوج) مرّة لا لكل طالب: خمسة عشر طالباً في
     * فوجٍ واحد سببُهم واحد.
     */
    const diagnoses = [];
    for (const [key, group] of missingByScope) {
        const target = await (0, tuition_scope_1.loadPricingTarget)(group.subjectId, group.studyGroupId);
        diagnoses.push({
            subject: group.subject,
            studyGroup: group.studyGroup,
            students: group.students,
            reason: target
                ? await (0, tuition_scope_1.explainMissingFee)(target, body.academicYearId)
                : "تعذّر قراءة نسب الفوج.",
        });
        void key;
    }
    return {
        invoices: invoices.map(toResponse),
        created: rows.length,
        skippedExisting: alreadyInvoiced.size,
        skippedNoFee: missingFee,
        feeDiagnoses: diagnoses,
    };
};
exports.generateInvoicesService = generateInvoicesService;
// --------------------------------------------------
// Update
//
// تعديل المبلغ أو التخفيض يُعيد حساب المشتقّات
// انطلاقاً من المدفوع فعلياً.
// --------------------------------------------------
const updateInvoiceService = async (id, body) => {
    const existing = await findOrThrow(id);
    if (existing.status === "CANCELLED") {
        throw new app_errors_1.ConflictException("Cannot modify a cancelled invoice", error_code_enum_1.ErrorCodeEnum.INVOICE_CANCELLED);
    }
    const amount = body.amount !== undefined
        ? new prisma_1.Prisma.Decimal(body.amount)
        : existing.amount;
    const discount = body.discount !== undefined
        ? new prisma_1.Prisma.Decimal(body.discount)
        : existing.discount;
    if (discount.gt(amount)) {
        throw new app_errors_1.BadRequestException("Discount must not exceed the amount", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const recalculate = body.amount !== undefined || body.discount !== undefined;
    let derived = null;
    if (recalculate) {
        const paid = await paidAmountOf(id);
        if (amount.minus(discount).lt(paid)) {
            throw new app_errors_1.BadRequestException(`Total (${amount.minus(discount)}) would be less than the amount already paid (${paid})`, error_code_enum_1.ErrorCodeEnum.PAYMENT_AMOUNT_INVALID);
        }
        derived = computeTotals(amount, discount, paid);
    }
    const invoice = await client_1.prisma.invoice.update({
        where: { id },
        data: {
            ...(body.amount !== undefined && { amount }),
            ...(body.discount !== undefined && { discount }),
            ...(body.dueDate !== undefined && {
                dueDate: (0, time_1.startOfUtcDay)(body.dueDate),
            }),
            ...(body.note !== undefined && { note: body.note }),
            ...(derived && {
                total: derived.total,
                remaining: derived.remaining,
                status: derived.status,
            }),
        },
        select: invoiceSelect,
    });
    return toResponse(invoice);
};
exports.updateInvoiceService = updateInvoiceService;
// --------------------------------------------------
// Cancel — بدل الحذف (سجل مالي)
// --------------------------------------------------
const cancelInvoiceService = async (id, body, cancelledById) => {
    const existing = await findOrThrow(id);
    if (existing.status === "CANCELLED") {
        throw new app_errors_1.ConflictException("Invoice is already cancelled", error_code_enum_1.ErrorCodeEnum.INVOICE_CANCELLED);
    }
    // الدفعات الملغاة لا تمنع إلغاء الفاتورة
    const payments = await client_1.prisma.paymentInvoice.count({
        where: { invoiceId: id, payment: { status: "ACTIVE" } },
    });
    if (payments > 0) {
        throw new app_errors_1.ConflictException(`Cannot cancel: invoice has ${payments} active payment(s) applied. ` +
            `Cancel the payment first.`, error_code_enum_1.ErrorCodeEnum.INVOICE_ALREADY_PAID);
    }
    const invoice = await client_1.prisma.invoice.update({
        where: { id },
        data: {
            status: "CANCELLED",
            remaining: new prisma_1.Prisma.Decimal(0),
            cancelledAt: new Date(),
            cancelledById,
            cancelReason: body.reason ?? null,
        },
        select: invoiceSelect,
    });
    return toResponse(invoice);
};
exports.cancelInvoiceService = cancelInvoiceService;
//# sourceMappingURL=invoice.service.js.map