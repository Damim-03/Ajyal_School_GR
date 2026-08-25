import { Prisma } from "../../../generated/prisma";
import { AttendanceStatus } from "../../../generated/prisma";
import { MoneyInput, rate, subtract, sum, toDecimal, toNumber } from "./money";

// ======================================================
// تعريفاتُ المؤشّرات — §65 و§66
//
// المؤشّرُ الواحد يُحسب في عشرين شاشة. وحين يُكتب في كلٍّ منها من
// جديد تتباعد التعريفات بصمت: شاشةٌ تحسب نسبةَ التحصيل من
// `invoice.remaining` وأخرى من مجموع الدفعات، فتعرض الشاشتان رقمين
// مختلفين لنفس الشهر — ولا يعرف أحدٌ أيُّهما الصحيح.
//
// فكلُّ مؤشّرٍ هنا دالّةٌ نقيّة واحدة: تأخذ أعداداً مجمّعةً سلفاً
// من قاعدة البيانات وتُرجع الرقم. لا تلمس Prisma ولا الشبكة، فهي
// قابلةٌ للاختبار بلا قاعدة بيانات — وهذا شرطُ اختبارِ الحالات
// الحديّة في §74 قبل أن توجد بياناتٌ أصلاً.
// ======================================================

// ======================================================
// المالية — جانب الطالب
// ======================================================

/**
 * الحضورُ المالي لفترة: كم فُوتر، وكم حُصِّل، وكم بقي.
 *
 * `collected = invoiced - remaining` لا مجموعُ الدفعات.
 *
 * الفرقُ جوهري: دفعةٌ في نوفمبر تسدّد فاتورةَ سبتمبر تدخل في
 * «محصَّل سبتمبر» بهذا التعريف، وفي «محصَّل نوفمبر» بالتعريف
 * الآخر. وكلاهما سؤالٌ مشروع، لكنّهما سؤالان مختلفان:
 *
 *   - هذا التعريف يجيب: **كم استوفينا من استحقاق سبتمبر؟**
 *   - مجموعُ الدفعات يجيب: **كم دخل الصندوق في نوفمبر؟**
 *
 * الأوّل لنسبة التحصيل، والثاني للتدفّق النقدي (§33) — ولذلك
 * `cashCollected` دالّةٌ منفصلة أدناه، لا تسميةٌ أخرى لنفس الرقم.
 *
 * وهذا التعريف هو المعمول به في `report.service.ts` الحالي، فلم
 * أُغيّره: تغييرُ تعريفٍ قائم يُنتج قفزةً في الأرقام التاريخية بلا
 * تغيّرٍ في الواقع.
 */
export const invoicing = (input: {
  /** مجموع `invoice.total` للفواتير غير الملغاة */
  invoicedTotal: MoneyInput;
  /** مجموع `invoice.remaining` لنفس المجموعة */
  remainingTotal: MoneyInput;
  /** مجموع `invoice.discount` لنفس المجموعة */
  discountTotal?: MoneyInput;
  invoiceCount?: number;
}) => {
  const invoiced = toDecimal(input.invoicedTotal);
  const remaining = toDecimal(input.remainingTotal);
  const collected = invoiced.minus(remaining);

  return {
    invoiced: toNumber(invoiced),
    collected: toNumber(collected),
    /** المتبقّي = المستحقّ غير المسدَّد. هو نفسه الدَّين (§25) */
    outstanding: toNumber(remaining),
    discounts: toNumber(input.discountTotal ?? 0),
    invoiceCount: input.invoiceCount ?? 0,
    /** §66: المحصَّل النشط ÷ المفوتر النشط */
    collectionRate: rate(collected, invoiced),
  };
};

/**
 * النقدُ الداخل فعلاً في الفترة — أساسُ §33.
 *
 * مجموعُ الدفعات النشطة بتاريخ الدفع، بصرف النظر عن الشهر الذي
 * تسدّده. يشمل تحصيلَ الديون القديمة لأنّ الدينار يدخل الصندوق
 * اليوم وإن كان استحقاقُه من سبتمبر.
 */
