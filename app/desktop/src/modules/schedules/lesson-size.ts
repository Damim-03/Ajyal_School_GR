/**
 * الحجم الساعي — حسابُه واستنتاجُه.
 *
 * وحدةٌ نقيّة بلا استيراد: لا axios ولا React ولا متجر. وهذا مقصود —
 * هنا قاعدةُ عملٍ تُقرأ وتُختبر وحدها، بينما النافذة التي تستعملها
 * لا تُفتح إلّا بجلسةٍ ومستخدمٍ وشاشة.
 */

/** "08:30" → 510 */
export const toMinutes = (time: string) => {
  const [h, m] = time.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
};

/** ما بين الطرفين بالدقائق — و`null` إن كان الوقتان بلا معنى */
export const slotMinutes = (start: string, end: string): number | null => {
  const span = toMinutes(end) - toMinutes(start);

  return span > 0 ? span : null;
};

/** جمع الساعات في العربية: ساعة · ساعتان · 3 ساعات · 11 ساعة */
const hoursLabel = (h: number) =>
  h === 1 ? "ساعة" : h === 2 ? "ساعتان" : h <= 10 ? `${h} ساعات` : `${h} ساعة`;

/** الكسور المألوفة تُسمّى، وما عداها يُكتب بالدقائق */
const FRACTION: Record<number, string> = {
  15: "وربع",
  30: "ونصف",
  45: "وثلاثة أرباع",
};

/**
 * 240 → «4 ساعات» · 90 → «ساعة ونصف» · 105 → «ساعة وثلاثة أرباع»
 * 45 → «45 دقيقة» · 100 → «ساعة و40 د»
 */
export const durationLabel = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;

  if (h === 0) return `${m} دقيقة`;
  if (m === 0) return hoursLabel(h);

  const fraction = FRACTION[m];

  return fraction ? `${hoursLabel(h)} ${fraction}` : `${hoursLabel(h)} و${m} د`;
};

/** "08:00" + "12:00" → «4 ساعات» — أو "" إن تعذّر الحساب */
export const slotDuration = (start: string, end: string) => {
  const span = slotMinutes(start, end);

  return span === null ? "" : durationLabel(span);
};

// --------------------------------------------------
// استنتاج الحجم
// --------------------------------------------------

/** مجالٌ زمني بفتراته — ما يحتاجه الحساب منه فقط */
export interface BandLike {
  key: string;
  startTime: string;
  endTime: string;
  slots: { teacherId: string | null }[];
}

/** موضعُ درسٍ في الجدول — إسنادُه ووقتُه */
export interface PlacementLike {
  assignmentId: string;
  startTime: string;
  endTime: string;
}

const bandMinutes = (band: BandLike) => slotMinutes(band.startTime, band.endTime);

/**
 * الحجم الساعي المتوقَّع لدرسٍ بعينه — أو `null` إن لم يُعرف.
 *
 * لا حقلَ للحجم في قاعدة البيانات، وهو موجودٌ فعلاً في البنية
 * الدراسية: الفترة تُعرَّف ببدايةٍ ونهاية، والفرقُ بينهما هو الحجم.
 * فيُقرأ من دليلين مرتَّبين:
 *
 *   1. **مواضع هذا الدرس نفسِه في الجدول** — أخصُّهما: إن كانت
 *      الإنجليزيةُ لهذا الفوج مبرمجةً ساعتين يوم الاثنين فحجمُها
 *      ساعتان يوم الجمعة.
 *   2. **فترات الأستاذ** — فمن عرّف لنفسه 08:00–10:00 فحجمُ درسه
 *      ساعتان ولو لم يُبرمج بعد.
 *
 * والاختلافُ يُسكِت الحكم في الحالين: درسٌ بُرمج مرّةً ساعتين ومرّةً
 * ساعةً ونصف، أو أستاذٌ له فترتان بحجمين — لا يُعرف أيّهما القاعدة.
 * وتحذيرٌ في محلّ الشكّ أسوأ من الصمت: يُدرَّب المستخدم على تجاهله.
 */
export const expectedLessonMinutes = (
  lesson: { assignmentId: string; teacherId: string },
  placements: PlacementLike[],
  bands: BandLike[],
): number | null => {
  const placed = new Set<number>();

  for (const placement of placements) {
    if (placement.assignmentId !== lesson.assignmentId) continue;

    const span = slotMinutes(placement.startTime, placement.endTime);
    if (span) placed.add(span);
  }

  if (placed.size > 0) return placed.size === 1 ? [...placed][0] : null;

  const owned = new Set<number>();

  for (const band of bands) {
    if (!band.slots.some((slot) => slot.teacherId === lesson.teacherId)) continue;

    const span = bandMinutes(band);
    if (span) owned.add(span);
  }

  return owned.size === 1 ? [...owned][0] : null;
};

/**
 * الخانة لا تناسب حجم الدرس — والبديلُ معها.
 *
 * الخطأ سهل: الخانات متجاورةٌ وأوقاتُها متقاربة، فتُدرَج حصةُ ساعتين
 * في مجال ساعةٍ ونصف — وتُنشأ للأستاذ فترةٌ بحجمٍ لم يقصده، فيبدو
 * الجدول صحيحاً بينما التخليص والفوترة يُحسبان على غير الحقيقة.
 *
 * ويُرجَّح من المجالات الموافقة ما فيه فترةٌ لهذا الأستاذ: هو وقتُه
 * المعروف، لا مجالٌ يوافق الحجم صدفةً.
 */
export const sizeSuggestion = (
  lesson: { assignmentId: string; teacherId: string },
  currentBand: BandLike,
  bands: BandLike[],
  placements: PlacementLike[],
): { expected: number; current: number; to: BandLike } | null => {
  const expected = expectedLessonMinutes(lesson, placements, bands);
  const current = bandMinutes(currentBand);

  if (!expected || !current || expected === current) return null;

  const owned = bands.find(
    (band) =>
      bandMinutes(band) === expected &&
      band.slots.some((slot) => slot.teacherId === lesson.teacherId),
  );

  const to = owned ?? bands.find((band) => bandMinutes(band) === expected);

  return to ? { expected, current, to } : null;
};
