"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelDebtShareService = exports.listDebtSharesService = exports.recordDebtCollections = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
/**
 * حصةُ الأستاذ من دَينٍ حُصِّل بعد تخليصه.
 *
 * المبدأ الذي تقوم عليه هذه الطبقة — وهو مكتوبٌ في المخطّط منذ رُسم:
 * **المال المحصَّل متأخّراً لا يُعدّل الماضي.** تخليصُ الشهر الأوّل
 * المؤكَّد يبقى 8,718.75 وإن سُدّد دينُه بعد شهرين، والتصحيح يكون
 * بإنشاء واقعةٍ جديدة تُنسب إلى أصلها لا بمسّ ورقةٍ وُقّع عليها.
 *
 * فحين يسدّد المخلَّف:
 *   1. تُسجَّل **واقعة تحصيل** (`DebtCollection`) — الفاتورة والدفعة
 *      والمبلغ وشهرُ الأصل. وهي السند الذي تتعلّق به الحصة، وقيدُ
 *      التفرّد عليها هو الحارس ضدّ حسابها مرّتين.
 *   2. تُحسب **حصةُ الأستاذ** بلقطات السياسة **الأصلية** لا الحالية:
 *      من حضر تحت نسبة 75% يُحاسَب بها ولو صارت اليوم 80%.
 *   3. تُدفع **مدموجةً** في راتب الفترة التالية: الأستاذ يقبض «كشف
 *      الشهر 2 + متأخّرات الشهر 1» بورقةٍ واحدة، والقاعدة تحتفظ بمصدر
 *      كلّ دينار.
 *
 * والمقياس `ATTENDED_UNITS`: حضورُه في فترته الأصلية × نصيب الوحدة
 * وقتها — فمن حضر ثلاثاً من ثمانٍ وسدّد حقَّه كاملاً يأخذ أستاذُه أجرَ
 * ثلاثٍ لا أجرَ ثمان، وتبقى السلسلة كلُّها على مقياسٍ واحد فتتصالح
 * المجاميع مع عمود «غير محصَّل» في الكشف التقديري.
 */
const shareSelect = prisma_1.Prisma.validator()({
    id: true,
    teacherId: true,
    basisSnapshot: true,
    percentageSnapshot: true,
    unitRateSnapshot: true,
    attendedUnits: true,
    collectedAmount: true,
    shareAmount: true,
    status: true,
    approvedAt: true,
    paidAt: true,
    cancelledAt: true,
    cancelReason: true,
    note: true,
    createdAt: true,
    teacher: { select: { id: true, firstName: true, lastName: true } },
    debtCollection: {
        select: {
            id: true,
            collectedAmount: true,
            originalMonth: true,
            originalYear: true,
            collectedAt: true,
            invoice: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    total: true,
                    studentEnrollment: {
                        select: {
                            id: true,
                            student: { select: { id: true, firstName: true, lastName: true } },
                        },
                    },
                },
            },
            payment: { select: { id: true, paymentNumber: true, paymentDate: true } },
        },
    },
    /* أصلُه: أيُّ كشفٍ نشأ فيه الدَّين — بمادّته وفوجه ورمز ورقته */
    originalSettlement: {
        select: {
            id: true,
            settlementNumber: true,
            attendanceSheet: {
                select: { id: true, code: true, number: true, label: true },
            },
            teachingAssignment: {
                select: {
                    id: true,
                    subject: { select: { id: true, name: true } },
                    studyGroup: { select: { id: true, name: true } },
                },
            },
        },
    },
    collectionSettlement: {
        select: { id: true, settlementNumber: true },
    },
});
const toResponse = (share) => ({
    ...share,
    percentageSnapshot: Number(share.percentageSnapshot),
    unitRateSnapshot: share.unitRateSnapshot === null ? null : Number(share.unitRateSnapshot),
    collectedAmount: Number(share.collectedAmount),
    shareAmount: Number(share.shareAmount),
});
/**
 * يُسجّل وقائع التحصيل ويحسب حصص الأستاذ منها.
 *
 * يُستدعى **داخل** المعاملة التي تحفظ دفعة الطالب: الواقعة والحصة
 * والدفعة تقع كلُّها أو لا يقع شيء — وإلّا بقي مالٌ محصَّلٌ بلا حصةٍ
 * لصاحبها لا يعرف بها أحد.
 *
 * ولا يرمي عند تعذّر الحساب: قبضُ مال الطالب لا يُعطَّل لأنّ حصة
 * الأستاذ غامضة. وما تعذّر يبقى غيرَ مسجَّل ويظهر في الكشف التقديري
 * كدَينٍ محصَّل بلا حصة.
 */
