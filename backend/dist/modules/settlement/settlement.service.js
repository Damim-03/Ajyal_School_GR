"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelSettlementService = exports.paySettlementService = exports.confirmSettlementService = exports.removeSettlementDocumentService = exports.attachSettlementDocumentService = exports.getSettlementService = exports.listSettlementsService = exports.computeSettlementService = exports.gatherSettlementFacts = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const app_errors_1 = require("../../core/errors/app.errors");
const error_code_enum_1 = require("../../core/enums/error-code.enum");
const api_response_1 = require("../../core/config/api-response");
const time_1 = require("../../core/utils/time");
const financial_audit_1 = require("../../core/audit/financial-audit");
const settlement_scope_1 = require("../../core/pricing/settlement-scope");
const tuition_scope_1 = require("../../core/pricing/tuition-scope");
const settlement_calc_1 = require("../../core/pricing/settlement-calc");
const settlementSelect = {
    id: true,
    settlementNumber: true,
    revision: true,
    teachingAssignmentId: true,
    attendanceSheetId: true,
    academicYearId: true,
    teacherId: true,
    policyId: true,
    methodSnapshot: true,
    countBasisSnapshot: true,
    roundingModeSnapshot: true,
    roundingPrecisionSnapshot: true,
    percentageSnapshot: true,
    perStudentSnapshot: true,
    perSessionSnapshot: true,
    tuitionSnapshot: true,
    approvedSessionsSnapshot: true,
    completedSessionsSnapshot: true,
    studentCountSnapshot: true,
    paidStudentCountSnapshot: true,
    attendedUnitsSnapshot: true,
    grossTuitionSnapshot: true,
    collectedSnapshot: true,
    remainingSnapshot: true,
    teacherAmount: true,
    status: true,
    computedAt: true,
    confirmedAt: true,
    paidAt: true,
    cancelledAt: true,
    cancelReason: true,
    note: true,
    createdAt: true,
    updatedAt: true,
    teacher: { select: { id: true, firstName: true, lastName: true } },
    policy: { select: { id: true, name: true, method: true } },
    academicYear: { select: { id: true, name: true } },
    attendanceSheet: {
        select: { id: true, number: true, label: true, sessionCount: true },
    },
    teachingAssignment: {
        select: {
            id: true,
            subject: { select: { id: true, name: true } },
            studyGroup: {
                select: {
                    id: true,
                    name: true,
                    level: { select: { id: true, name: true } },
                },
            },
        },
    },
    confirmedBy: { select: { id: true, firstName: true, lastName: true } },
    paidBy: { select: { id: true, firstName: true, lastName: true } },
    cancelledBy: { select: { id: true, firstName: true, lastName: true } },
};
const lineSelect = {
    id: true,
    sessionId: true,
    lessonNumber: true,
    sessionDate: true,
    countedStudents: true,
    rate: true,
    lineTotal: true,
};
const n = (value) => value === null ? null : Number(value);
const toResponse = (settlement) => ({
    ...settlement,
    percentageSnapshot: n(settlement.percentageSnapshot),
    perStudentSnapshot: n(settlement.perStudentSnapshot),
    perSessionSnapshot: n(settlement.perSessionSnapshot),
    tuitionSnapshot: Number(settlement.tuitionSnapshot),
    grossTuitionSnapshot: Number(settlement.grossTuitionSnapshot),
    collectedSnapshot: Number(settlement.collectedSnapshot),
    remainingSnapshot: Number(settlement.remainingSnapshot),
    teacherAmount: Number(settlement.teacherAmount),
});
const toLineResponse = (line) => ({
    ...line,
    rate: Number(line.rate),
    lineTotal: Number(line.lineTotal),
});
// --------------------------------------------------
// جمع المعطيات — كل ما يدخل الحساب، مرّة واحدة
//
// مفصولٌ عن الحساب عمداً: هذه الدالّة تُستعمل أيضاً في الكشف
// التقديري (§16) الذي يعرض النتيجة **قبل** حفظها، فيرى المستخدم
// المبلغ قبل أن يلتزم به.
// --------------------------------------------------
const gatherSettlementFacts = async (teachingAssignmentId, attendanceSheetId, policyId) => {
    const sheet = await client_1.prisma.attendanceSheet.findUnique({
        where: { id: attendanceSheetId },
        select: {
            id: true,
            number: true,
            label: true,
            sessionCount: true,
            teachingAssignmentId: true,
            academicYearId: true,
            sessions: {
                select: {
                    id: true,
                    lessonNumber: true,
                    sessionDate: true,
                    status: true,
                    attendances: {
                        select: { status: true, studentEnrollmentId: true },
                    },
                },
                /*
                 * بالتاريخ لا برقم الحصة.
                 *
                 * `lessonNumber` رقمٌ متسلسل **داخل الجدول الأسبوعي**، لا ترتيبٌ
                 * داخل الكشف. فحصةٌ يتيمة ضُمّت إلى كشفٍ جديد تحتفظ برقمها
                 * القديم، وحصةٌ أُنشئت بعدها تأخذ رقماً أكبر ولو كان تاريخُها
                 * أقدم. والترتيبُ بالرقم كان يُخرج 02/07 بين 10/08 و13/08.
                 *
                 * وهو نفسُ ترتيب `attendance-sheet.service` — فما تراه الشاشتان
                 * واحد.
                 */
                orderBy: [{ sessionDate: "asc" }, { lessonNumber: "asc" }],
            },
        },
    });
    if (!sheet) {
        throw new app_errors_1.NotFoundException("Attendance sheet not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    if (sheet.teachingAssignmentId !== teachingAssignmentId) {
        throw new app_errors_1.BadRequestException("The attendance sheet belongs to a different teaching assignment", error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    const assignment = await client_1.prisma.teachingAssignment.findUnique({
        where: { id: teachingAssignmentId },
        select: {
            id: true,
            teacherId: true,
            subjectId: true,
            studyGroupId: true,
            academicYearId: true,
            subject: { select: { id: true, name: true } },
            teacher: { select: { id: true, firstName: true, lastName: true } },
            studyGroup: {
                select: {
                    id: true,
                    name: true,
                    type: true,
                    level: {
                        select: {
                            id: true,
                            name: true,
                            educationStage: { select: { id: true, name: true } },
                        },
                    },
                },
            },
            enrollments: {
                where: { isActive: true },
                select: {
                    id: true,
                    /** فارغُه أهليةٌ كاملة — ومنه تُعرف حصصُ من التحق متأخّراً */
                    eligibleFrom: true,
                    student: {
                        select: {
                            id: true,
                            firstName: true,
                            lastName: true,
                            parentPhone: true,
                        },
                    },
                },
            },
        },
    });
    if (!assignment) {
        throw new app_errors_1.NotFoundException("Teaching assignment not found", error_code_enum_1.ErrorCodeEnum.TEACHING_ASSIGNMENT_NOT_FOUND);
    }
    // الحصص المحتسبة: المنجزة وحدها. الملغاة لم تُدرَّس،
    // والمجدولة لم تُدرَّس بعد.
    const countedSessions = sheet.sessions.filter((session) => session.status === "COMPLETED");
    // كشفٌ لم تُنجز فيه حصة واحدة لا يُخلَّص.
    //
    // بغير هذا الحاجز تُنتج الطرائق المسطَّحة (PERCENTAGE و PER_STUDENT)
    // مبلغاً كاملاً لشهرٍ لم يُدرَّس: ستةَ عشرَ طالباً × 1500 × 75% =
    // 18000 مقابل صفرِ حصص. والمبلغُ صحيح حسابياً وفق السياسة، لكنه
    // جوابٌ عن سؤال لم يُطرح — لا شيء هنا يُخلَّص بعد.
    //
    // وهو أيضاً ما يجعل «مجموع الأسطر = الإجمالي» ثابتاً: لا إجمالي
    // بلا سطرٍ واحد على الأقل يسنده.
    if (countedSessions.length === 0) {
        throw new app_errors_1.BadRequestException(`Attendance sheet #${sheet.number} has no completed session yet ` +
            `(${sheet.sessions.length} session(s) recorded, 0 completed). ` +
            `There is nothing to settle.`, error_code_enum_1.ErrorCodeEnum.VALIDATION_ERROR);
    }
    /*
     * تاريخ المرجع: **أقدم** حصةٍ منجزة — بالتاريخ لا برقم الحصة.
     *
     * منه تُشتقّ السياسةُ السارية وشهرُ الفواتير المطابَقة، فكشفُ سبتمبر
     * يُحسب بأسعار سبتمبر مهما تأخّر تخليصه.
     *
     * وكان يُؤخذ من `countedSessions[0]` وهي مرتَّبةٌ برقم الحصة. ورقمُ
     * الحصة لا يلزم أن يوافق ترتيب التاريخ: كشفٌ حصّتُه الأولى في 15/08
     * والثامنة في 02/07 يجعل «الأولى» أحدثَ لا أقدم، فيطابق شهراً غير
     * الذي وقع فيه معظمُ الكشف — وتخرج المحتسبون صفراً بلا سببٍ ظاهر.
     *
     * والواجهة تطابق بأقدم تاريخ (`invoicePeriodOf`)، فكانا يفترقان.
     */
    const referenceDate = countedSessions
        .map((session) => session.sessionDate)
        .reduce((oldest, date) => (oldest === null || date < oldest ? date : oldest), null) ??
        sheet.sessions[0]?.sessionDate ??
        new Date();
    const policy = policyId
        ? await client_1.prisma.settlementPolicy.findUnique({ where: { id: policyId } })
        : await (0, settlement_scope_1.resolveSettlementPolicy)({
            academicYearId: assignment.academicYearId,
            subjectId: assignment.subjectId,
            studyGroupId: assignment.studyGroupId,
            teacherId: assignment.teacherId,
        }, referenceDate);
    if (!policy) {
        throw new app_errors_1.NotFoundException(`لا سياسةَ تخليصٍ سارية على ${assignment.subject.name} — ` +
            `${assignment.studyGroup.level.name} · ${assignment.studyGroup.name} ` +
            `في ${referenceDate.toISOString().slice(0, 10)}.\n` +
            (await (0, settlement_scope_1.explainMissingPolicy)({
                academicYearId: assignment.academicYearId,
                subjectId: assignment.subjectId,
                studyGroupId: assignment.studyGroupId,
                teacherId: assignment.teacherId,
            }, referenceDate)), error_code_enum_1.ErrorCodeEnum.SETTLEMENT_POLICY_NOT_FOUND);
    }
    const fee = await (0, tuition_scope_1.resolveTuitionFeeForGroup)(assignment.subjectId, assignment.studyGroupId, assignment.academicYearId);
    if (!fee) {
        throw new app_errors_1.NotFoundException(`لا حقّ اشتراك لـ${assignment.subject.name} — ${assignment.studyGroup.name}. ` +
            (await (0, tuition_scope_1.explainMissingFee)({
                subjectId: assignment.subjectId,
                studyGroupId: assignment.studyGroupId,
                levelId: assignment.studyGroup.level.id,
                educationStageId: assignment.studyGroup.level.educationStage.id,
                groupType: assignment.studyGroup.type,
            }, assignment.academicYearId)), error_code_enum_1.ErrorCodeEnum.TUITION_FEE_NOT_FOUND);
    }
    // المحصَّل والمتبقّي من فواتير هذا الإسناد في شهر أوّل حصة —
    // المطابقة نفسها المعتمدة في كشف الحقوق الشهري
    const enrollmentIds = assignment.enrollments.map((e) => e.id);
    const invoices = await client_1.prisma.invoice.findMany({
        where: {
            studentEnrollmentId: { in: enrollmentIds },
            month: referenceDate.getUTCMonth() + 1,
            year: referenceDate.getUTCFullYear(),
            status: { not: "CANCELLED" },
        },
        select: {
            id: true,
            invoiceNumber: true,
            studentEnrollmentId: true,
            total: true,
            remaining: true,
            status: true,
            dueDate: true,
        },
    });
    const grossTuition = invoices.reduce((sum, invoice) => sum.plus(invoice.total), new prisma_1.Prisma.Decimal(0));
    const remaining = invoices.reduce((sum, invoice) => sum.plus(invoice.remaining), new prisma_1.Prisma.Decimal(0));
    const collected = grossTuition.minus(remaining);
    // «دفع» = لم يبقَ عليه شيء في هذه المادة
    const paidCount = invoices.filter((invoice) => invoice.remaining.lte(0)).length;
    /**
     * من يدخل حسابَ الأستاذ — §19.
     *
     * `countBasis` لا يحكم من يظهر في كشف الحضور: الكشف يعرض كلَّ
     * مسجَّل مهما كانت حالته المالية. وإنّما يحكم **من يُحتسب**.
     *
     * و`PAID` هي سياسة ورقة المؤسسة: حضورُ المخلَّف لا يدخل مستحقَّ
     * الأستاذ حتى يسدِّد. وهي اختيارُ إدارةٍ لا حكمٌ حسابي — فمع
     * `ENROLLED` تتحمّل المؤسسةُ تأخّرَ الطالب، ومع `PAID` يتحمّله
     * الأستاذ.
     */
    const eligibleEnrollments = new Set(policy.countBasis === "PAID"
        ? invoices
            .filter((invoice) => invoice.remaining.lte(0))
            .map((invoice) => invoice.studentEnrollmentId)
        : enrollmentIds);
    const isPresent = (status) => status === "PRESENT" || status === "LATE";
    /*
     * أهليةُ كل تسجيلٍ لكل حصة — «غير مسجَّل» ليست غياباً.
     *
     * الطالب الذي التحق في الحصة الخامسة لا يُعدّ حاضراً ولا غائباً ولا
     * محتسباً ولا مخلَّفاً في الأربع الأولى: لم يكن طالباً فيها. ولا
     * يعتمد الحساب على خلوّ خانته من علامة — الخلوُّ قد يكون إهمالَ
     * تدوين، والأهليةُ حقيقةٌ مستقلّة تُقرأ من .
     */
    const eligibleAt = new Map(assignment.enrollments.map((e) => [e.id, e.eligibleFrom]));
    const memberAt = (enrollmentId, when) => {
        const from = eligibleAt.get(enrollmentId) ?? null;
        return from === null || when >= (0, time_1.startOfUtcDay)(from);
    };
    const sessions = countedSessions.map((session) => ({
        sessionId: session.id,
        lessonNumber: session.lessonNumber,
        sessionDate: session.sessionDate,
        // الحاضر والمتأخّر كلاهما حضور — المتأخّر جلس الحصة
        presentCount: session.attendances.filter((a) => isPresent(a.status) && memberAt(a.studentEnrollmentId, session.sessionDate)).length,
        countedCount: session.attendances.filter((a) => isPresent(a.status) &&
            memberAt(a.studentEnrollmentId, session.sessionDate) &&
            eligibleEnrollments.has(a.studentEnrollmentId)).length,
    }));
    /**
     * صفٌّ لكل طالب — حضورُه ودَينُه معاً.
     *
     * الجمع بينهما هنا لا في شاشتين: الأستاذ يُخلَّص في وقته سواء دفع
     * الطلبة أم لا، فيبقى ما لم يُدفع **ديناً على الطالب** لا خصماً من
     * الأستاذ (§2). ومَن ينظر في كشف التخليص يحتاج أن يرى الاثنين في
     * سطرٍ واحد: هذا حضر عشراً وعليه 1500.
     *
     * والدَّين مشتقٌّ لا مخزَّن: `Invoice.remaining` هو مصدره الوحيد،
     * فدفعُ الطالب يُطفئه من نفسه بلا خطوةٍ ثانية تُنسى.
     */
    const toNumber = (value) => Number(value);
    const invoiceByEnrollment = new Map(invoices.map((invoice) => [invoice.studentEnrollmentId, invoice]));
    const attendanceOf = (enrollmentId) => {
        let attended = 0;
        let absent = 0;
        let late = 0;
        let excused = 0;
        let blank = 0;
        for (const session of countedSessions) {
            // حصةٌ سبقت التحاقه — لا تُعدّ عليه ولا له
            if (!memberAt(enrollmentId, session.sessionDate))
                continue;
            const mark = session.attendances.find((a) => a.studentEnrollmentId === enrollmentId);
            if (!mark) {
                blank++;
                continue;
            }
            if (mark.status === "PRESENT")
                attended++;
            else if (mark.status === "LATE")
                late++;
            else if (mark.status === "ABSENT")
                absent++;
            else
                excused++;
        }
        return { attended, absent, late, excused, blank };
    };
    const students = assignment.enrollments
        .map((enrollment) => {
        const invoice = invoiceByEnrollment.get(enrollment.id) ?? null;
        const marks = attendanceOf(enrollment.id);
        const total = invoice ? toNumber(invoice.total) : 0;
        const debt = invoice ? toNumber(invoice.remaining) : 0;
        return {
            enrollmentId: enrollment.id,
            student: enrollment.student,
            ...marks,
            /* الحاضر والمتأخّر كلاهما حضور — المتأخّر جلس الحصة */
            present: marks.attended + marks.late,
            invoice: invoice
                ? {
                    id: invoice.id,
                    invoiceNumber: invoice.invoiceNumber,
                    total,
                    paid: total - debt,
                    remaining: debt,
                    status: invoice.status,
                    dueDate: invoice.dueDate,
                    /** تجاوز الاستحقاق ولم يُسدَّد */
                    overdue: debt > 0 && invoice.dueDate < new Date(),
                }
                : null,
            /** مخلَّف: عليه دَينٌ في هذه المادة لهذه الفترة */
            defaulter: debt > 0,
            /** أسوأ من المخلَّف — لا فاتورة له أصلاً فلا دَين مقيَّد */
            uninvoiced: invoice === null,
        };
    })
        .sort((a, b) => `${a.student.lastName} ${a.student.firstName}`.localeCompare(`${b.student.lastName} ${b.student.firstName}`, "ar"));
    const result = (0, settlement_calc_1.computeSettlement)({
        method: policy.method,
        countBasis: policy.countBasis,
        roundingMode: policy.roundingMode,
        roundingPrecision: policy.roundingPrecision,
        teacherPercentage: policy.teacherPercentage,
        amountPerStudent: policy.amountPerStudent,
        amountPerSession: policy.amountPerSession,
        tuition: fee.amount,
        approvedSessions: sheet.sessionCount,
        enrolledCount: enrollmentIds.length,
        paidCount,
        sessions,
    });
    return {
        sheet,
        assignment,
        policy,
        fee,
        referenceDate,
        result,
        students,
        /** الحضور الخام لكل حصة — يُعرض بجانب المحتسب فيُفهم الفرق */
        sessions,
        totals: {
            grossTuition,
            collected,
            remaining,
            paidCount,
            enrolledCount: enrollmentIds.length,
            completedSessions: countedSessions.length,
            defaulterCount: students.filter((s) => s.defaulter).length,
            uninvoicedCount: students.filter((s) => s.uninvoiced).length,
        },
    };
};
exports.gatherSettlementFacts = gatherSettlementFacts;
// --------------------------------------------------
// رقم التخليص — STL-YYYY-NNNN
// --------------------------------------------------
const buildSettlementNumber = (year, sequence) => `STL-${year}-${String(sequence).padStart(4, "0")}`;
const lastSequence = async (year) => {
    const prefix = `STL-${year}-`;
    /*
     * مجالٌ لا `startsWith` — للسبب نفسِه في `nextStudentNumber`.
     *
     * `startsWith` تُترجَم إلى `LIKE CONCAT(?, '%')`، فيلتقي معاملٌ ونصٌّ
     * حرفيّ وقد يختلف ترتيبُهما فيسقط الاستعلام على MariaDB 11.8. ولا
     * مطابقةَ نصّيةً هنا أصلاً: الأرقامُ ذاتُ سابقةٍ ثابتة.
     *
     * والمجالُ مكافئٌ تماماً: كلُّ نصٍّ يبدأ بالسابقة يقع في
     * `[prefix, prefix')` حيث `'` هو آخرُ محرفٍ فيها مزاداً واحداً —
     * وكلُّ ما وقع في المجال يبدأ بها.
     */
    const upper = prefix.slice(0, -1) +
        String.fromCharCode(prefix.charCodeAt(prefix.length - 1) + 1);
    const last = await client_1.prisma.settlement.findFirst({
        where: { settlementNumber: { gte: prefix, lt: upper } },
        orderBy: { settlementNumber: "desc" },
        select: { settlementNumber: true },
    });
    if (!last)
        return 0;
    return Number(last.settlementNumber.split("-")[2] ?? 0);
};
// --------------------------------------------------
// Compute — إنشاء التخليص أو إعادة حسابه
//
// Idempotent بقيد (إسناد + كشف): الضغط مرتين لا يُنشئ تخليصين، بل
// يُعيد حساب المسوّدة. والمؤكَّد يُرفض — §21.
// --------------------------------------------------
const computeSettlementService = async (body, userId) => {
    const facts = await (0, exports.gatherSettlementFacts)(body.teachingAssignmentId, body.attendanceSheetId, body.policyId);
    // الملغى لا يَشغل الموضع: البديل يأخذ revision تالياً، فالتاريخ
    // يُحفظ والتصحيح يبقى ممكناً معاً.
    const sheetScope = {
        teachingAssignmentId: body.teachingAssignmentId,
        attendanceSheetId: body.attendanceSheetId,
    };
    const existing = await client_1.prisma.settlement.findFirst({
        where: { ...sheetScope, status: { not: "CANCELLED" } },
        select: { id: true, status: true, settlementNumber: true, revision: true },
    });
    if (existing && existing.status !== "DRAFT") {
        throw new app_errors_1.ConflictException(`Settlement ${existing.settlementNumber} is ${existing.status} and cannot be recomputed. ` +
            `Cancel it and compute a replacement.`, error_code_enum_1.ErrorCodeEnum.SETTLEMENT_LOCKED);
    }
    // رقم المحاولة التالية — يتخطّى الملغاة
    const lastRevision = await client_1.prisma.settlement.findFirst({
        where: sheetScope,
        orderBy: { revision: "desc" },
        select: { revision: true },
    });
    const { policy, fee, result, totals, sheet, assignment } = facts;
    const data = {
        teachingAssignmentId: body.teachingAssignmentId,
        attendanceSheetId: body.attendanceSheetId,
        academicYearId: assignment.academicYearId,
        teacherId: assignment.teacherId,
        policyId: policy.id,
        methodSnapshot: policy.method,
        countBasisSnapshot: policy.countBasis,
        roundingModeSnapshot: policy.roundingMode,
        roundingPrecisionSnapshot: policy.roundingPrecision,
        percentageSnapshot: policy.teacherPercentage,
        perStudentSnapshot: policy.amountPerStudent,
        perSessionSnapshot: policy.amountPerSession,
        tuitionSnapshot: fee.amount,
        approvedSessionsSnapshot: sheet.sessionCount,
        completedSessionsSnapshot: totals.completedSessions,
        studentCountSnapshot: totals.enrolledCount,
        paidStudentCountSnapshot: totals.paidCount,
        // الوحدات التي أنتجت المبلغ — لا الحضور الخام. فاللقطة تُفسّر
        // الرقم، ومَن راجع الكشف بعد سنة يقسم المبلغ عليها فيخرج له
        // قيمةُ الوحدة بلا حاجة إلى إعادة تصفية الحضور.
        attendedUnitsSnapshot: result.countedUnits,
        grossTuitionSnapshot: totals.grossTuition,
        collectedSnapshot: totals.collected,
        remainingSnapshot: totals.remaining,
        teacherAmount: result.teacherAmount,
        note: body.note ?? null,
    };
    const settlement = await client_1.prisma.$transaction(async (tx) => {
        if (existing) {
            // إعادة الحساب: الأسطر القديمة تُمحى بالكامل ثم تُبنى من جديد،
            // فلا تبقى أسطرُ حصةٍ حُذفت من الكشف
            await tx.settlementLine.deleteMany({
                where: { settlementId: existing.id },
            });
            const updated = await tx.settlement.update({
                where: { id: existing.id },
                data: { ...data, computedAt: new Date() },
                select: settlementSelect,
            });
            await tx.settlementLine.createMany({
                data: result.lines.map((line) => ({
                    settlementId: existing.id,
                    ...line,
                })),
            });
            return updated;
        }
        const sequence = (await lastSequence(facts.referenceDate.getUTCFullYear())) + 1;
        const created = await tx.settlement.create({
            data: {
                ...data,
                revision: (lastRevision?.revision ?? 0) + 1,
                settlementNumber: buildSettlementNumber(facts.referenceDate.getUTCFullYear(), sequence),
            },
            select: settlementSelect,
        });
        await tx.settlementLine.createMany({
            data: result.lines.map((line) => ({
                settlementId: created.id,
                ...line,
            })),
        });
        return created;
    });
    await (0, financial_audit_1.recordAudit)({
        entity: "Settlement",
        entityId: settlement.id,
        action: existing ? "RECOMPUTE" : "CREATE",
        field: "teacherAmount",
        newValue: String(result.teacherAmount),
        userId,
    });
    return toResponse(settlement);
};
exports.computeSettlementService = computeSettlementService;
// --------------------------------------------------
// List / Get
// --------------------------------------------------
const listSettlementsService = async (query) => {
    const { skip, take, page, limit } = (0, api_response_1.getPagination)(query.page, query.limit);
    const where = {
        ...(query.academicYearId && { academicYearId: query.academicYearId }),
        ...(query.teacherId && { teacherId: query.teacherId }),
        ...(query.teachingAssignmentId && {
            teachingAssignmentId: query.teachingAssignmentId,
        }),
        ...(query.attendanceSheetId && {
            attendanceSheetId: query.attendanceSheetId,
        }),
        ...(query.status && { status: query.status }),
    };
    const [settlements, total] = await Promise.all([
        client_1.prisma.settlement.findMany({
            where,
            select: settlementSelect,
            skip,
            take,
            orderBy: { computedAt: "desc" },
        }),
        client_1.prisma.settlement.count({ where }),
    ]);
    return {
        settlements: settlements.map(toResponse),
        pagination: (0, api_response_1.buildPagination)(total, page, limit),
    };
};
exports.listSettlementsService = listSettlementsService;
const getSettlementService = async (id) => {
    const settlement = await client_1.prisma.settlement.findUnique({
        where: { id },
        select: {
            ...settlementSelect,
            lines: { select: lineSelect, orderBy: { lessonNumber: "asc" } },
            /* الأرشيف: الورقة الموقَّعة ممسوحةً، والكشفان مجمَّدين */
            documents: {
                select: {
                    id: true,
                    filePath: true,
                    fileName: true,
                    pageNumber: true,
                    note: true,
                    createdAt: true,
                    uploadedBy: { select: { id: true, firstName: true, lastName: true } },
                },
                orderBy: { pageNumber: "asc" },
            },
            snapshot: {
                select: { id: true, dailySheet: true, monthlyFees: true, createdAt: true },
            },
        },
    });
    if (!settlement) {
        throw new app_errors_1.NotFoundException("Settlement not found", error_code_enum_1.ErrorCodeEnum.SETTLEMENT_NOT_FOUND);
    }
    return {
        ...toResponse(settlement),
        lines: settlement.lines.map(toLineResponse),
        documents: settlement.documents,
        snapshot: settlement.snapshot,
    };
};
exports.getSettlementService = getSettlementService;
// --------------------------------------------------
// الأوراق الموقَّعة — أرشيفُ الإقرار
//
// الملفّ نفسه يُرفع عبر `/api/uploads` كما ترفع وثائقُ الطالب، وهذا
// يربط مسارَه بالتخليص. والفصلُ مقصود: الرفع خدمةٌ واحدة في النظام
// كلِّه، لا واحدةٌ لكل صاحب وثيقة.
// --------------------------------------------------
const attachSettlementDocumentService = async (settlementId, body, userId) => {
    await findOrThrow(settlementId);
    /*
     * الصفحة تُملأ أو تُضاف.
     *
     * إن جاء رقمُها استُبدلت: إعادةُ مسح الصفحة الثانية تحلّ محلّ
     * الأولى ولا تُراكم — وإلّا اجتمعت في الأرشيف ثلاثُ صورٍ لصفحةٍ
     * واحدة ولا يُعرف أيُّها الأخيرة.
     *
     * وإن لم يجئ فهي **تالية** ما وُجد: الورقة تعود من الأستاذ فتُمسح
     * صفحاتُها واحدةً بعد أخرى، ولا يُطلب من الماسح أن يعدّ.
     */
    const pageNumber = body.pageNumber ??
        ((await client_1.prisma.settlementDocument.aggregate({
            where: { settlementId },
            _max: { pageNumber: true },
        }))._max.pageNumber ?? 0) + 1;
    await client_1.prisma.settlementDocument.deleteMany({
        where: { settlementId, pageNumber },
    });
    return client_1.prisma.settlementDocument.create({
        data: {
            settlementId,
            filePath: body.filePath,
            fileName: body.fileName ?? null,
            pageNumber,
            note: body.note ?? null,
            uploadedById: userId,
        },
        select: {
            id: true,
            filePath: true,
            fileName: true,
            pageNumber: true,
            note: true,
            createdAt: true,
            uploadedBy: { select: { id: true, firstName: true, lastName: true } },
        },
    });
};
exports.attachSettlementDocumentService = attachSettlementDocumentService;
const removeSettlementDocumentService = async (documentId) => {
    const document = await client_1.prisma.settlementDocument.findUnique({
        where: { id: documentId },
        select: { id: true },
    });
    if (!document) {
        throw new app_errors_1.NotFoundException("Settlement document not found", error_code_enum_1.ErrorCodeEnum.RESOURCE_NOT_FOUND);
    }
    await client_1.prisma.settlementDocument.delete({ where: { id: documentId } });
    return { id: documentId };
};
exports.removeSettlementDocumentService = removeSettlementDocumentService;
// --------------------------------------------------
// Confirm — التجميد
//
// بعده لا إعادة حساب ولا تعديل. وهذا هو الحاجز الذي يجعل §21 قابلاً
// للتطبيق: التاريخ المالي لا يتغيّر لأن تغييره ممنوع بنيوياً لا
// موصى بتجنّبه.
// --------------------------------------------------
const findOrThrow = async (id) => {
    const settlement = await client_1.prisma.settlement.findUnique({
        where: { id },
        select: { id: true, status: true, settlementNumber: true, teacherAmount: true },
    });
    if (!settlement) {
        throw new app_errors_1.NotFoundException("Settlement not found", error_code_enum_1.ErrorCodeEnum.SETTLEMENT_NOT_FOUND);
    }
    return settlement;
};
const confirmSettlementService = async (id, body, userId) => {
    const existing = await findOrThrow(id);
    if (existing.status !== "DRAFT") {
        throw new app_errors_1.ConflictException(`Only draft settlements can be confirmed (currently ${existing.status})`, error_code_enum_1.ErrorCodeEnum.SETTLEMENT_LOCKED);
    }
    const settlement = await client_1.prisma.settlement.update({
        where: { id },
        data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            confirmedById: userId,
            ...(body.note !== undefined && { note: body.note }),
        },
        select: settlementSelect,
    });
    await (0, financial_audit_1.recordAudit)({
        entity: "Settlement",
        entityId: id,
        action: "CONFIRM",
        field: "status",
        oldValue: "DRAFT",
        newValue: "CONFIRMED",
        userId,
    });
    return toResponse(settlement);
};
exports.confirmSettlementService = confirmSettlementService;
/** التسليم الفعلي للأستاذ */
const paySettlementService = async (id, userId) => {
    const existing = await findOrThrow(id);
    if (existing.status !== "CONFIRMED") {
        throw new app_errors_1.ConflictException(`Only confirmed settlements can be marked paid (currently ${existing.status})`, error_code_enum_1.ErrorCodeEnum.SETTLEMENT_LOCKED);
    }
    const settlement = await client_1.prisma.settlement.update({
        where: { id },
        data: { status: "PAID", paidAt: new Date(), paidById: userId },
        select: settlementSelect,
    });
    await (0, financial_audit_1.recordAudit)({
        entity: "Settlement",
        entityId: id,
        action: "UPDATE",
        field: "status",
        oldValue: "CONFIRMED",
        newValue: "PAID",
        userId,
    });
    return toResponse(settlement);
};
exports.paySettlementService = paySettlementService;
// --------------------------------------------------
// Cancel — التصحيح الوحيد المتاح بعد التأكيد
//
// التخليص لا يُحذف: إثباتُ ما استُحقّ يبقى ولو أُلغي، ويُوثَّق مَن
// ألغى ومتى ولماذا. ثم يُحسب بديلٌ جديد.
// --------------------------------------------------
const cancelSettlementService = async (id, body, userId) => {
    const existing = await findOrThrow(id);
    if (existing.status === "CANCELLED") {
        throw new app_errors_1.ConflictException("Settlement is already cancelled", error_code_enum_1.ErrorCodeEnum.SETTLEMENT_LOCKED);
    }
    const settlement = await client_1.prisma.settlement.update({
        where: { id },
        data: {
            status: "CANCELLED",
            cancelledAt: new Date(),
            cancelledById: userId,
            cancelReason: body.cancelReason,
        },
        select: settlementSelect,
    });
    await (0, financial_audit_1.recordAudit)({
        entity: "Settlement",
        entityId: id,
        action: "CANCEL",
        field: "status",
        oldValue: existing.status,
        newValue: "CANCELLED",
        reason: body.cancelReason,
        userId,
    });
    return toResponse(settlement);
};
exports.cancelSettlementService = cancelSettlementService;
//# sourceMappingURL=settlement.service.js.map