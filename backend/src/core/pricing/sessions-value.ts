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

import { Prisma } from "../../../generated/prisma";
import { prisma } from "../prisma/client";
import { isEligibleFor } from "./eligibility";
import { resolveTuitionFeeForGroup } from "./tuition-scope";

/** كشفٌ بتسميته المعتمدة — «الشهر رقم 7» ما لم تُكتب تسمية */
export interface SheetRef {
  /** يُفتح به الكشفُ من زرّ الملاحظة */
  id: string;
  number: number;
  label: string | null;
}

export const sheetTitle = (sheet: SheetRef): string =>
  sheet.label?.trim() || `الشهر رقم ${sheet.number}`;

export interface SessionsValue {
  /** ما أُجري له إلى يوم المغادرة */
  taken: number;
  /** سقفُ الشهر — عليه تُقسم */
  approved: number;
  /** سعرُ الحصة الواحدة */
  rate: Prisma.Decimal;
  /** حقُّ المؤسسة عن حصصه */
  amount: Prisma.Decimal;
  /**
   * الكشفُ الذي أُخذت منه — وهو واحدٌ في الغالب.
   *
   * «5 من 8 حصص» وحدها لا تُراجَع: من أراد التثبّت بعد شهرٍ يحتاج
   * أن يعرف **أيَّ ورقةٍ** يفتح. والجمعُ لأنّ الكشف وحدةٌ إدارية لا
   * شهرٌ تقويمي، فقد يلمس شهرَ النقل كشفان.
   *
   * ويخلو حين لا تنتمي الحصصُ إلى كشفٍ بعد — الحصص المولَّدة من
   * الجدول الأسبوعي لا كشفَ لها حتّى تُضمّ.
   */
  sheets: SheetRef[];
}

const firstDayOfMonth = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month - 1, 1));

const lastDayOfMonth = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month, 0));

/** آخرُ لحظةٍ من يوم التاريخ — من غادر اليوم أخذ حصةَ اليوم */
const endOfUtcDay = (date: Date): Date =>
  new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      23,
      59,
      59,
      999,
    ),
  );

export const valueOfSessionsTaken = async (input: {
  teachingAssignmentId: string;
  subjectId: string;
  studyGroupId: string;
  academicYearId: string;
  /** أوّلُ يومٍ صار فيه عضواً — وفارغُه عضويةٌ من البداية */
  eligibleFrom: Date | null;
  /** يومُ المغادرة */
  until: Date;
}): Promise<SessionsValue | null> => {
  const fee = await resolveTuitionFeeForGroup(
    input.subjectId,
    input.studyGroupId,
    input.academicYearId,
  );

  if (!fee) return null;

  const year = input.until.getUTCFullYear();
  const month = input.until.getUTCMonth() + 1;

  const sessions = await prisma.session.findMany({
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
  const perMonth =
    (
      await prisma.academicYear.findUnique({
        where: { id: input.academicYearId },
        select: { sessionsPerMonth: true },
      })
    )?.sessionsPerMonth ?? 0;

  const approved = Math.max(sessions.length, perMonth);

  if (approved <= 0) return null;

  const cutoff = endOfUtcDay(input.until);

  const mine = sessions.filter(
    (session) =>
      session.sessionDate <= cutoff &&
      isEligibleFor({ eligibleFrom: input.eligibleFrom }, session),
  );

  const sheetIds = [
    ...new Set(mine.map((s) => s.sheetId).filter((id): id is string => id !== null)),
  ];

  const sheets = sheetIds.length
    ? await prisma.attendanceSheet.findMany({
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
