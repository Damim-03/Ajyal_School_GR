"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiredFieldFor = exports.computeSettlement = void 0;
const prisma_1 = require("../../../generated/prisma");
const rounding_1 = require("./rounding");
const ZERO = new prisma_1.Prisma.Decimal(0);
/** عدد الطلبة وفق أساس العدّ — لا يُستعمل مع PER_ATTENDED_SHARE */
const resolveCountedStudents = (input) => {
    switch (input.countBasis) {
        case "PAID":
            return input.paidCount;
        case "PRESENT":
            // متوسّط الحضور عبر الحصص، مقرَّباً لأقرب صحيح
            return input.sessions.length > 0
                ? Math.round(input.sessions.reduce((sum, s) => sum + s.presentCount, 0) /
                    input.sessions.length)
                : 0;
        case "ENROLLED":
        default:
            return input.enrolledCount;
    }
};
const computeSettlement = (input) => {
    const { roundingMode: mode, roundingPrecision: dp } = input;
    const attendedUnits = input.sessions.reduce((sum, s) => sum + s.presentCount, 0);
    const countedUnits = input.sessions.reduce((sum, s) => sum + s.countedCount, 0);
    const countedStudents = resolveCountedStudents(input);
    const sessionCount = input.sessions.length;
    const pct = input.teacherPercentage
        ? input.teacherPercentage.div(100)
        : ZERO;
    switch (input.method) {
        // ------------------------------------------------
        // نسبة من حقوق الطلبة — §11
        //
        // الإجمالي شهريٌّ مسطَّح: عدد الطلبة × الحقّ × النسبة. والأسطر
        // توزيعٌ للعرض لا مصدرٌ للمجموع، ولذلك تُوزَّع بـ distributeEvenly
        // فيبقى مجموع العمود مطابقاً للخانة السفلى.
        // ------------------------------------------------
        case "PERCENTAGE": {
            const gross = input.countBasis === "PAID"
                ? input.tuition.times(input.paidCount)
                : input.tuition.times(countedStudents);
            const teacherAmount = (0, rounding_1.roundMoney)(gross.times(pct), mode, dp);
            const shares = (0, rounding_1.distributeEvenly)(teacherAmount, sessionCount, mode, dp);
            return {
                teacherAmount,
                attendedUnits,
                countedUnits,
                countedStudents,
                lines: input.sessions.map((session, i) => ({
                    sessionId: session.sessionId,
                    lessonNumber: session.lessonNumber,
                    sessionDate: session.sessionDate,
                    countedStudents,
                    rate: countedStudents > 0
                        ? shares[i].div(countedStudents).toDecimalPlaces(4)
                        : ZERO,
                    lineTotal: shares[i],
                })),
            };
        }
        // ------------------------------------------------
        // مبلغ ثابت لكل طالب
        // ------------------------------------------------
        case "PER_STUDENT": {
            const perStudent = input.amountPerStudent ?? ZERO;
            const teacherAmount = (0, rounding_1.roundMoney)(perStudent.times(countedStudents), mode, dp);
            const shares = (0, rounding_1.distributeEvenly)(teacherAmount, sessionCount, mode, dp);
            return {
                teacherAmount,
                attendedUnits,
                countedUnits,
                countedStudents,
                lines: input.sessions.map((session, i) => ({
                    sessionId: session.sessionId,
                    lessonNumber: session.lessonNumber,
                    sessionDate: session.sessionDate,
                    countedStudents,
                    rate: countedStudents > 0
                        ? shares[i].div(countedStudents).toDecimalPlaces(4)
                        : ZERO,
                    lineTotal: shares[i],
                })),
            };
        }
        // ------------------------------------------------
        // مبلغ ثابت لكل حصة — لا علاقة له بعدد الطلبة
        //
        // هنا الأسطر هي المصدر والمجموع مشتقٌّ منها، عكس الطريقتين
        // السابقتين. وعدد الطلبة يُعرض للعلم لا للحساب.
        // ------------------------------------------------
        case "PER_SESSION": {
            const perSession = (0, rounding_1.roundMoney)(input.amountPerSession ?? ZERO, mode, dp);
            const lines = input.sessions.map((session) => ({
                sessionId: session.sessionId,
                lessonNumber: session.lessonNumber,
                sessionDate: session.sessionDate,
                countedStudents,
                rate: perSession,
                lineTotal: perSession,
            }));
            return {
                teacherAmount: perSession.times(sessionCount),
                attendedUnits,
                countedUnits,
                countedStudents,
                lines,
            };
        }
        // ------------------------------------------------
        // نصيب الأستاذ من حصة الطالب الواحدة × الحضور المحتسب
        //
        // وهي طريقة ورقة المؤسسة:
        //
        //   1500 ÷ 8 = 187.50        سعر الحصة للمؤسسة — لا للأستاذ
        //   7 دافعين × 8 حصص × 187.50 = 10,500
        //   2 دافعان × 3 حصص × 187.50 =  1,125
        //                     المجموع = 11,625  → × 75% = 8,718.75
        //
        // **وأساس العدّ يُقرأ هنا.** كان يُتجاهل، فيُحتسب حضور المخلَّفين
        // مع الدافعين ويخرج مبلغٌ أكبر ممّا في الورقة. والفرق ليس تجميلاً:
        // مع `PAID` يدفع الأستاذُ ثمنَ تأخّر الطالب، ومع `ENROLLED` تدفعه
        // المؤسسة. وكلاهما سياسةٌ مشروعة تختارها الإدارة — لكنّ الحساب
        // كان يفرض الثانية مهما اختارت.
        //
        // والقسمة تُحفظ بأربع منازل ولا تُقرَّب إلا بعد الضرب في الحضور،
        // وإلا انحرف المجموع عن الآلة الحاسبة.
        // ------------------------------------------------
        case "PER_ATTENDED_SHARE": {
            const perSessionShare = input.approvedSessions > 0
                ? input.tuition.div(input.approvedSessions)
                : ZERO;
            const rate = perSessionShare.times(pct).toDecimalPlaces(4);
            // المجموع من الحضور المحتسب كلِّه لا من جمع أسطرٍ مقرَّبة
            const teacherAmount = (0, rounding_1.roundMoney)(rate.times(countedUnits), mode, dp);
            /*
             * وفرقُ التقريب يُحمَّل على السطر الأخير.
             *
             * بغيره كان العمود يخالف خانته: خمسةُ أسطرٍ بـ1546.88 وثلاثةٌ
             * بـ1828.13 تُجمع 13,218.79 بينما المطبوع أسفلها 13,218.75.
             * أربعةُ سنتيمات لا تُغيّر مالاً، لكنّ الأستاذ يجمع العمود بآلته
             * فيجد رقماً غير الذي وقّع عليه — فيفقد الثقة بالورقة كلّها.
             */
            const raw = input.sessions.map((session) => (0, rounding_1.roundMoney)(rate.times(session.countedCount), mode, dp));
            const drift = teacherAmount.minus(raw.reduce((sum, value) => sum.plus(value), ZERO));
            const lines = input.sessions.map((session, i) => ({
                sessionId: session.sessionId,
                lessonNumber: session.lessonNumber,
                sessionDate: session.sessionDate,
                countedStudents: session.countedCount,
                rate,
                lineTotal: i === raw.length - 1
                    ? (0, rounding_1.roundMoney)(raw[i].plus(drift), mode, dp)
                    : raw[i],
            }));
            return {
                teacherAmount,
                attendedUnits,
                countedUnits,
                countedStudents,
                lines,
            };
        }
    }
};
exports.computeSettlement = computeSettlement;
/**
 * اكتمال حقول الطريقة.
 *
 * §8: «لا تجعل جميع هذه القيم إلزامية في كل طريقة». فالتحقق مشروط
 * بالطريقة، ولا يعبّر عنه SQL بقيدٍ بسيط.
 */
const requiredFieldFor = (method) => {
    switch (method) {
        case "PER_STUDENT":
            return "amountPerStudent";
        case "PER_SESSION":
            return "amountPerSession";
        case "PERCENTAGE":
        case "PER_ATTENDED_SHARE":
        default:
            return "teacherPercentage";
    }
};
exports.requiredFieldFor = requiredFieldFor;
//# sourceMappingURL=settlement-calc.js.map