export const cashCollected = (input: {
  /** مجموع `payment.amount` للدفعات ACTIVE في الفترة */
  paymentTotal: MoneyInput;
  paymentCount?: number;
}) => {
  const total = toDecimal(input.paymentTotal);
  const count = input.paymentCount ?? 0;

  return {
    total: toNumber(total),
    count,
    /**
     * متوسّطُ الدفعة — `null` لا صفر حين لا دفعات.
     * «متوسّط 0 دج» يوحي بدفعاتٍ قيمتُها صفر، والواقعُ لا دفعات.
     */
    average: count > 0 ? toNumber(total.dividedBy(count)) : null,
  };
};

// ======================================================
// الديون — §25
// ======================================================

/**
 * الدَّين مقسوماً بحسب فترته الأصلية لا بحسب اليوم.
 *
 * «قديم» و«جارٍ» يُحدَّدان بشهر الفاتورة وسنتها (`invoice.month`
 * و`invoice.year`)، لا بـ`createdAt` — §58. فاتورةُ سبتمبر
 * المُدخَلة متأخّرةً في أكتوبر دَينُها سبتمبريّ.
 */
export const debt = (input: {
  /** متبقّي فواتير الفترة الجارية */
  currentRemaining: MoneyInput;
  /** متبقّي فواتير الفترات السابقة */
  previousRemaining: MoneyInput;
  /** عدد الطلبة الذين عليهم متبقٍّ > 0 */
  studentsInDebt?: number;
  /** مجموع `debtCollection.collectedAmount` النشط في الفترة */
  collectedOld?: MoneyInput;
}) => {
  const current = toDecimal(input.currentRemaining);
  const previous = toDecimal(input.previousRemaining);

  return {
    total: toNumber(current.plus(previous)),
    current: toNumber(current),
    /** الدَّين القديم: نشأ في فترةٍ سابقة ولم يُسدَّد بعد */
    old: toNumber(previous),
    studentsInDebt: input.studentsInDebt ?? 0,
    collectedOld: toNumber(input.collectedOld ?? 0),
    /**
     * نسبةُ استرداد الدَّين القديم.
     *
     * المقام = القديمُ المتبقّي + المحصَّل منه، أي حجمُ الدَّين
     * القديم قبل التحصيل. وقسمتُه على المتبقّي وحده تُنتج نسبةً
     * تتجاوز 100% كلّما حُصِّل أكثر ممّا بقي.
     */
    oldRecoveryRate: rate(
      input.collectedOld ?? 0,
      previous.plus(toDecimal(input.collectedOld ?? 0)),
    ),
  };
};

/**
 * تعتيقُ الدَّين — §25.
 *
 * الشرائح بالأشهر منذ الفترة الأصلية. الحدودُ ثابتةٌ هنا عمداً
 * لأنّها اصطلاحٌ محاسبي شائع (30/60/90)، لا عتبةُ تنبيهٍ تخصّ
 * المؤسسة — وتلك وحدها ما يجب أن يكون قابلاً للتهيئة (§7).
 */
export const DEBT_AGE_BUCKETS = [
  { key: "current", label: "الشهر الجاري", minMonths: 0, maxMonths: 0 },
  { key: "d30", label: "شهر واحد", minMonths: 1, maxMonths: 1 },
  { key: "d60", label: "شهران", minMonths: 2, maxMonths: 2 },
  { key: "d90", label: "ثلاثة أشهر", minMonths: 3, maxMonths: 3 },
  { key: "older", label: "أكثر من ثلاثة أشهر", minMonths: 4, maxMonths: null },
] as const;

export type DebtAgeBucket = (typeof DEBT_AGE_BUCKETS)[number]["key"];

/**
 * عمرُ الدَّين بالأشهر بين فترة الفاتورة وفترة المرجع.
 *
 * الحسابُ على (سنة، شهر) لا على تواريخ: الفاتورة تحمل الشهرَ
 * والسنةَ حقلَي أعمال (§58)، واشتقاقُ الفارق من التواريخ يُدخل
 * أخطاءَ اليوم والمنطقة الزمنية بلا فائدة.
 */
export const debtAgeInMonths = (
  invoice: { month: number; year: number },
  reference: { month: number; year: number },
): number =>
  (reference.year - invoice.year) * 12 + (reference.month - invoice.month);

