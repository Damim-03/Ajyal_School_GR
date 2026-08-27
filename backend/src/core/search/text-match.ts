import { prisma } from "../prisma/client";

/**
 * **مطابقةُ النصّ بترتيبٍ صريح — لا يقع معها تضاربُ ترتيب.**
 *
 * Prisma تترجم `contains` إلى `LIKE CONCAT('%', ?, '%')`، فيلتقي في
 * المقارنة عمودٌ ومعاملٌ يرسله السائق. وإن اختلف ترتيبُهما رفض
 * الخادمُ المقارنةَ كلَّها:
 *
 *     Illegal mix of collations
 *     (utf8mb4_unicode_ci,IMPLICIT) and (utf8mb4_bin,NONE)
 *
 * وقع ذلك على MariaDB 11.8 ولم يقع على 10.4، **فسقط كلُّ بحثٍ في
 * التطبيق** بينما جهاز التطوير لا يُظهر شيئاً. وجُرّب علاجُه بضبط
 * ترتيب الاتصال ثمّ ببروتوكول السائق، فلم يُحسم.
 *
 * وهذه الوحدة تُنهي المسألة بلا اعتمادٍ على سلوكِ سائقٍ ولا نسخةِ
 * خادم: `COLLATE` صريحٌ على طرف النمط درجتُه **`EXPLICIT` (صفر)**،
 * وهي تغلب `IMPLICIT` (2) و`NONE` (1). فأيّاً كان ترتيبُ المعامل
 * الوارد، الترتيبُ المستعمَل هو المكتوب هنا.
 *
 * و`CONVERT(? USING utf8mb4)` قبله يحمي من معاملٍ يصل بترميزٍ ثنائيّ:
 * ‏`COLLATE` على نصٍّ ثنائيٍّ خطأٌ في ذاته، والتحويلُ يسبقه.
 *
 * ومقيسٌ لا مفترض: ‏`COERCIBILITY` للطرف تُرجع صفراً.
 */

/** الترتيب المعتمَد في كلّ جداول المخطّط */
const COLLATION = "utf8mb4_unicode_ci";

/**
 * سقفُ المعرّفات المُرجَعة.
 *
 * البحثُ يُرجع معرّفاتٍ ثمّ تُمرَّر إلى استعلام Prisma الأصلي، فلا
 * يُحمَّل الصفُّ كلُّه. والسقفُ حارسٌ ضدّ استعلامٍ يطابق كلَّ شيء —
 * وهو أعلى بكثير من عدد طلبة مؤسسةٍ واحدة.
 */
const MAX_IDS = 5000;

/**
 * تهريبُ محارف `LIKE` الخاصّة.
 *
 * `%` و`_` معنىً في النمط لا حرفان. ومن كتب `100%` في خانة البحث
 * يقصد النصَّ لا «أيّ شيء»، وبلا تهريبٍ يُطابق كلَّ صفّ.
 *
 * و`keepUnderscore` للمطابقة المتساهلة وحدها: هي تضع `_` عمداً في
 * موضع الحروف التي تُكتب على أوجه.
 */
export const escapeLike = (term: string, keepUnderscore = false): string => {
  const escaped = term.replace(/[\\%]/g, (ch) => `\\${ch}`);

  return keepUnderscore ? escaped : escaped.replace(/_/g, "\\_");
};

export interface TextCondition {
  /** اسمُ العمود في الجدول */
  readonly column: string;
  /** نمطُ `LIKE` كاملاً — بما فيه `%` المقصودة */
  readonly pattern: string;
}

/* أسماءُ الجداول والأعمدة من شيفرتنا لا من المستخدم — والفحصُ تأمينٌ رخيص */
const SAFE_NAME = /^[A-Za-z][A-Za-z0-9_]*$/;

/**
 * معرّفاتُ الصفوف المطابقة — **OR داخل المجموعة، وAND بينها**.
 *
 * والمجموعاتُ ليست ترفاً: الاسمُ مخزَّنٌ في حقلين، والموظّف يكتبه
 * كاملاً. فـ«سعد الله تسنيم» ليس محتوًى في `lastName` وحده ولا في
 * `firstName` وحده — وكلُّ كلمةٍ منه في أحدهما. فتصير كلُّ كلمةٍ
 * مجموعةً تُطابق أيَّ حقل، ويجب أن تُطابق الكلماتُ كلُّها.
 *
 * وهو ما تفعله `lib/search.ts` في الواجهة منذ زمن — والخادم لم يكن
 * يفعله، فكان البحث بالاسم الكامل يُرجع لا شيء.
 *
 * وتُمرَّر النتيجةُ إلى `where: { id: { in: … } }` في استعلام Prisma
 * الأصلي، فتبقى المرشِّحاتُ والترقيمُ والأعمدةُ كما هي.
 */
export const matchTextIds = async (
  table: string,
  groups: readonly (readonly TextCondition[])[],
): Promise<string[]> => {
  if (!SAFE_NAME.test(table)) throw new Error(`اسم جدولٍ غير صالح: ${table}`);

  const active = groups.filter((group) => group.length > 0);

  if (active.length === 0) return [];

  for (const group of active) {
    for (const { column } of group) {
      if (!SAFE_NAME.test(column)) {
        throw new Error(`اسم عمودٍ غير صالح: ${column}`);
      }
    }
  }

  const where = active
    .map(
      (group) =>
        `(${group
          .map(
            ({ column }) =>
              `\`${column}\` LIKE CONVERT(? USING utf8mb4) COLLATE ${COLLATION}`,
          )
          .join(" OR ")})`,
    )
    .join(" AND ");

  const rows = await prisma.$queryRawUnsafe<{ id: string }[]>(
    `SELECT \`id\` FROM \`${table}\` WHERE ${where} LIMIT ${MAX_IDS}`,
    ...active.flatMap((group) => group.map((c) => c.pattern)),
  );

  return rows.map((row) => row.id);
};

/** كلماتُ الاستعلام — الفراغُ المتكرّر لا يُنتج كلمةً فارغة */
export const words = (term: string): string[] =>
  term.trim().split(/\s+/).filter(Boolean);

/** شروطُ «يحتوي» على عدّة أعمدة من نصٍّ واحد */
export const containsOn = (
  columns: readonly string[],
  term: string,
): TextCondition[] => {
  const pattern = `%${escapeLike(term)}%`;

  return columns.map((column) => ({ column, pattern }));
};
