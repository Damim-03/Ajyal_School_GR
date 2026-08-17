"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dailyClearanceService = exports.settlementEstimateService = void 0;
const prisma_1 = require("../../../generated/prisma");
const client_1 = require("../../core/prisma/client");
const time_1 = require("../../core/utils/time");
const settlement_service_1 = require("./settlement.service");
/**
 * الكشفان الماليان.
 *
 * تحت /settlements لا /reports عمداً: هناك بالفعل
 * `/reports/expected-sessions` و`/reports/session-clearance`، وهما
 * عن **الحضور** لا عن المال — الأول يعدّ الحصص المتوقَّعة من الجدول،
 * والثاني يسأل «هل سُجّل حضور كل الطلبة؟». الاسمان متطابقان
 * والمعنى مختلف، فوضعُ هذين معهما يجعل التمييز مستحيلاً.
 */
const num = (value) => Number(value);
// --------------------------------------------------
// §16 — الكشف التقديري للحصص
//
// يُحسب ولا يُحفظ: الإدارة ترى المبلغ قبل أن تلتزم به. ونفس دالّة
// الجمع التي يستعملها الحفظ، فما تراه الشاشة هو ما سيُخزَّن حرفياً
// لا تقديرٌ مشابه.
// --------------------------------------------------
const settlementEstimateService = async (query) => {
    const facts = await (0, settlement_service_1.gatherSettlementFacts)(query.teachingAssignmentId, query.attendanceSheetId, query.policyId);
    const { assignment, sheet, policy, fee, result, totals, students, sessions } = facts;
    /** الحضور الخام لكل حصة — مفتاحُه رقم الحصة */
    const presentBySession = new Map(sessions.map((session) => [session.lessonNumber, session.presentCount]));
    /** تواريخ الحصص المحتسبة مرتَّبةً — لمجال الكشف */
    const sortedDates = result.lines
        .map((line) => line.sessionDate)
        .filter((date) => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());
    /**
     * سعر الحصة الواحدة **للمؤسسة** — الحقّ الشهري ÷ الحصص المعتمدة.
     *
     * وهو غيرُ نصيب الأستاذ من الوحدة (§4 و§52): هذا ما تساويه الحصةُ
     * على الطالب، وذاك ما يأخذه الأستاذ منها بعد النسبة. وبه تُقوَّم
     * حصصُ المخلَّفين — خدمةٌ قُدِّمت ولم تُحصَّل، فتُحفظ قيمتُها كاملةً
     * لا منقوصةً بالنسبة.
     */
    const institutionSessionRate = sheet.sessionCount > 0
        ? fee.amount.div(sheet.sessionCount).toDecimalPlaces(4)
        : new prisma_1.Prisma.Decimal(0);
    /** حضورُ المخلَّفين — ما لم يدخل الحساب من الحضور الخام */
    const outstandingUnits = result.attendedUnits - result.countedUnits;
    return {
        header: {
            subject: assignment.subject,
            teacher: assignment.teacher,
            studyGroup: {
                id: assignment.studyGroup.id,
                name: assignment.studyGroup.name,
            },
            level: assignment.studyGroup.level,
            educationStage: assignment.studyGroup.level.educationStage,
            sheet: {
                id: sheet.id,
                number: sheet.number,
                label: sheet.label,
                sessionCount: sheet.sessionCount,
            },
            /*
             * المجال بأقدم تاريخٍ وأحدثه — لا باسم شهر ولا بترتيب الأرقام.
             *
             * كان يُقرأ من أوّل سطرٍ وآخره، والأسطر مرتَّبةٌ برقم الحصة. فكشفٌ
             * رُقّمت حصصُه عكس تواريخها كان يعرض «15/08 → 02/07» مقلوباً.
             */
            dateFrom: sortedDates[0] ?? null,
            dateTo: sortedDates[sortedDates.length - 1] ?? null,
        },
        policy: {
            id: policy.id,
            name: policy.name,
            method: policy.method,
            countBasis: policy.countBasis,
            roundingMode: policy.roundingMode,
            roundingPrecision: policy.roundingPrecision,
            teacherPercentage: policy.teacherPercentage
                ? num(policy.teacherPercentage)
                : null,
            amountPerStudent: policy.amountPerStudent
                ? num(policy.amountPerStudent)
                : null,
            amountPerSession: policy.amountPerSession
                ? num(policy.amountPerSession)
                : null,
        },
        tuition: num(fee.amount),
        // جدول §16: الحصة · عدد الطلبة المحتسبين · قيمة الحصة · المجموع
        rows: result.lines.map((line, index) => ({
            /*
             * ترتيبُ الحصة **داخل هذا الكشف** — 1 إلى N بالتاريخ.
             *
             * وهو ما تعرضه الورقة: «الحصة 1» أوّلُ ما دُرِّس لا أوّلُ رقمٍ في
             * الجدول الأسبوعي. أمّا `lessonNumber` فيبقى مرافقاً لأنّه مفتاح
             * الحصة في السجل، وبه تُراجَع.
             */
            order: index + 1,
            lessonNumber: line.lessonNumber,
            sessionDate: line.sessionDate,
            countedStudents: line.countedStudents,
            /*
             * من حضر — قبل تصفية أساس العدّ.
             *
             * يُعرض بجانب المحتسب لأنّ الفرق بينهما هو السؤال الذي يُطرح على
             * كل كشف: «لماذا سبعةٌ وقد رأيتُ أحدَ عشرَ في ورقة الحضور؟».
             * والجواب أربعةٌ مخلَّفون — ويُقرأ من الجدول بلا سؤال.
             */
            presentStudents: presentBySession.get(line.lessonNumber) ?? line.countedStudents,
            rate: num(line.rate),
            lineTotal: num(line.lineTotal),
            /*
             * المخلَّفون في هذه الحصة وقيمةُ خدمتهم.
             *
             * حضروا ولم يدخلوا الحساب لأنّهم لم يسدّدوا. وقيمتُهم تُقوَّم
             * بسعر المؤسسة لا بنصيب الأستاذ: الدرسُ أُعطي كاملاً، والذي لم
             * يُحصَّل هو حقُّ المؤسسة كلُّه لا ثلاثة أرباعه (§12).
             *
             * ولا يُجمع هذا مع «المجموع» أبداً (§15 و§37): ذاك مالٌ مستحقٌّ
             * للأستاذ، وهذا مالٌ لم يدخل الصندوق.
             */
            outstandingStudents: (presentBySession.get(line.lessonNumber) ?? line.countedStudents) -
                line.countedStudents,
            outstandingAmount: num(institutionSessionRate
                .times((presentBySession.get(line.lessonNumber) ?? line.countedStudents) -
                line.countedStudents)
                .toDecimalPlaces(policy.roundingPrecision)),
        })),
        /*
         * صفٌّ لكل طالب — حضورُه ودَينُه.
         *
         * الأستاذ يُخلَّص في وقته سواء دفع الطلبة أم لا، فما لم يُدفع يبقى
         * ديناً على الطالب لا خصماً من الأستاذ (§2). ولذلك يظهر الحضور
         * والدَّين في سطرٍ واحد: مَن يخلّص يحتاج أن يرى الاثنين معاً.
         */
        students: students.map((row) => ({
            studentId: row.student.id,
            firstName: row.student.firstName,
            lastName: row.student.lastName,
            parentPhone: row.student.parentPhone,
            present: row.present,
            attended: row.attended,
            late: row.late,
            absent: row.absent,
            excused: row.excused,
            blank: row.blank,
            invoice: row.invoice,
            defaulter: row.defaulter,
            uninvoiced: row.uninvoiced,
        })),
        totals: {
            approvedSessions: sheet.sessionCount,
            completedSessions: totals.completedSessions,
            missingSessions: Math.max(sheet.sessionCount - totals.completedSessions, 0),
            enrolledStudents: totals.enrolledCount,
            paidStudents: totals.paidCount,
            unpaidStudents: totals.enrolledCount - totals.paidCount,
            /** المخلَّفون — عليهم دَينٌ في هذه المادة لهذه الفترة */
            defaulters: totals.defaulterCount,
            /** بلا فاتورة أصلاً — لا دَين مقيَّد عليهم، وهو خللٌ لا حالة */
            uninvoiced: totals.uninvoicedCount,
            /** الحضور الخام — كلُّ من حضر */
            attendedUnits: result.attendedUnits,
            /** ما دخل الحساب منه وفق أساس العدّ — وهو الذي يفسّر المبلغ */
            countedUnits: result.countedUnits,
            /** حضورُ المخلَّفين — لم يدخل الحساب */
            outstandingUnits,
            /** سعر الحصة للمؤسسة: الحقّ الشهري ÷ الحصص المعتمدة */
            institutionSessionRate: num(institutionSessionRate),
            /**
             * قيمةُ ما قُدِّم ولم يُحصَّل — رقمٌ مستقلٌّ لا يُجمع مع مستحقّ
             * الأستاذ ولا مع المحصَّل. وجودُه ليطالَب به لا لينسى.
             */
            outstandingEstimated: num(institutionSessionRate
                .times(outstandingUnits)
                .toDecimalPlaces(policy.roundingPrecision)),
            /**
             * نصيب الأستاذ المؤجَّل — ما قد يأخذه إن سُدِّدت تلك الحصص.
             *
             * **ليس مالاً ولا يُدفع الآن.** يُعرض لأنّ إخفاءه يجعل عمود «غير
             * محصَّل» يُقرأ خطأً: من رأى 6,000 ظنّها حقَّ الأستاذ الضائع،
             * وحقُّه منها 4,500 لا غير — والباقي حقُّ المؤسسة.
             *
             * وفارغٌ حين لا نسبةَ في السياسة (المبلغ الثابت لكل طالبٍ أو
             * حصة)، فلا معنى لنسبةٍ من مبلغٍ لا تحكمه نسبة.
             */
            outstandingTeacherShare: policy.teacherPercentage
                ? num(institutionSessionRate
                    .times(outstandingUnits)
                    .times(policy.teacherPercentage)
                    .div(100)
                    .toDecimalPlaces(policy.roundingPrecision))
                : null,
            grossTuition: num(totals.grossTuition),
            collected: num(totals.collected),
            remaining: num(totals.remaining),
            /// مستحقّ الأستاذ — يحسبه النظام، ولا يُدخله المستخدم (§18)
            teacherAmount: num(result.teacherAmount),
        },
    };
};
exports.settlementEstimateService = settlementEstimateService;
// --------------------------------------------------
// §17 — كشف التخليص اليومي المالي
//
// «ما دخل الصندوق اليوم». والمجموع من جمع الدفعات لا من إدخال
// المستخدم — §17: «Daily Total = SUM(all confirmed payments)».
//
// والملغاة مستثناة: القاعدة المعلنة في المخطّط أن كل حساب للمدفوع
// يستثني CANCELLED.
// --------------------------------------------------
const dailyClearanceService = async (query) => {
    const day = (0, time_1.startOfUtcDay)(query.date);
    const payments = await client_1.prisma.payment.findMany({
        where: {
            paymentDate: { gte: day, lt: (0, time_1.addUtcDays)(day, 1) },
            status: "ACTIVE",
            ...(query.receivedById && { receivedById: query.receivedById }),
            ...(query.paymentMethod && { paymentMethod: query.paymentMethod }),
        },
        select: {
            id: true,
            paymentNumber: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            note: true,
            receivedBy: {
                select: { id: true, firstName: true, lastName: true, username: true },
            },
            receipt: {
                select: { id: true, receiptNumber: true, status: true, printed: true },
            },
            paymentInvoices: {
                select: {
                    paidAmount: true,
                    invoice: {
                        select: {
                            id: true,
                            invoiceNumber: true,
                            month: true,
                            year: true,
                            studentEnrollment: {
                                select: {
                                    student: {
                                        select: { id: true, firstName: true, lastName: true },
                                    },
                                    teachingAssignment: {
                                        select: {
                                            subject: { select: { id: true, name: true } },
                                            studyGroup: { select: { id: true, name: true } },
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
            },
        },
        orderBy: { paymentDate: "asc" },
    });
    // سطرٌ لكل (دفعة × فاتورة): الدفعة الواحدة قد تسدّد ثلاث مواد،
    // والكشف الورقي يعرض المادة في عمود مستقلّ فلا بدّ من تفتيتها.
    const rows = payments.flatMap((payment) => payment.paymentInvoices.map((allocation) => {
        const { student, teachingAssignment } = allocation.invoice.studentEnrollment;
        return {
            paymentId: payment.id,
            paymentNumber: payment.paymentNumber,
            paymentDate: payment.paymentDate,
            paymentMethod: payment.paymentMethod,
            receiptNumber: payment.receipt?.receiptNumber ?? null,
            receiptStatus: payment.receipt?.status ?? null,
            printed: payment.receipt?.printed ?? false,
            receivedBy: payment.receivedBy,
            student,
            subject: teachingAssignment.subject,
            studyGroup: teachingAssignment.studyGroup,
            invoiceNumber: allocation.invoice.invoiceNumber,
            month: allocation.invoice.month,
            year: allocation.invoice.year,
            amount: num(allocation.paidAmount),
        };
    }));
    // تجميع بالموظّف — كل صندوقٍ يُوازن على حدة
    const byUser = new Map();
    for (const payment of payments) {
        const entry = byUser.get(payment.receivedBy.id) ?? {
            user: payment.receivedBy,
            count: 0,
            total: 0,
        };
        entry.count++;
        entry.total += num(payment.amount);
        byUser.set(payment.receivedBy.id, entry);
    }
    const byMethod = payments.reduce((acc, payment) => {
        acc[payment.paymentMethod] =
            (acc[payment.paymentMethod] ?? 0) + num(payment.amount);
        return acc;
    }, {});
    return {
        date: day,
        rows,
        byUser: [...byUser.values()],
        byMethod,
        totals: {
            paymentCount: payments.length,
            itemCount: rows.length,
            // المجموع من الدفعات لا من الأسطر: الدفعة غير الموزَّعة على
            // فاتورة (دفعةٌ مسبقة) لها مبلغ ولا سطر لها
            dailyTotal: payments.reduce((sum, p) => sum + num(p.amount), 0),
            allocatedTotal: rows.reduce((sum, row) => sum + row.amount, 0),
        },
    };
};
exports.dailyClearanceService = dailyClearanceService;
//# sourceMappingURL=settlement.report.service.js.map