export const debtAgeBucket = (ageInMonths: number): DebtAgeBucket => {
  const age = Math.max(0, ageInMonths);

  for (const bucket of DEBT_AGE_BUCKETS) {
    if (bucket.maxMonths === null) return bucket.key;
    if (age >= bucket.minMonths && age <= bucket.maxMonths) return bucket.key;
  }

  return "older";
};

// ======================================================
// الحضور — §18
// ======================================================

export type AttendanceCounts = Record<AttendanceStatus, number>;

export const emptyAttendanceCounts = (): AttendanceCounts => ({
  PRESENT: 0,
  ABSENT: 0,
  LATE: 0,
  EXCUSED: 0,
});

/**
 * نسبةُ الحضور.
 *
 * **المتأخّر يُحتسب حاضراً** — وهذا ما يفعله النظام اليوم في
 * `report.service.ts`، وهو الصواب مؤسسياً: الطالبُ المتأخّر حضر
 * الحصّة وتلقّى الدرس، وتأخّرُه مسألةُ انضباطٍ تُقاس بـ`lateRate`
 * على حدة.
 *
 * **والمعذورُ يبقى في المقام.** حذفُه يجعل فوجاً نصفُه بأعذار
 * يظهر بحضورٍ 100% — ووظيفةُ المؤشّر أن يكشف الفجوة لا أن
 * يُجمّلها. ومن أراد النسبةَ بلا أعذار فله `attendanceRateExcused`
 * أدناه، صريحاً باسمه.
 */
export const attendance = (counts: AttendanceCounts) => {
  const total = counts.PRESENT + counts.ABSENT + counts.LATE + counts.EXCUSED;
  const attended = counts.PRESENT + counts.LATE;

  return {
    counts,
    total,
    attended,
    /** §66: الحاضر (شاملاً المتأخّر) ÷ كلّ السجلّات المؤهَّلة */
    attendanceRate: rate(attended, total),
    absenceRate: rate(counts.ABSENT, total),
    lateRate: rate(counts.LATE, total),
    excusedRate: rate(counts.EXCUSED, total),
    /**
     * النسبةُ بعد استبعاد المعذورين من المقام — لقياس الانضباط
     * وحده. تُعرض بجانب الأولى لا بدلاً منها.
     */
    attendanceRateExcused: rate(attended, total - counts.EXCUSED),
  };
};

// ======================================================
// المالية — جانب الأستاذ (§27 و§29 و§31)
//
// منفصلةٌ تماماً عن جانب الطالب — §52.5. الدالّتان لا تتقاطعان،
// وأيُّ مجموعٍ يضمّ الجانبين معاً خطأٌ في التعريف لا في الحساب.
// ======================================================

/**
 * مستحقُّ الأستاذ وما دُفع منه.
 *
 * الاستحقاقُ من مصدرين لا مصدرٍ واحد:
 *   1. `settlement.teacherAmount` — تخليصُ فتراتٍ درّسها
 *   2. `teacherDebtShare.shareAmount` — حصّتُه من دَينٍ قديم
 *      حُصِّل بعد فترته (§26 و§52.8)
 *
 * وإغفالُ الثاني يُنقص مستحقَّ كلِّ أستاذٍ درّس فترةً لم تُحصَّل
 * ديونُها إلا لاحقاً — وهو الحال الغالب في المؤسسات التعليمية.
 *
 * والمدفوعُ من `TeacherPaymentAllocation` لا من `TeacherPayment`
 * مباشرةً: الدفعةُ الواحدة تُوزَّع على تخليصٍ وحصصِ دَين (§32)،
 * والمجموعُ الخام لا يقول أين ذهب كلُّ دينار.
 */
export const teacherFinancials = (input: {
  /** مجموع `teacherAmount` للتخليصات غير الملغاة */
  settlementEntitlement: MoneyInput;
  /** مجموع `shareAmount` لحصص الدَّين غير الملغاة */
  debtShareEntitlement?: MoneyInput;
  /** مجموع `allocation.amount` عبر دفعاتٍ نشطة */
  allocatedPaid: MoneyInput;
}) => {
  const entitlement = sum([
    input.settlementEntitlement,
    input.debtShareEntitlement ?? 0,
  ]);
  const paid = toDecimal(input.allocatedPaid);

  return {
    entitlement: toNumber(entitlement),
    fromSettlements: toNumber(input.settlementEntitlement),
    fromDebtShares: toNumber(input.debtShareEntitlement ?? 0),
    paid: toNumber(paid),
    /** §66: المستحقُّ النشط − المدفوعُ المخصَّص النشط */
    outstanding: toNumber(subtract(entitlement, paid)),
    paidRate: rate(paid, entitlement),
  };
};

