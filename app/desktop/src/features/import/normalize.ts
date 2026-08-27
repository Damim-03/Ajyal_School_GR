import { parseMoney } from "../../core/utils/money";
import { normalizeArabic } from "../../lib/search";
import type { ColumnSpec, FieldKind } from "./columns";

/**
 * **من خانةٍ في Excel إلى قيمةٍ يقبلها الخادم.**
 *
 * والخانةُ ليست نصّاً: exceljs يُعيد `Date` لخانة التاريخ، و`number`
 * لما صُيّغ رقماً، وكائناً ذا `richText` لما نُسخ من Word، وكائناً ذا
 * `result` للصيغ. فتُسوّى كلُّها هنا قبل أيّ تحقّق.
 *
 * والتحذيرُ صنفٌ ثالث بين القبول والرفض، وله هنا معنى واحد بعينه:
 * **قيمةٌ صحيحةُ الشكل يُرجَّح أنّها فقدت شيئاً في Excel نفسِه** —
 * وأشهرُها الصفرُ البادئ في الهاتف. الخادمُ يقبلها ولا يشتكي، ولا
 * يظهر الخطأ إلّا يوم يُتّصل بوليٍّ فلا يُردّ.
 */

export interface CellResult {
  /** القيمة كما تُرسل — أو `null` للخانة الفارغة */
  readonly value: string | number | boolean | null;
  /** يمنع السطرَ من الدخول */
  readonly error?: string;
  /** يدخل السطر ويُعرض التنبيه */
  readonly warning?: string;
}

const ARABIC_DIGITS = /[٠-٩۰-۹]/g;

const toLatinDigits = (text: string): string =>
  text.replace(ARABIC_DIGITS, (d) =>
    String(
      d.charCodeAt(0) >= 0x06f0
        ? d.charCodeAt(0) - 0x06f0
        : d.charCodeAt(0) - 0x0660,
    ),
  );

/**
 * تسويةُ ما يعطيه exceljs إلى نصٍّ أو رقمٍ أو تاريخ.
 *
 * `richText` يجيء ممّا نُسخ من Word أو من صفحة ويب، و`result` من
 * خانةٍ فيها صيغة — وقيمتُها المحسوبة هي المقصودة لا الصيغة نفسها.
 */
export const flattenCell = (raw: unknown): string | number | Date | null => {
  if (raw === null || raw === undefined) return null;
  if (raw instanceof Date) return raw;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "boolean") return raw ? "نعم" : "لا";
  if (typeof raw === "string") return raw;

  if (typeof raw === "object") {
    const cell = raw as {
      richText?: { text?: string }[];
      result?: unknown;
      text?: string;
      hyperlink?: string;
    };

    if (Array.isArray(cell.richText)) {
      return cell.richText.map((part) => part.text ?? "").join("");
    }
    if (cell.result !== undefined) return flattenCell(cell.result);
    if (typeof cell.text === "string") return cell.text;
  }

  return null;
};

// --------------------------------------------------
// المفردات — ما يكتبه الناس فعلاً
// --------------------------------------------------

const MALE = ["ذكر", "ذكور", "male", "m", "م", "ولد"];
const FEMALE = ["انثي", "اناث", "female", "f", "بنت"];

const YES = ["نعم", "صح", "yes", "y", "true", "1", "✓", "مدفوعة", "مدفوع"];
const NO = ["لا", "خطا", "no", "n", "false", "0", "غير مدفوعة", "لم يدفع"];

const has = (list: readonly string[], value: string) =>
  list.some((item) => normalizeArabic(item) === value);

// --------------------------------------------------
// التاريخ
// --------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * التاريخُ يُقرأ بأجزائه بتوقيت UTC.
 *
 * exceljs يبني تاريخَ الخانة عند منتصف ليل UTC. وقراءتُه بالتوقيت
 * المحلّي في الجزائر (‏UTC+1) تُعطي اليومَ نفسه، لكنّها في أيّ منطقةٍ
 * غربَ غرينتش تُنقص يوماً — فيصير مولودُ الأوّل من الشهر مولودَ آخرِ
 * الذي قبله، صامتاً.
 */
