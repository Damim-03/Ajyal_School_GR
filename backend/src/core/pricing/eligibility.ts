import { Prisma } from "../../../generated/prisma";

/**
 * أهليةُ الطالب لحصةٍ بعينها — «غير مسجَّل» ليست غياباً.
 *
 * الطالب الذي التحق بالفوج في الحصة الخامسة لم يغب عن الأربع الأولى:
 * لم يكن طالباً فيها. فلا يُعدّ غائباً ولا حاضراً ولا محتسباً ولا
 * مخلَّفاً، ولا يدخل أيَّ إحصاءٍ عنها — وحقُّه الشهري يُحسب بقدر ما
 * صار مسؤولاً عنه لا بقدر الشهر كلِّه.
 *
 * **والقاعدة هنا وحدها.** تقرأ منها الفوترةُ وكشفُ الحضور والتخليصُ
 * وتدوينُ الحضور الجماعي، فلا تفترق أربعةُ مواضع في تعريفٍ واحد كما
 * افترقت من قبل في تعريف «الحاضر».
 *
 * ولا تُبنى على `enrolledAt`: ذاك طابعُ إنشاء الصفّ لا تاريخُ الالتحاق
 * (كلُّ تسجيلات هذه القاعدة أُنشئت في يومين، وبناءُ الأهلية عليه كان
 * يُلغي كلَّ حضورٍ سابق). والمصدر `eligibleFrom` — **وفارغُه أهليةٌ
 * كاملة**، وهو ما يجعل الإضافة بلا أثرٍ رجعيّ على صفٍّ واحد.
 */

/** أقلُّ ما يلزم لتقرير الأهلية */
export interface EligibleScope {
  eligibleFrom: Date | null;
}

/** أقلُّ ما يلزم من الحصة */
export interface SessionAt {
  sessionDate: Date;
}

/**
 * هل كان هذا التسجيل قائماً يوم هذه الحصة؟
 *
 * والمقارنة باليوم لا باللحظة: من التحق صباح يوم الحصة مؤهَّلٌ لها،
 * ولو سُجّل في النظام بعدها بساعتين.
 */
export const isEligibleFor = (
  enrollment: EligibleScope,
  session: SessionAt,
): boolean => {
  if (enrollment.eligibleFrom === null) return true;

  const from = Date.UTC(
    enrollment.eligibleFrom.getUTCFullYear(),
    enrollment.eligibleFrom.getUTCMonth(),
    enrollment.eligibleFrom.getUTCDate(),
  );

  const at = Date.UTC(
    session.sessionDate.getUTCFullYear(),
    session.sessionDate.getUTCMonth(),
    session.sessionDate.getUTCDate(),
  );

  return at >= from;
};

/** عددُ الحصص التي صار الطالب مسؤولاً عنها من بين المعطاة */
export const countEligible = (
  enrollment: EligibleScope,
  sessions: SessionAt[],
): number =>
  enrollment.eligibleFrom === null
    ? sessions.length
    : sessions.filter((session) => isEligibleFor(enrollment, session)).length;

/**
 * حقُّ الطالب عن الفترة.
 *
 * ```
 *   الحصص المعتمدة  8   ما التزمت به المؤسسة
 *   الحصص المؤهَّلة  4   ما صار الطالب مسؤولاً عنه
 *   الحصص المحضورة  3   ما جلسه فعلاً        ← لا أثر له هنا
 *
 *   1500 ÷ 8 × 4 = 750
 * ```
 *
 * **والغياب لا يُنقص شيئاً.** من التحق في الخامسة وغاب واحدةً يدفع
 * 750 لا 562.50: التحاقُه المتأخّر يحدّد مسؤوليته، وغيابُه بعدها شأنُه.
 *
 * ويُرجع لقطاتِه معه ليُحفظ في الفاتورة **كيف** خرج المبلغ، فلا يبقى
 * رقمٌ بلا تفسير بعد سنة.
 */
export interface ChargeInput {
  /** الحقّ الشهري من `TuitionFee` */
  tuition: Prisma.Decimal;
  /** الحصص المعتمدة للفترة — لقطة الكشف */
  approvedSessions: number;
  /** ما صار الطالب مسؤولاً عنه */
  eligibleSessions: number;
  prorate: boolean;
  precision?: number;
}

export interface ChargeResult {
  amount: Prisma.Decimal;
  /** يُحفظ في الفاتورة — فارغٌ حين لا تناسب */
  approvedSessions: number | null;
  eligibleSessions: number | null;
  sessionRate: Prisma.Decimal | null;
}

export const computeCharge = (input: ChargeInput): ChargeResult => {
  const { tuition, approvedSessions, eligibleSessions, prorate } = input;
  const precision = input.precision ?? 2;

  /*
   * شهرٌ كامل حين: لا تناسب في السياسة، أو لا حصص معتمدة تُقسم عليها،
   * أو كان الطالب مؤهَّلاً لها جميعاً. والحالة الأخيرة هي الغالبة —
   * ولذلك تُرجع لقطاتٍ فارغة فلا تُثقل الفواتير بأرقامٍ بلا معنى.
   */
  if (
    !prorate ||
    approvedSessions <= 0 ||
    eligibleSessions >= approvedSessions
  ) {
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
