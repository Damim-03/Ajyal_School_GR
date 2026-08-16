"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeCharge = exports.countEligible = exports.isEligibleFor = void 0;
/**
 * هل كان هذا التسجيل قائماً يوم هذه الحصة؟
 *
 * والمقارنة باليوم لا باللحظة: من التحق صباح يوم الحصة مؤهَّلٌ لها،
 * ولو سُجّل في النظام بعدها بساعتين.
 */
const isEligibleFor = (enrollment, session) => {
    if (enrollment.eligibleFrom === null)
        return true;
    const from = Date.UTC(enrollment.eligibleFrom.getUTCFullYear(), enrollment.eligibleFrom.getUTCMonth(), enrollment.eligibleFrom.getUTCDate());
    const at = Date.UTC(session.sessionDate.getUTCFullYear(), session.sessionDate.getUTCMonth(), session.sessionDate.getUTCDate());
    return at >= from;
};
exports.isEligibleFor = isEligibleFor;
/** عددُ الحصص التي صار الطالب مسؤولاً عنها من بين المعطاة */
const countEligible = (enrollment, sessions) => enrollment.eligibleFrom === null
    ? sessions.length
    : sessions.filter((session) => (0, exports.isEligibleFor)(enrollment, session)).length;
exports.countEligible = countEligible;
const computeCharge = (input) => {
    const { tuition, approvedSessions, eligibleSessions, prorate } = input;
    const precision = input.precision ?? 2;
    /*
     * شهرٌ كامل حين: لا تناسب في السياسة، أو لا حصص معتمدة تُقسم عليها،
     * أو كان الطالب مؤهَّلاً لها جميعاً. والحالة الأخيرة هي الغالبة —
     * ولذلك تُرجع لقطاتٍ فارغة فلا تُثقل الفواتير بأرقامٍ بلا معنى.
     */
    if (!prorate ||
        approvedSessions <= 0 ||
        eligibleSessions >= approvedSessions) {
        return {
            amount: tuition,
            approvedSessions: null,
            eligibleSessions: null,
            sessionRate: null,
        };
    }
    // سعر الحصة بأربع منازل: القسمة قد لا تنتهي (1500 ÷ 7)، والتقريب
    // قبل الضرب يُبعد المجموع عن الآلة الحاسبة.
    const sessionRate = tuition.div(approvedSessions).toDecimalPlaces(4);
    return {
        amount: sessionRate.times(Math.max(0, eligibleSessions)).toDecimalPlaces(precision),
        approvedSessions,
        eligibleSessions: Math.max(0, eligibleSessions),
        sessionRate,
    };
};
exports.computeCharge = computeCharge;
//# sourceMappingURL=eligibility.js.map