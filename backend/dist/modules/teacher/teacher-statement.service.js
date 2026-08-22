"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTeacherStatementService = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
/**
 * كشفُ حساب الأستاذ — سنةٌ كاملة في ورقةٍ واحدة.
 *
 * الأستاذ يسأل سؤالين: «كم استحققتُ هذه السنة؟» و«ماذا قبضتُ منه؟»
 * وكان جوابُهما يُجمع من ثلاث شاشات — الكشف التقديري لكلّ شهرٍ على
 * حدة، والأرشيف لكلّ دفعة، وقائمةُ المتأخّرات — فيُقرأ عشرَ مرّاتٍ
 * لأستاذٍ له فوجان في تسعة أشهر.
 *
 * **وسطرُه وحدةٌ واحدة: (إسنادٌ × كشفُ شهر).** فأستاذُ فوجين له سطران
 * في الشهر الواحد، لكلٍّ مادّتُه وفوجُه ومستحقُّه — والجمعُ في سطرٍ
 * واحد يُخفي أيَّ الفوجين لم يُخلَّص.
 *
 * والمبلغ **مجمَّدٌ لا محسوب**: يُقرأ من `Settlement.teacherAmount` كما
 * أُقرّ يومَ التخليص، لا يُعاد حسابُه اليوم. فما وُقّع عليه في نوفمبر
 * يبقى كما وُقّع ولو سدّد مخلَّفٌ بعده — والمتأخّرُ يظهر في بابه لا
 * بتعديل الماضي (انظر `teacher-debt-share.service`).
 *
 * والكشفُ الذي لم يُخلَّص يُعرض بلا مبلغ: تقديرُه يُحسب في شاشته
 * ويتغيّر بتغيّر الدفع، ووضعُ رقمٍ متحرّكٍ في كشف حسابٍ يُقرأ التزاماً.
 */