/**
 * دفعةٌ غير مخصَّصة — مؤشّرُ جودةِ بيانات (§39).
 *
 * مجموعُ الدفعة يجب أن يساوي مجموعَ تخصيصاتها. والفرقُ يعني
 * ديناراً دُفع للأستاذ ولا يُعرف مقابلَ أيِّ استحقاق — وهو بالضبط
 * ما تمنعه §32.
 */
export const allocationGap = (input: {
  paymentAmount: MoneyInput;
  allocatedAmount: MoneyInput;
}) => {
  const gap = subtract(input.paymentAmount, input.allocatedAmount);

  return {
    paid: toNumber(input.paymentAmount),
    allocated: toNumber(input.allocatedAmount),
    unallocated: toNumber(gap),
    isBalanced: toDecimal(gap).isZero(),
  };
};

// ======================================================
// التدفّق النقدي — §33
// ======================================================

/**
 * حركةُ النقد لا «الربح».
 *
 * §33 صريحٌ في هذا ولوجهٍ سليم: النظام لا يعرف الإيجارَ ولا
 * الكهرباءَ ولا الرواتبَ الإدارية. فتسميةُ الفرق «ربحاً» تُنتج
 * رقماً تتّخذ الإدارةُ عليه قراراً وهو يتجاهل نصفَ المصاريف.
 *
 * `netMovement` = ما دخل − ما خرج. لا أكثر، والاسمُ يقول ذلك.
 */
export const cashFlow = (input: {
  /** دفعات الطلبة النشطة في الفترة */
  studentPayments: MoneyInput;
  /** تحصيلُ الديون القديمة — جزءٌ من الوارد، ويُعرض مستقلّاً */
  debtCollections?: MoneyInput;
  /** دفعات الأساتذة النشطة في الفترة */
  teacherPayments: MoneyInput;
}) => {
  /*
   * `debtCollections` **ليست** إضافةً على `studentPayments`.
   *
   * تحصيلُ الدَّين واقعةٌ مشتقّة من دفعةٍ موجودة سلفاً في
   * `studentPayments`، فجمعُهما يحتسب الدينارَ مرّتين. تُعرض هنا
   * للتفصيل وحده: «من أصل ما دخل، هذا القدر كان ديوناً قديمة».
   */
  const moneyIn = toDecimal(input.studentPayments);
  const moneyOut = toDecimal(input.teacherPayments);

  return {
    moneyIn: toNumber(moneyIn),
    moneyOut: toNumber(moneyOut),
    ofWhichDebtCollection: toNumber(input.debtCollections ?? 0),
    netMovement: toNumber(moneyIn.minus(moneyOut)),
    /** نسبةُ ما خرج للأساتذة من الوارد */
    teacherCostRatio: rate(moneyOut, moneyIn),
  };
};

// ======================================================
// أدوات
// ======================================================

/**
 * تحويلُ نتيجة `groupBy` على الحالة إلى عدّادٍ كامل.
 *
 * Prisma لا تُرجع صفّاً للحالة التي لا يطابقها سجلّ، فالفوجُ الذي
 * لا غياب فيه يعود بلا مفتاح `ABSENT` — والقراءةُ المباشرة تُنتج
 * `undefined` يتسرّب إلى الجمع فيصير `NaN`.
 */
export const countsFromGroupBy = (
  rows: { status: AttendanceStatus; _count: number }[],
): AttendanceCounts => {
  const counts = emptyAttendanceCounts();

  for (const row of rows) counts[row.status] = row._count;

  return counts;
};

/** جمعُ عدّادات حضورٍ من عدّة مصادر */
export const mergeAttendanceCounts = (
  parts: AttendanceCounts[],
): AttendanceCounts =>
  parts.reduce<AttendanceCounts>((total, part) => {
    total.PRESENT += part.PRESENT;
    total.ABSENT += part.ABSENT;
    total.LATE += part.LATE;
    total.EXCUSED += part.EXCUSED;
    return total;
  }, emptyAttendanceCounts());

export type { Prisma };