const fromDate = (date: Date): string =>
  `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;

/** نصُّ تاريخٍ بصيغةٍ مفهومة — أو `null` */
const parseDateText = (text: string): string | null => {
  const value = toLatinDigits(text).trim();

  const iso = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) {
    return `${iso[1]}-${pad(Number(iso[2]))}-${pad(Number(iso[3]))}`;
  }

  /*
   * `DD/MM/YYYY` تُقبل لأنّها ما يكتبه الناس هنا — واليومُ أوّلاً لا
   * الشهر. ولا تُقبل صيغةٌ ملتبسة بينهما: ما زاد يومُه على 12 يُقرأ
   * يقيناً، وما دونه لا يُميَّز، فيُقرأ على العُرف المحلّي ويُنبَّه.
   */
  const dmy = value.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    if (Number(m) >= 1 && Number(m) <= 12 && Number(d) >= 1 && Number(d) <= 31) {
      return `${y}-${pad(Number(m))}-${pad(Number(d))}`;
    }
  }

  return null;
};

const isRealDate = (iso: string): boolean => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));

  return (
    date.getUTCFullYear() === y &&
    date.getUTCMonth() === m - 1 &&
    date.getUTCDate() === d
  );
};

// --------------------------------------------------
// المسوّي
// --------------------------------------------------

const EMPTY: CellResult = { value: null };

const normalizeField = (
  raw: string | number | Date,
  field: FieldKind,
): CellResult => {
  // ---------- التاريخ ----------
  if (field.kind === "date") {
    if (typeof raw === "number") {
      return {
        value: null,
        error: "التاريخ خانةٌ رقمية — صيّغ العمود تاريخاً أو نصّاً بصيغة YYYY-MM-DD",
      };
    }

    const iso = raw instanceof Date ? fromDate(raw) : parseDateText(raw);

    if (!iso || !isRealDate(iso)) {
      return { value: null, error: "تاريخٌ غير مفهوم — اكتبه YYYY-MM-DD" };
    }

    if (field.past) {
      const today = new Date();
      const todayIso = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

      if (iso > todayIso) {
        return { value: null, error: "التاريخ في المستقبل" };
      }
    }

    return { value: iso };
  }

  // ---------- الهاتف ----------
  if (field.kind === "phone") {
    /*
     * الرقمُ في خانةٍ رقمية فقد صفرَه البادئ **في الملفّ نفسِه** — لا
     * سبيل إلى استرجاعه من هنا. فيُقبل ويُنبَّه، لأنّ ردَّ السطر لا
     * يُصلح شيئاً والصمتَ عنه أسوأ.
     */
    if (typeof raw === "number") {
      const digits = String(raw);

      return {
        value: digits,
        warning:
          digits.length === 9
            ? "الرقم أُدخل عدداً وطولُه تسع خانات — يُرجَّح أنّه فقد صفره البادئ"
            : "الرقم أُدخل عدداً — صيّغ عمود الهاتف نصّاً للتأكّد",
      };
    }

    const text = toLatinDigits(String(raw)).trim();

    if (!/^[0-9+\s-]+$/.test(text)) {
      return { value: null, error: "الهاتف يقبل أرقاماً و + و - ومسافات فقط" };
    }
    if (text.length < 8) return { value: null, error: "الهاتف أقصرُ من ثماني خانات" };
    if (text.length > 20) return { value: null, error: "الهاتف يتجاوز عشرين خانة" };

    return { value: text };
  }

  // ---------- الجنس ----------
  if (field.kind === "gender") {
    const key = normalizeArabic(String(raw));

    if (has(MALE, key)) return { value: "MALE" };
    if (has(FEMALE, key)) return { value: "FEMALE" };

    return { value: null, error: "الجنس يُكتب «ذكر» أو «أنثى»" };
  }

  // ---------- نعم/لا ----------
  if (field.kind === "bool") {
    const key = normalizeArabic(String(raw));

    if (has(YES, key)) return { value: true };
    if (has(NO, key)) return { value: false };

    return { value: null, error: "تُكتب «نعم» أو «لا»" };
  }

  // ---------- رقم ----------
  if (field.kind === "number") {
    const amount =
      typeof raw === "number" ? raw : parseMoney(toLatinDigits(String(raw)));

    if (amount === null || !Number.isFinite(amount)) {
      return { value: null, error: "قيمةٌ ليست رقماً" };
    }
    if (field.exclusiveMin ? amount <= field.min : amount < field.min) {
      return {
        value: null,
        error: field.exclusiveMin
          ? "يجب أن يكون أكبر من صفر — أو اتركه فارغاً"
          : `لا يقلّ عن ${field.min}`,
      };
    }
    if (amount > field.max) {
      return { value: null, error: "المبلغ أكبر ممّا يُقبل" };
    }

    return { value: amount };
  }

  // ---------- بريد ----------
  if (field.kind === "email") {
    const text = String(raw).trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text)) {
      return { value: null, error: "بريدٌ غير صالح — أو اتركه فارغاً" };
    }

    return { value: text.toLowerCase() };
  }

  // ---------- نصّ وبحث ----------
  const text = String(raw).trim().replace(/\s+/g, " ");

  if (field.kind === "lookup") return { value: text };

  if (field.min !== undefined && text.length < field.min) {
    return { value: null, error: `لا يقلّ عن ${field.min} حرفين` };
  }
  if (text.length > field.max) {
    return { value: null, error: `يتجاوز ${field.max} حرفاً` };
  }

  return { value: text };
};

/**
 * تسويةُ خانةٍ واحدة بحسب عمودها.
 *
 * والفراغُ يُفصل عن الخطأ: الخانةُ الفارغة في عمودٍ إلزاميّ تُبلَّغ
 * «مطلوب»، وفي عمودٍ اختياريّ تمرّ بلا كلام.
 */
export const normalizeCell = (raw: unknown, column: ColumnSpec): CellResult => {
  const flat = flattenCell(raw);

  const empty =
    flat === null || (typeof flat === "string" && flat.trim() === "");

  if (empty) {
    return column.required
      ? { value: null, error: "مطلوب — الخانة فارغة" }
      : EMPTY;
  }

  return normalizeField(flat, column.field);
};
