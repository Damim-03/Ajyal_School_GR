"use strict";
/**
 * قيمةُ ما أخذه الطالب من فوجٍ قبل أن يغادره.
 *
 * الطالبُ يدرس أربع حصصٍ في الفوج 1 ثمّ ينتقل، فيُسأل السؤالُ نفسه في
 * كلّ مرّة: **بكم هذه الأربع؟** والجوابُ لا يُترك لحسابٍ يدويّ على
 * هامش الكشف — يُكتب في ملاحظة النقل عند وقوعه، فيقرؤه الأستاذ
 * والإدارة معاً ولا يُختلف فيه بعد شهر.
 *
 * **والقاعدةُ هي قاعدةُ الفاتورة نفسها** ولا تفترق عنها:
 *
 * ```
 *   الحصص المعتمدة  12   سقفُ الشهر من سياسة السنة (لا ما أُنجز)
 *   حصصُه           4    ما أُجري وهو عضوٌ في الفوج، إلى يوم النقل
 *
 *   1500 ÷ 12 × 4 = 500.00
 * ```
 *
 * وثلاثةُ قيودٍ في هذا الحساب ليست تفصيلاً:
 *
 * 1. **القسمة على المعتمَد لا على المُنجَز.** لو قُسم على ما أُجري
 *    فعلاً لصارت حصةُ من نُقل في شهرٍ متعثّر أغلى من حصة من بقي —
 *    وهو مأخذٌ على المؤسسة لا على الطالب.
 * 2. **الغيابُ لا ينقص شيئاً.** المقياسُ ما صار مسؤولاً عنه لا ما
 *    جلسه؛ من حضر ثلاثاً من أربعٍ يدفع الأربع. وهي قاعدةُ
 *    `eligibility` عينها، تُقرأ من موضعٍ واحد فلا يفترق حسابان.
 * 3. **لا سعرَ فلا رقم.** إن لم يُضبط حقُّ الاشتراك لهذا الفوج تُرجع
 *    `null` وتخلو الملاحظة من المال — ورقمٌ مخترَعٌ أسوأُ من فراغ.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.valueOfSessionsTaken = exports.sheetTitle = void 0;
const client_1 = require("../prisma/client");
const eligibility_1 = require("./eligibility");
const tuition_scope_1 = require("./tuition-scope");
const sheetTitle = (sheet) => sheet.label?.trim() || `الشهر رقم ${sheet.number}`;
exports.sheetTitle = sheetTitle;
const firstDayOfMonth = (year, month) => new Date(Date.UTC(year, month - 1, 1));
const lastDayOfMonth = (year, month) => new Date(Date.UTC(year, month, 0));
/** آخرُ لحظةٍ من يوم التاريخ — من غادر اليوم أخذ حصةَ اليوم */
const endOfUtcDay = (date) => new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999));
const valueOfSessionsTaken = async (input) => {
    const fee = await (0, tuition_scope_1.resolveTuitionFeeForGroup)(input.subjectId, input.studyGroupId, input.academicYearId);
    if (!fee)
        return null;
    const year = input.until.getUTCFullYear();
    const month = input.until.getUTCMonth() + 1;
    const sessions = await client_1.prisma.session.findMany({
        where: {
            schedule: { teachingAssignmentId: input.teachingAssignmentId },
            status: { not: "CANCELLED" },
            sessionDate: {
                gte: firstDayOfMonth(year, month),
                lte: lastDayOfMonth(year, month),
            },
        },
        select: { sessionDate: true, sheetId: true },
        orderBy: { sessionDate: "asc" },
    });
    /* سقفُ الشهر من سياسة السنة — ولا يُنزَل عنه ولو أُنجز أقلّ */
    const perMonth = (await client_1.prisma.academicYear.findUnique({
        where: { id: input.academicYearId },
        select: { sessionsPerMonth: true },
    }))?.sessionsPerMonth ?? 0;
    const approved = Math.max(sessions.length, perMonth);
    if (approved <= 0)
        return null;
    const cutoff = endOfUtcDay(input.until);
    const mine = sessions.filter((session) => session.sessionDate <= cutoff &&
        (0, eligibility_1.isEligibleFor)({ eligibleFrom: input.eligibleFrom }, session));
    const sheetIds = [
        ...new Set(mine.map((s) => s.sheetId).filter((id) => id !== null)),
    ];
    const sheets = sheetIds.length
        ? await client_1.prisma.attendanceSheet.findMany({
            where: { id: { in: sheetIds } },
            select: { id: true, number: true, label: true },
            orderBy: { number: "asc" },
        })
        : [];
    const taken = mine.length;
    // أربع منازل للسعر: القسمة قد لا تنتهي (1500 ÷ 7)، والتقريب قبل
    // الضرب يُبعد المجموع عن الآلة الحاسبة — كما في `computeCharge`.
    const rate = fee.amount.div(approved).toDecimalPlaces(4);
    return {
        taken,
        approved,
        rate,
        amount: rate.times(taken).toDecimalPlaces(2),
        sheets,
    };
};
exports.valueOfSessionsTaken = valueOfSessionsTaken;
//# sourceMappingURL=sessions-value.js.map