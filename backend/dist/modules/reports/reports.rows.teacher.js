"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settlementPaidRate = exports.entitlementByTeacher = exports.fetchAllocationRows = exports.fetchTeacherPaymentRows = exports.settlementCounts = exports.fetchSettlementRows = void 0;
const client_1 = require("../../core/prisma/client");
const reporting_1 = require("../../core/reporting");
const reports_scope_1 = require("./reports.scope");
const reports_table_1 = require("./reports.table");
const fetchSettlementRows = async (query, request, sort) => {
    /*
     * الملغى يظهر في الجدول ولا يدخل المجاميع (§52.4).
     *
     * وشاشةُ التخليص من أكثر ما يُراجَع: إلغاءُ تخليصٍ وإعادةُ حسابه
     * (§30) واقعتان يجب أن تُريا معاً، وإخفاءُ الأولى يجعل الثانية
     * تبدو بلا سبب.
     */
    const where = (0, reports_scope_1.settlementScope)(query, { includeCancelled: true });
    const [total, settlements] = await client_1.prisma.$transaction([
        client_1.prisma.settlement.count({ where }),
        client_1.prisma.settlement.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                settlementNumber: true,
                status: true,
                methodSnapshot: true,
                studentCountSnapshot: true,
                approvedSessionsSnapshot: true,
                attendedUnitsSnapshot: true,
                grossTuitionSnapshot: true,
                collectedSnapshot: true,
                teacherAmount: true,
                computedAt: true,
                confirmedAt: true,
                paidAt: true,
                teacher: { select: { firstName: true, lastName: true } },
                attendanceSheet: { select: { number: true, label: true } },
                teachingAssignment: {
                    select: {
                        subject: { select: { name: true } },
                        studyGroup: { select: { name: true } },
                    },
                },
                /*
                 * التخصيصاتُ تُجلب مع الصفّ لا باستعلامٍ لكلّ تخليص.
                 *
                 * وشرطُ الدفعة النشطة داخل `where` الخاصّ بالعلاقة: تخصيصٌ
                 * تبع دفعةً ملغاة لا يُحتسب مدفوعاً (§52.3).
                 */
                teacherAllocations: {
                    where: { teacherPayment: { status: "ACTIVE" } },
                    select: { amount: true },
                },
            },
        }),
    ]);
    const rows = settlements.map((settlement) => {
        const teacherAmount = (0, reporting_1.toNumber)(settlement.teacherAmount);
        const allocated = settlement.teacherAllocations.reduce((sum, allocation) => sum + (0, reporting_1.toNumber)(allocation.amount), 0);
        return {
            id: settlement.id,
            settlementNumber: settlement.settlementNumber,
            teacher: `${settlement.teacher.firstName} ${settlement.teacher.lastName}`.trim(),
            subject: settlement.teachingAssignment.subject.name,
            studyGroup: settlement.teachingAssignment.studyGroup.name,
            sheetNumber: settlement.attendanceSheet.number,
            sheetLabel: settlement.attendanceSheet.label,
            status: settlement.status,
            method: settlement.methodSnapshot,
            studentCount: settlement.studentCountSnapshot,
            approvedSessions: settlement.approvedSessionsSnapshot,
            attendedUnits: settlement.attendedUnitsSnapshot,
            grossTuition: (0, reporting_1.toNumber)(settlement.grossTuitionSnapshot),
            collected: (0, reporting_1.toNumber)(settlement.collectedSnapshot),
            teacherAmount,
            allocated,
            remaining: teacherAmount - allocated,
            computedAt: settlement.computedAt.toISOString(),
            confirmedAt: settlement.confirmedAt?.toISOString() ?? null,
            paidAt: settlement.paidAt?.toISOString() ?? null,
        };
    });
    return { rows, total };
};
exports.fetchSettlementRows = fetchSettlementRows;
const settlementCounts = async (query) => {
    const where = (0, reports_scope_1.settlementScope)(query, { includeCancelled: true });
    const byStatus = await client_1.prisma.settlement.groupBy({
        by: ["status"],
        where,
        _sum: { teacherAmount: true },
        _count: true,
    });
    const of = (status) => byStatus.find((row) => row.status === status) ?? {
        _count: 0,
        _sum: { teacherAmount: null },
    };
    return {
        byStatus,
        draft: of("DRAFT")._count,
        confirmed: of("CONFIRMED")._count,
        paid: of("PAID")._count,
        cancelled: of("CANCELLED")._count,
        total: byStatus.reduce((sum, row) => sum + row._count, 0),
        /*
         * المستحقُّ الملتزَم به: المؤكَّد والمدفوع دون المسوّدة.
         *
         * المسوّدةُ حسابٌ لم يُعتمد، وإدخالُها في «الواجب دفعه» يُظهر
         * ديناً وهمياً على المؤسسة.
         */
        committedAmount: (0, reporting_1.toNumber)(of("CONFIRMED")._sum.teacherAmount) +
            (0, reporting_1.toNumber)(of("PAID")._sum.teacherAmount),
        draftAmount: (0, reporting_1.toNumber)(of("DRAFT")._sum.teacherAmount),
    };
};
exports.settlementCounts = settlementCounts;
const fetchTeacherPaymentRows = async (query, request, sort) => {
    const where = (0, reports_scope_1.teacherPaymentScope)(query, { includeCancelled: true });
    const [total, payments] = await client_1.prisma.$transaction([
        client_1.prisma.teacherPayment.count({ where }),
        client_1.prisma.teacherPayment.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                paymentNumber: true,
                amount: true,
                paymentMethod: true,
                paymentDate: true,
                status: true,
                teacher: { select: { firstName: true, lastName: true } },
                paidBy: { select: { firstName: true, lastName: true } },
                allocations: { select: { amount: true } },
            },
        }),
    ]);
    const rows = payments.map((payment) => {
        const amount = (0, reporting_1.toNumber)(payment.amount);
        const allocated = payment.allocations.reduce((sum, allocation) => sum + (0, reporting_1.toNumber)(allocation.amount), 0);
        return {
            id: payment.id,
            paymentNumber: payment.paymentNumber,
            teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
            amount,
            paymentMethod: payment.paymentMethod,
            paymentDate: payment.paymentDate.toISOString(),
            status: payment.status,
            paidBy: payment.paidBy
                ? `${payment.paidBy.firstName} ${payment.paidBy.lastName}`.trim()
                : null,
            allocated,
            /* ينبغي أن يكون صفراً — §32 و§39 */
            unallocated: amount - allocated,
            allocationCount: payment.allocations.length,
        };
    });
    return { rows, total };
};
exports.fetchTeacherPaymentRows = fetchTeacherPaymentRows;
const fetchAllocationRows = async (query, request, sort) => {
    const where = {
        teacherPayment: (0, reports_scope_1.teacherPaymentScope)(query, { includeCancelled: true }),
    };
    const [total, allocations] = await client_1.prisma.$transaction([
        client_1.prisma.teacherPaymentAllocation.count({ where }),
        client_1.prisma.teacherPaymentAllocation.findMany({
            where,
            ...(0, reports_table_1.skipTake)(request),
            orderBy: sort.orderBy,
            select: {
                id: true,
                amount: true,
                teacherPayment: {
                    select: {
                        paymentNumber: true,
                        amount: true,
                        paymentDate: true,
                        teacher: { select: { firstName: true, lastName: true } },
                    },
                },
                settlement: {
                    select: {
                        settlementNumber: true,
                        attendanceSheet: { select: { number: true, label: true } },
                    },
                },
                teacherDebtShare: {
                    select: {
                        id: true,
                        debtCollection: {
                            select: { originalMonth: true, originalYear: true },
                        },
                    },
                },
            },
        }),
    ]);
    const rows = allocations.map((allocation) => {
        const payment = allocation.teacherPayment;
        /*
         * التخصيصُ يشير إلى أحدهما لا كليهما: تخليصٌ أو حصّةُ دَين.
         *
         * و`unknown` ليست حالةً متوقّعة — لو ظهرت فهي خللٌ في البيانات
         * يجب أن يُرى في §39 لا أن يُخفى بسطرٍ فارغ.
         */
        if (allocation.settlement) {
            const sheet = allocation.settlement.attendanceSheet;
            return {
                id: allocation.id,
                paymentNumber: payment.paymentNumber,
                teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
                paymentDate: payment.paymentDate.toISOString(),
                paymentTotal: (0, reporting_1.toNumber)(payment.amount),
                amount: (0, reporting_1.toNumber)(allocation.amount),
                targetKind: "settlement",
                targetLabel: allocation.settlement.settlementNumber,
                targetPeriod: sheet.label ?? `كشف ${sheet.number}`,
            };
        }
        if (allocation.teacherDebtShare) {
            const collection = allocation.teacherDebtShare.debtCollection;
            return {
                id: allocation.id,
                paymentNumber: payment.paymentNumber,
                teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
                paymentDate: payment.paymentDate.toISOString(),
                paymentTotal: (0, reporting_1.toNumber)(payment.amount),
                amount: (0, reporting_1.toNumber)(allocation.amount),
                targetKind: "debtShare",
                targetLabel: "حصّة من دَين محصَّل",
                targetPeriod: `${collection.originalYear}-${String(collection.originalMonth).padStart(2, "0")}`,
            };
        }
        return {
            id: allocation.id,
            paymentNumber: payment.paymentNumber,
            teacher: `${payment.teacher.firstName} ${payment.teacher.lastName}`.trim(),
            paymentDate: payment.paymentDate.toISOString(),
            paymentTotal: (0, reporting_1.toNumber)(payment.amount),
            amount: (0, reporting_1.toNumber)(allocation.amount),
            targetKind: "unknown",
            targetLabel: "بلا وجهة",
            targetPeriod: null,
        };
    });
    return { rows, total };
};
exports.fetchAllocationRows = fetchAllocationRows;
// --------------------------------------------------
// المستحقُّ حسب الأستاذ — لرسم §29
// --------------------------------------------------
const entitlementByTeacher = async (query) => {
    const [settlements, shares] = await Promise.all([
        client_1.prisma.settlement.groupBy({
            by: ["teacherId"],
            where: (0, reports_scope_1.settlementScope)(query),
            _sum: { teacherAmount: true },
        }),
        client_1.prisma.teacherDebtShare.groupBy({
            by: ["teacherId"],
            where: {
                status: { not: "CANCELLED" },
                ...(query.teacherId ? { teacherId: query.teacherId } : {}),
            },
            _sum: { shareAmount: true },
        }),
    ]);
    const ids = [
        ...new Set([
            ...settlements.map((row) => row.teacherId),
            ...shares.map((row) => row.teacherId),
        ]),
    ];
    if (ids.length === 0)
        return [];
    const teachers = await client_1.prisma.teacher.findMany({
        where: { id: { in: ids } },
        select: { id: true, firstName: true, lastName: true },
    });
    const settlementBy = new Map(settlements.map((row) => [row.teacherId, (0, reporting_1.toNumber)(row._sum.teacherAmount)]));
    const shareBy = new Map(shares.map((row) => [row.teacherId, (0, reporting_1.toNumber)(row._sum.shareAmount)]));
    return teachers
        .map((teacher) => ({
        id: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName}`.trim(),
        fromSettlements: settlementBy.get(teacher.id) ?? 0,
        fromDebtShares: shareBy.get(teacher.id) ?? 0,
        entitlement: (settlementBy.get(teacher.id) ?? 0) + (shareBy.get(teacher.id) ?? 0),
    }))
        .sort((a, b) => b.entitlement - a.entitlement);
};
exports.entitlementByTeacher = entitlementByTeacher;
/** نسبةُ ما دُفع من المستحقّ — يُستعمل في بطاقات §29 */
const settlementPaidRate = (entitlement, allocated) => (0, reporting_1.rate)(allocated, entitlement);
exports.settlementPaidRate = settlementPaidRate;
//# sourceMappingURL=reports.rows.teacher.js.map