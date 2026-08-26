/**
 * **السببُ الحقيقي خلف «Internal Server Error».**
 *
 * معالجُ الأخطاء في الخادم (`core/middleware/error-handler`) يردّ على
 * الخطأ غير المتوقَّع بثلاثة حقول:
 *
 *   { message: "Internal Server Error", errorCode: ..., error: "<السبب>" }
 *
 * و`message` غلافٌ ثابت، و`error` هو رسالةُ الاستثناء الفعلية. لكنّ
 * كلَّ نافذةٍ في التطبيق تقرأ `data.message` وحدها — سبعةٌ وستون
 * موضعاً — فيرى المستخدمُ الغلافَ ويُرمى الجواب.
 *
 * ولذلك يُعالَج هنا **مرّةً واحدة في معترض الاستجابة** لا في كلّ
 * نافذة: الإصلاحُ في سبعةٍ وستين موضعاً يترك مواضعَ تُنسى اليوم
 * ومواضعَ تُكتب غداً، والمعترضُ يمرّ به كلُّ ردٍّ بلا استثناء.
 */

export interface ApiErrorBody {
  message?: string;
  errorCode?: string;
  error?: string;
  errors?: { message?: string }[];
}

/**
 * الرسائلُ التي لا تقول شيئاً — وهي وحدها ما يُستبدل.
 *
 * أمّا رسالةُ 4xx فمكتوبةٌ لتُقرأ («المستوى غير موجود»، «حجم الملف
 * يتجاوز 3 ميغابايت»)، وإبدالُها بنصٍّ تقنيٍّ خسارةٌ لا ربح.
 */
const GENERIC = new Set([
  "internal server error",
  "unknown error occurred",
  "",
]);

const MAX = 300;
const HEAD = 120;
const TAIL = 160;

/**
 * تقصيرٌ يحفظ **الطرفين**.
 *
 * رسالةُ Prisma تبدأ بالعملية (`Invalid prisma.student.create()
 * invocation:`) وتنتهي بالسبب (`Unknown column 'birthPlace'`)، وبينهما
 * قد تُطبع الوسائطُ كلُّها بآلاف المحارف. فقصُّ الذيل يُبقي السؤالَ
 * ويحذف الجواب، وقصُّ الرأس يعكسه — والحاجةُ إليهما معاً.
 */
const condense = (raw: string): string => {
  const line = raw.replace(/\s+/g, " ").trim();

  if (line.length <= MAX) return line;

  return `${line.slice(0, HEAD)} … ${line.slice(-TAIL)}`;
};

/**
 * الرسالةُ التي ينبغي عرضُها — أو `undefined` إن لم يكن ثمّة ما يُضاف.
 *
 * تُعيد `undefined` عمداً بدل النصّ الأصلي: المتّصلُ بها يستبدل عندئذٍ
 * أو يترك، فلا تُكتب قيمةٌ فوق قيمةٍ مطابقة.
 */
export const resolveErrorMessage = (
  body: ApiErrorBody | undefined,
): string | undefined => {
  const cause = typeof body?.error === "string" ? body.error.trim() : "";

  if (!cause) return undefined;

  const shown = (body?.message ?? "").trim().toLowerCase();

  if (!GENERIC.has(shown)) return undefined;

  return condense(cause);
};

/**
 * يكتب السببَ في مكان الغلاف داخل جسم الرد.
 *
 * تعديلٌ في الموضع (mutation) عن قصد: النوافذ تمسك بـ`error.response`
 * الذي رماه axios، ونسخةٌ جديدة لا تبلغها.
 */
export const revealServerCause = (body: unknown): void => {
  if (!body || typeof body !== "object") return;

  const resolved = resolveErrorMessage(body as ApiErrorBody);

  if (resolved) (body as ApiErrorBody).message = resolved;
};
