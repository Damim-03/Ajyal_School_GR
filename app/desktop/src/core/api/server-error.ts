/**
 * **السببُ التقنيّ — إلى السجلّ لا إلى الشاشة.**
 *
 * معالجُ الأخطاء في الخادم يردّ على الخطأ غير المتوقَّع بثلاثة حقول:
 *
 *   { message: "Internal Server Error", errorCode: ..., error: "<السبب>" }
 *
 * و`error` رسالةُ الاستثناء الفعلية — نصٌّ إنجليزيٌّ فيه أسماءُ
 * جداولَ وأعمدة. وهو لا يُعرض للمستخدم (انظر [[humanize]]): مَن جاء
 * يسجّل طالباً لا يُفيده اسمُ عمود.
 *
 * لكنّه لا يُرمى أيضاً — يُكتب في سجلّ المتصفّح ويبقى في جسم الرد،
 * فيجده المطوّر حين يشخّص بلا أن يراه الموظّف.
 */

export interface ApiErrorBody {
  message?: string;
  errorCode?: string;
  error?: string;
  errors?: { field?: string; message?: string }[];
}

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
 * السببُ التقنيّ مطويّاً في سطر — أو `undefined` إن لم يُرفق.
 */
export const technicalCause = (
  body: ApiErrorBody | undefined,
): string | undefined => {
  const cause = typeof body?.error === "string" ? body.error.trim() : "";

  return cause ? condense(cause) : undefined;
};
