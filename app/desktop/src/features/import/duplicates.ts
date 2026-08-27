import { normalizeArabic } from "../../lib/search";
import type { SheetKind } from "./columns";
import type { ParsedRow } from "./read-workbook";

/**
 * **كشفُ التكرار — ترجيحٌ يُعرض، لا حكمٌ يُنفَّذ.**
 *
 * لا قيدَ تفرّدٍ على الطالب في القاعدة، فاستيرادُ الملفّ مرّتين
 * يُنشئ نسختين بأرقامٍ مختلفة ولا يمنعه شيء. وهذه الوحدة تسدّ ذلك
 * قدرَ ما يمكن سدُّه.
 *
 * **وقدرُ ما يمكن ليس كلَّ شيء**، ويجب أن يُقال: لا مفتاحَ طبيعياً
 * يميّز الطالب في هذا المخطّط. فأخوان بهاتف وليٍّ واحد واسمين
 * متقاربين قد يُعلَّمان تكراراً وهما اثنان، ومكرَّرٌ كُتب هاتفُه بخطأ
 * خانةٍ قد يمرّ نسختين. ولذلك **تُعرض المشتبَهات ويقرّر المستخدم** —
 * ولا يُسقَط سطرٌ من نفسه.
 *
 * والأستاذ أهون: `email` فريدٌ في القاعدة، فالمطابقةُ به يقينٌ لا
 * ترجيح — والقاعدةُ نفسُها تردّ ما فات.
 */

export interface Identity {
  /** المفتاح الذي تُبنى عليه المطابقة — فارغُه يعني «لا يُطابَق» */
  readonly key: string;
  /** ما يُعرض للمستخدم ليعرف عمّن نتكلّم */
  readonly label: string;
}

const digits = (value: unknown): string =>
  typeof value === "string" || typeof value === "number"
    ? String(value).replace(/\D/g, "")
    : "";

const text = (value: unknown): string =>
  typeof value === "string" ? normalizeArabic(value) : "";

/**
 * هويّةُ صفٍّ من قيمه — للملفّ وللقاعدة معاً.
 *
 * وتُشتقّ من نفس الحقول في الحالتين، وإلّا لم يتطابق ما في الملفّ مع
 * ما في القاعدة أصلاً.
 */
export const identityOf = (
  values: Record<string, unknown>,
  kind: SheetKind,
): Identity => {
  const name = `${text(values.lastName)} ${text(values.firstName)}`.trim();
  const label = `${values.lastName ?? ""} ${values.firstName ?? ""}`.trim();

  if (kind === "teachers") {
    const email = text(values.email);

    /* البريد يقين، والاسمُ وحده ترجيحٌ لا يُبنى عليه منعٌ صامت */
    return { key: email ? `email:${email}` : name ? `name:${name}` : "", label };
  }

  const phone = digits(values.parentPhone);

  return {
    key: name && phone ? `${name}|${phone}` : "",
    label: label + (values.parentPhone ? ` · ${values.parentPhone}` : ""),
  };
};

export type DuplicateSource = "file" | "existing";

export interface Duplicate {
  readonly rowNumber: number;
  readonly source: DuplicateSource;
  /** السطرُ الأوّل الذي يطابقه، أو وصفُ السجلّ القائم */
  readonly against: string;
}

/**
 * يُعيد المشتبَه بتكرارها مفهرسةً برقم السطر.
 *
 * والسطرُ الأوّل من كلّ مجموعةٍ **لا يُعلَّم**: هو الأصل، وما بعده
 * تكرارُه. فمن استورد ملفّاً فيه الطالب مرّتين دخل مرّةً واحدة.
 */
export const findDuplicates = (
  rows: readonly ParsedRow[],
  kind: SheetKind,
  existing: readonly Identity[] = [],
): Map<number, Duplicate> => {
  const found = new Map<number, Duplicate>();

  const inDatabase = new Map<string, string>();
  for (const record of existing) {
    if (record.key) inDatabase.set(record.key, record.label);
  }

  const seen = new Map<string, number>();

  for (const row of rows) {
    const { key } = identityOf(row.values, kind);

    if (!key) continue;

    const earlier = seen.get(key);

    if (earlier !== undefined) {
      found.set(row.rowNumber, {
        rowNumber: row.rowNumber,
        source: "file",
        against: `السطر ${earlier}`,
      });
      continue;
    }

    seen.set(key, row.rowNumber);

    const match = inDatabase.get(key);

    if (match !== undefined) {
      found.set(row.rowNumber, {
        rowNumber: row.rowNumber,
        source: "existing",
        against: match || "سجلٌّ قائم",
      });
    }
  }

  return found;
};
