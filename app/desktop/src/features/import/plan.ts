import type { SheetKind } from "./columns";
import { findDuplicates, identityOf, type Duplicate, type Identity } from "./duplicates";
import { resolveLevel, type LevelRef } from "./resolve-level";
import type { ParsedSheet } from "./read-workbook";

/**
 * **قرارُ كلّ سطرٍ قبل أن يُرسل شيء — دالّةٌ خالصة.**
 *
 * هذه هي المرحلة التي تجعل الاستيراد قابلاً للمراجعة: يرى المستخدمُ
 * أربعمئة سطرٍ مصنَّفةً — ما يدخل، وما يُردّ ولِمَ، وما يُشتبه بتكراره —
 * ثمّ يقرّر. والاستيرادُ الذي يبدأ بالكتابة ويقف في السطر مئتين يترك
 * القاعدةَ في حالٍ لا يعرفه أحد.
 *
 * وخالصةٌ عمداً: لا شبكةَ فيها ولا وقت، فتُختبر بالكامل.
 */

export type RowStatus = "ready" | "blocked" | "duplicate";

export interface PlannedRow {
  readonly rowNumber: number;
  /** ما يُعرض في الجدول ليعرف المستخدمُ عمّن نتكلّم */
  readonly label: string;
  readonly status: RowStatus;
  /** ما يُرسل إلى الخادم — للجاهز وحده */
  readonly payload?: Readonly<Record<string, unknown>>;
  readonly problems: readonly string[];
  readonly warnings: readonly string[];
  readonly duplicate?: Duplicate;
}

export interface ImportPlan {
  readonly kind: SheetKind;
  readonly rows: readonly PlannedRow[];
  readonly counts: {
    readonly total: number;
    readonly ready: number;
    readonly blocked: number;
    readonly duplicate: number;
    readonly warned: number;
  };
  /** عناوينُ في الملفّ تُتجاهَل — تُعرض مرّةً لا مع كلّ سطر */
  readonly unknownHeaders: readonly string[];
}

/** حقولٌ داخلية لا تُرسل — الطور والمستوى يصيران `levelId` */
const INTERNAL = new Set(["__stage", "__level"]);

/**
 * الفارغُ يُحذف ولا يُرسل `null`.
 *
 * `registrationDate` في الخادم `.optional()` لا `.nullish()`، فإرسالُ
 * `null` فيها يُردّ. وحذفُ الفارغ يجعل الخادمَ يطبّق افتراضَه —
 * وهو المقصود من ترك الخانة فارغة.
 */
const compact = (
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(values)) {
    if (INTERNAL.has(key)) continue;
    if (value === null || value === "") continue;

    out[key] = value;
  }

  return out;
};

export const buildPlan = (
  sheet: ParsedSheet,
  levels: readonly LevelRef[],
  existing: readonly Identity[],
): ImportPlan => {
  const duplicates = findDuplicates(sheet.rows, sheet.kind, existing);

  const rows: PlannedRow[] = sheet.rows.map((row) => {
    const problems = row.errors.map((e) => `${e.column}: ${e.message}`);
    const warnings = row.warnings.map((w) => `${w.column}: ${w.message}`);

    const payload = compact({ ...row.values });

    /* المستوى يُحلّ للطلبة وحدهم، وفشلُه يمنع السطر */
    if (sheet.kind === "students") {
      const level = resolveLevel(row.values.__stage, row.values.__level, levels);

      if (level.ok) {
        if (level.levelId) payload.levelId = level.levelId;
      } else {
        problems.push(`المستوى: ${level.error}`);
      }
    }

    const { label } = identityOf(row.values, sheet.kind);
    const duplicate = duplicates.get(row.rowNumber);

    /*
     * الخطأُ يسبق التكرار في الترتيب: سطرٌ ناقصُ الاسم لا يُقال عنه
     * «مكرَّر» — لم يُعرف بعدُ من هو.
     */
    if (problems.length) {
      return {
        rowNumber: row.rowNumber,
        label: label || `السطر ${row.rowNumber}`,
        status: "blocked",
        problems,
        warnings,
      };
    }

    if (duplicate) {
      return {
        rowNumber: row.rowNumber,
        label,
        status: "duplicate",
        payload,
        problems,
        warnings,
        duplicate,
      };
    }

    return {
      rowNumber: row.rowNumber,
      label,
      status: "ready",
      payload,
      problems,
      warnings,
    };
  });

  return {
    kind: sheet.kind,
    rows,
    unknownHeaders: sheet.unknownHeaders,
    counts: {
      total: rows.length,
      ready: rows.filter((r) => r.status === "ready").length,
      blocked: rows.filter((r) => r.status === "blocked").length,
      duplicate: rows.filter((r) => r.status === "duplicate").length,
      warned: rows.filter((r) => r.warnings.length > 0).length,
    },
  };
};