const recordDebtCollections = async (tx, paymentId, collections, collectedAt) => {
    for (const entry of collections) {
        const invoice = await tx.invoice.findUnique({
            where: { id: entry.invoiceId },
            select: {
                id: true,
                month: true,
                year: true,
                total: true,
                attendanceSheetId: true,
                studentEnrollment: {
                    select: { id: true, teachingAssignmentId: true },
                },
            },
        });
        /*
         * بلا كشفٍ لا نسبةَ للدَّين: الفاتورة قد تمتدّ على شهرين أو
         * يتقاسمها كشفان، فيبقى الربط فارغاً بدل أن يُخمَّن (انظر
         * `Invoice.attendanceSheetId`). ولا حصةَ لما لا يُنسب.
         */
        if (!invoice?.attendanceSheetId)
            continue;
        /*
         * الحصة لا تنشأ إلّا إذا كان الكشف **مجمَّداً**: المسوّدة يُعاد
         * حسابها فتلتقط الطالب من نفسها، والملغى لا شيء تحته.
         */
        const settlement = await tx.settlement.findFirst({
            where: {
                attendanceSheetId: invoice.attendanceSheetId,
                teachingAssignmentId: invoice.studentEnrollment.teachingAssignmentId,
                status: { in: ["CONFIRMED", "PAID"] },
            },
            orderBy: { revision: "desc" },
            select: {
                id: true,
                teacherId: true,
                policyId: true,
                percentageSnapshot: true,
                tuitionSnapshot: true,
                approvedSessionsSnapshot: true,
                roundingPrecisionSnapshot: true,
                attendanceSheetId: true,
            },
        });
        if (!settlement)
            continue;
        /* واقعةُ التحصيل — سندُ الحصة، وقيدُ التفرّد يمنع تكرارها */
        const collection = await tx.debtCollection.create({
            data: {
                invoiceId: invoice.id,
                paymentId,
                collectedAmount: entry.paidAmount,
                originalMonth: invoice.month,
                originalYear: invoice.year,
                collectedAt,
            },
            select: { id: true },
        });
        const policy = await tx.settlementPolicy.findUnique({
            where: { id: settlement.policyId },
            select: { debtSettlementBasis: true, debtShareBasis: true },
        });
        /* سياسةٌ تقول «لا حصة من الدَّين» — تُسجَّل الواقعة ولا تُحسب حصة */
        if (!policy || policy.debtSettlementBasis === "EXCLUDED")
            continue;
        const percentage = settlement.percentageSnapshot;
        /* بلا نسبةٍ لا حصة: المبلغُ المسطَّح لا تحكمه نسبةٌ تُقتطع منه */
        if (!percentage || percentage.isZero())
            continue;
        const dp = settlement.roundingPrecisionSnapshot;
        /* حصةُ ما حُصّل من الفاتورة كلِّها — التسديد الجزئي يأخذ نسبته */
        const portion = invoice.total.isZero()
            ? new prisma_1.Prisma.Decimal(0)
            : entry.paidAmount.div(invoice.total);
        let unitRate = null;
        let attendedUnits = null;
        let shareAmount;
        if (policy.debtShareBasis === "ATTENDED_UNITS") {
            /* سعرُ الحصة للمؤسسة وقتها × نسبة الأستاذ = نصيبُ حضورٍ واحد */
            const sessionRate = settlement.approvedSessionsSnapshot > 0
                ? settlement.tuitionSnapshot.div(settlement.approvedSessionsSnapshot)
                : new prisma_1.Prisma.Decimal(0);
            unitRate = sessionRate.times(percentage).div(100).toDecimalPlaces(4);
            /* حضورُه في فترته الأصلية — الحاضر والمتأخّر كلاهما حضور */
            attendedUnits = await tx.attendance.count({
                where: {
                    studentEnrollmentId: invoice.studentEnrollment.id,
                    status: { in: ["PRESENT", "LATE"] },
                    session: { sheetId: settlement.attendanceSheetId },
                },
            });
            shareAmount = unitRate
                .times(attendedUnits)
                .times(portion)
                .toDecimalPlaces(dp);
        }
        else {
            shareAmount = entry.paidAmount
                .times(percentage)
                .div(100)
                .toDecimalPlaces(dp);
        }
        if (shareAmount.lessThanOrEqualTo(0))
            continue;
        await tx.teacherDebtShare.create({
            data: {
                teacherId: settlement.teacherId,
                debtCollectionId: collection.id,
                originalSettlementId: settlement.id,
                basisSnapshot: policy.debtShareBasis,
                percentageSnapshot: percentage,
                unitRateSnapshot: unitRate,
                attendedUnits,
                collectedAmount: entry.paidAmount,
                shareAmount,
            },
        });
    }
};
exports.recordDebtCollections = recordDebtCollections;
// --------------------------------------------------
// القراءة
// --------------------------------------------------
const listDebtSharesService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.status && { status: query.status }),
        ...(query.collectionSettlementId && {
            collectionSettlementId: query.collectionSettlementId,
        }),
        /*
         * المرشِّحان على التخليص الأصلي معاً في كائنٍ واحد — وضعُهما في
         * مفتاحين يُلغي أحدهما الآخر.
         */
        ...((query.teachingAssignmentId || query.academicYearId) && {
            originalSettlement: {
                ...(query.teachingAssignmentId && {
                    teachingAssignmentId: query.teachingAssignmentId,
                }),
                ...(query.academicYearId && { academicYearId: query.academicYearId }),
            },
        }),
    };
    const [shares, total] = await Promise.all([
        client_1.prisma.teacherDebtShare.findMany({
            where,
            select: shareSelect,
            skip,
            take,
            orderBy: { createdAt: "desc" },
        }),
        client_1.prisma.teacherDebtShare.count({ where }),
    ]);
    return {
        shares: shares.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listDebtSharesService = listDebtSharesService;
// --------------------------------------------------
// الإلغاء — لا حذف
// --------------------------------------------------
const cancelDebtShareService = async (id, body, userId) => {
    const share = await client_1.prisma.teacherDebtShare.findUnique({
        where: { id },
        select: { id: true, status: true },
    });
    if (!share) {
        throw new app_errors_1.NotFoundException("Debt share not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    if (share.status === "PAID") {
        throw new app_errors_1.ConflictException("A paid debt share cannot be cancelled — cancel the teacher payment instead", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const updated = await client_1.prisma.teacherDebtShare.update({
        where: { id },
        data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelReason: body.reason,
            approvedById: userId,
        },
        select: shareSelect,
    });
    return toResponse(updated);
};
exports.cancelDebtShareService = cancelDebtShareService;
//# sourceMappingURL=teacher-debt-share.service.js.map