const shareSelect = prisma_1.Prisma.validator()({
    id: true,
    shareAmount: true,
    collectedAmount: true,
    attendedUnits: true,
    status: true,
    paidAt: true,
    createdAt: true,
    debtCollection: {
        select: {
            originalMonth: true,
            originalYear: true,
            collectedAt: true,
            payment: { select: { paymentNumber: true, paymentDate: true } },
            invoice: {
                select: {
                    studentEnrollment: {
                        select: {
                            student: { select: { id: true, firstName: true, lastName: true } },
                        },
                    },
                },
            },
        },
    },
    originalSettlement: {
        select: {
            id: true,
            settlementNumber: true,
            attendanceSheet: { select: { id: true, code: true, number: true, label: true } },
            teachingAssignment: {
                select: {
                    subject: { select: { id: true, name: true } },
                    studyGroup: { select: { id: true, name: true } },
                },
            },
        },
    },
    collectionSettlement: { select: { id: true, settlementNumber: true } },
    /*
     * الدفعةُ التي حملتها إلى الأستاذ.
     *
     * وبها يكتمل السطر: الطالبُ سدَّد في تاريخٍ، والأستاذُ قبض نصيبَه في
     * تاريخٍ آخر بدفعةٍ لها رقم. وبلا هذا العمود يبقى «قُبضت» دعوى بلا
     * سند — ومن يسأل «متى قبضتُها؟» لا يجد جواباً في الورقة.
     */
    allocations: {
        where: { teacherPayment: { status: { not: "CANCELLED" } } },
        select: {
            amount: true,
            teacherPayment: {
                select: { id: true, paymentNumber: true, paymentDate: true },
            },
        },
        take: 1,
    },
});
const num = (value) => Number(value);
const getTeacherStatementService = async (teacherId, academicYearId) => {
    const teacher = await client_1.prisma.teacher.findUnique({
        where: { id: teacherId },
        select: prisma_1.Prisma.validator()({
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            specialization: true,
            hireDate: true,
        }),
    });
    if (!teacher) {
        throw new app_errors_1.NotFoundException("Teacher not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    const academicYear = await client_1.prisma.academicYear.findUnique({
        where: { id: academicYearId },
        select: { id: true, name: true, startDate: true, endDate: true },
    });
    if (!academicYear) {
        throw new app_errors_1.NotFoundException("Academic year not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    /* كشوفُ الأستاذ في السنة — بمادّتها وفوجها وحصصها */
    const sheets = await client_1.prisma.attendanceSheet.findMany({
        where: {
            academicYearId,
            teachingAssignment: { teacherId },
        },
        select: {
            id: true,
            code: true,
            number: true,
            label: true,
            teachingAssignmentId: true,
            teachingAssignment: {
                select: {
                    subject: { select: { id: true, name: true } },
                    studyGroup: { select: { id: true, name: true } },
                },
            },
            sessions: {
                where: { status: { not: "CANCELLED" } },
                select: { sessionDate: true, status: true },
                orderBy: { sessionDate: "asc" },
            },
            settlements: {
                where: { status: { not: "CANCELLED" } },
                select: {
                    id: true,
                    settlementNumber: true,
                    status: true,
                    teacherAmount: true,
                    studentCountSnapshot: true,
                    paidStudentCountSnapshot: true,
                    completedSessionsSnapshot: true,
                    approvedSessionsSnapshot: true,
                    confirmedAt: true,
                    paidAt: true,
                    revision: true,
                    teachingAssignmentId: true,
                    /* الدفعة التي حملته — منها رقمُها وتاريخُها */
                    teacherAllocations: {
                        select: {
                            amount: true,
                            teacherPayment: {
                                select: {
                                    id: true,
                                    paymentNumber: true,
                                    paymentDate: true,
                                    status: true,
                                },
                            },
                        },
                    },
                },
                orderBy: { revision: "desc" },
            },
        },
        orderBy: { number: "asc" },
    });
    const rows = sheets.map((sheet) => {
        /*
         * تخليصُ هذا الإسناد بعينه، وأحدثُ محاولةٍ منه.
         *
         * والكشف قد يحمل تخليصاتٍ لإسنادات أخرى نظرياً، فيُقيَّد بإسناده.
         */
        const settlement = sheet.settlements.find((s) => s.teachingAssignmentId === sheet.teachingAssignmentId) ?? null;
        const allocation = settlement?.teacherAllocations.find((a) => a.teacherPayment.status !== "CANCELLED");
        const first = sheet.sessions[0]?.sessionDate ?? null;
        return {
            sheetId: sheet.id,
            sheetCode: sheet.code,
            sheetNumber: sheet.number,
            sheetLabel: sheet.label,
            month: first ? first.getUTCMonth() + 1 : null,
            year: first ? first.getUTCFullYear() : null,
            firstSession: first,
            subject: sheet.teachingAssignment.subject,
            studyGroup: sheet.teachingAssignment.studyGroup,
            completedSessions: sheet.sessions.filter((s) => s.status === "COMPLETED").length,
            sessions: sheet.sessions.length,
            settlement: settlement
                ? {
                    id: settlement.id,
                    settlementNumber: settlement.settlementNumber,
                    status: settlement.status,
                    teacherAmount: num(settlement.teacherAmount),
                    students: settlement.studentCountSnapshot,
                    paidStudents: settlement.paidStudentCountSnapshot,
                    completedSessions: settlement.completedSessionsSnapshot,
                    approvedSessions: settlement.approvedSessionsSnapshot,
                    confirmedAt: settlement.confirmedAt,
                    paidAt: settlement.paidAt,
                }
                : null,
            payment: allocation
                ? {
                    id: allocation.teacherPayment.id,
                    paymentNumber: allocation.teacherPayment.paymentNumber,
                    paymentDate: allocation.teacherPayment.paymentDate,
                    amount: num(allocation.amount),
                }
                : null,
        };
    });
    /* الترتيب بالزمن لا برقم الكشف: لكلّ إسنادٍ ترقيمٌ مستقلّ */
    rows.sort((a, b) => {
        const at = a.firstSession?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const bt = b.firstSession?.getTime() ?? Number.MAX_SAFE_INTEGER;
        if (at !== bt)
            return at - bt;
        return a.subject.name.localeCompare(b.subject.name, "ar");
    });
    /*
     * المتأخّرات — نصيبُه من ديونٍ حُصّلت بعد تخليص كشوفها.
     *
     * وتُقرأ من أصلها لا من سنتها: الحصة تُنسب إلى التخليص الذي نشأت
     * فيه، فتُقيَّد بسنة ذلك التخليص لا بسنة قبضها — وإلّا ظهرت حصةُ
     * كشفٍ من السنة الماضية في كشف حساب هذه السنة.
     */
    const shares = await client_1.prisma.teacherDebtShare.findMany({
        where: {
            teacherId,
            status: { not: "CANCELLED" },
            originalSettlement: { academicYearId },
        },
        select: shareSelect,
        orderBy: { createdAt: "asc" },
    });
    const arrears = shares.map(({ allocations, ...share }) => ({
        ...share,
        shareAmount: num(share.shareAmount),
        collectedAmount: num(share.collectedAmount),
        /** الدفعةُ التي قبض بها نصيبَه — أو `null` إن لم تُدفع بعد */
        teacherPayment: allocations[0]
            ? {
                id: allocations[0].teacherPayment.id,
                paymentNumber: allocations[0].teacherPayment.paymentNumber,
                paymentDate: allocations[0].teacherPayment.paymentDate,
                amount: num(allocations[0].amount),
            }
            : null,
    }));
    const totals = rows.reduce((sum, row) => {
        const amount = row.settlement?.teacherAmount ?? 0;
        const paid = row.settlement?.status === "PAID";
        return {
            sheets: sum.sheets + 1,
            settled: sum.settled + (row.settlement ? 1 : 0),
            due: sum.due + amount,
            paid: sum.paid + (paid ? amount : 0),
            unpaid: sum.unpaid + (paid ? 0 : amount),
            completedSessions: sum.completedSessions + row.completedSessions,
        };
    }, { sheets: 0, settled: 0, due: 0, paid: 0, unpaid: 0, completedSessions: 0 });
    const arrearsPaid = arrears
        .filter((a) => a.status === "PAID")
        .reduce((sum, a) => sum + a.shareAmount, 0);
    const arrearsPending = arrears
        .filter((a) => a.status !== "PAID")
        .reduce((sum, a) => sum + a.shareAmount, 0);
    /* القرشُ يُقرَّب هنا لا في الشاشة: جمعُ العشرات يُخرج 8578.130000000001 */
    const round = (value) => Math.round(value * 100) / 100;
    return {
        teacher,
        academicYear,
        rows,
        arrears,
        totals: {
            sheets: totals.sheets,
            settled: totals.settled,
            completedSessions: totals.completedSessions,
            due: round(totals.due),
            paid: round(totals.paid),
            unpaid: round(totals.unpaid),
            arrearsPaid: round(arrearsPaid),
            arrearsPending: round(arrearsPending),
            /** كلُّ ما استحقّه في السنة: كشوفُه ومتأخّراتُه */
            grandDue: round(totals.due + arrearsPaid + arrearsPending),
            grandPaid: round(totals.paid + arrearsPaid),
            grandUnpaid: round(totals.unpaid + arrearsPending),
        },
    };
};
exports.getTeacherStatementService = getTeacherStatementService;
//# sourceMappingURL=teacher-statement.service.js.map