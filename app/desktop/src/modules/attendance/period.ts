/**
 * حساب فترة الكشف — دوالّ خالصة بلا تبعيات.
 *
 * فُصلت عن طبقة الـAPI لسببين: أنّها لا تعرف شبكةً ولا خادماً، وأنّ
 * فصلها يجعلها قابلة للاختبار وحدها. وهي أدقّ ما في هذه الشاشة منطقاً:
 * الكشف **فترةُ اشتراك لا شهرٌ تقويمي** — الورقة الأصلية عنوانها
 * «الشهر: 6» وتواريخها تمتدّ من 13/02 إلى 04/04.
 */

export const MONTHS = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const pad = (n: number) => String(n).padStart(2, "0");

/** 2026-09-03 → 03/09/2026 (كما في الورقة) */
export const sheetDate = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

/**
 * 2026-09-03 → 03/09/26 — للخانة الضيّقة.
 *
 * ورقةٌ فيها اثنتا عشرة حصةً تُبقي لكلِّ تاريخٍ تسعةَ مليمترات، ولا يسعها
 * «03/09/2026» بخطٍّ يُقرأ. والقرنُ وحده ما يُطرح: السنة الدراسية مكتوبةٌ
 * في ترويسة الورقة كاملةً فوقه.
 */
export const sheetDateShort = (iso: string) => {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCFullYear() % 100)}`;
};

/** 2026-09-03T00:00:00Z → 2026-09-03 — لحقول من نوع date */
export const isoDate = (iso: string) => new Date(iso).toISOString().slice(0, 10);

/** أول وآخر يوم في الشهر بصيغة YYYY-MM-DD */
export const monthRange = (year: number, month: number) => ({
  dateFrom: `${year}-${pad(month)}-01`,
  dateTo: `${year}-${pad(month)}-${pad(new Date(Date.UTC(year, month, 0)).getUTCDate())}`,
});

/** آخر يوم في الشهر (1-based) مع تطبيع تجاوز السنة */
const endOfMonth = (year: number, month: number) => {
  const d = new Date(Date.UTC(year, month, 0));
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
};

/**
 * نافذة قراءة الكشف — سنةٌ كاملة من مطلع الشهر المختار.
 *
 * كانت تقف عند الشهر التالي، فكانت الفترة الممتدّة محصورةً في شهرين.
 * والفترة لا تعرف هذا الحدّ: حصصُها قد تتفرّق على مارس وأفريل وماي
 * وديسمبر إن تباعدت تواريخها، وحصةٌ خارج النافذة تُقبل ولا تُرى — وهو
 * أسوأ من رفضها.
 *
 * والاتّساع لا يُغرق الكشف: `sheetColumns` هي التي تحكم، فتقتطع الفائض
 * عند العدد المقرَّر ولا تعرض إلّا ما يُكمل الفترة.
 */
export const sheetWindow = (year: number, month: number, monthsAhead = 11) => ({
  dateFrom: `${year}-${pad(month)}-01`,
  dateTo: endOfMonth(year, month + monthsAhead),
});

/**
 * مدى الأعمدة المعروضة — أضيقُ نطاقٍ يكفي لجلب حضورها.
 *
 * نافذة القراءة سنةٌ كاملة، وجلبُ حضور سنةٍ لعرض ثماني حصص إسرافٌ
 * بمئات الصفوف. فالحضور يُقرأ على مدى ما استقرّ عرضه لا على مدى البحث.
 */
export const columnsRange = (columns: { sessionDate: string }[]) => {
  if (columns.length === 0) return null;

  const sorted = [...columns].map((c) => isoDate(c.sessionDate)).sort();

  return { dateFrom: sorted[0]!, dateTo: sorted[sorted.length - 1]! };
};

/** هل يقع التاريخ داخل الشهر المختار؟ */
export const inMonth = (iso: string, year: number, month: number) => {
  const d = new Date(iso);
  return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month;
};

/**
 * أعمدة الكشف من حصص النافذة.
 *
 * ثلاث قواعد، كلٌّ منها تمنع خطأً بعينه:
 *
 * 1. **الفترة تبدأ في الشهر المختار.** فإن خلا الشهر منها فلا فترة
 *    فيه، ويُعرض فارغاً. وبغير هذه القاعدة كان اختيارُ أوتٍ خالٍ يعرض
 *    فترةَ سبتمبر كاملةً معنونةً «سبتمبر» — كشفٌ لم يطلبه أحد.
 *
 * 2. **حصصُ الشهر لا تُقتطع أبداً** ولو تجاوزت العدد المقرَّر: الاقتطاع
 *    إخفاءُ بيانات، والزيادة تُرى فتُصحَّح.
 *
 * 3. **الفائض من الشهر التالي يدخل** بقدر ما يُكمل العدد المقرَّر —
 *    فتُلتقط ذيولُ الفترة ولا تتسرّب فترةُ الشهر التالي كاملة.
 */
export const sheetColumns = <T extends { sessionDate: string }>(
  rows: T[],
  year: number,
  month: number,
  cap: number,
): T[] => {
  const own = rows.filter((r) => inMonth(r.sessionDate, year, month));

  if (own.length === 0) return [];

  const spill = rows.filter((r) => !inMonth(r.sessionDate, year, month));

  return [...own, ...spill.slice(0, Math.max(0, cap - own.length))];
};

/**
 * عنوان الفترة من تواريخها — «أوت + سبتمبر 2026».
 *
 * الشهر وحده يكذب حين تمتدّ الفترة إلى ما بعده: من يقرأ «أوت» ويرى
 * تاريخاً في سبتمبر يظنّ الكشف مخطئاً. فالعنوان يُشتقّ من الأعمدة لا
 * من المحدِّد، والسنة تُذكر لكل شهر إن اختلفت السنوات.
 */
export const periodLabel = (
  dates: string[],
  fallbackYear: number,
  fallbackMonth: number,
): string => {
  if (dates.length === 0) return `${MONTHS[fallbackMonth - 1]} ${fallbackYear}`;

  const seen: { year: number; month: number }[] = [];

  for (const iso of [...dates].sort()) {
    const d = new Date(iso);
    const year = d.getUTCFullYear();
    const month = d.getUTCMonth() + 1;

    if (!seen.some((s) => s.year === year && s.month === month)) {
      seen.push({ year, month });
    }
  }

  const sameYear = seen.every((s) => s.year === seen[0]!.year);

  return sameYear
    ? `${seen.map((s) => MONTHS[s.month - 1]).join(" + ")} ${seen[0]!.year}`
    : seen.map((s) => `${MONTHS[s.month - 1]} ${s.year}`).join(" + ");
};
