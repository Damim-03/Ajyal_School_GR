import {
  COLUMNS,
  SHEET_NAMES,
  matchColumn,
  matchSheet,
  type ColumnSpec,
  type SheetKind,
} from "./columns";
import { normalizeCell } from "./normalize";

/**
 * **قراءةُ ملفٍّ واحد إلى صفوفٍ مسوّاة — بلا اتصالٍ بالخادم.**
 *
 * هذه المرحلةُ الأولى من مرحلتين: تُقرأ الورقةُ كلُّها وتُفحص خانةً
 * خانة، ولا يُكتب في القاعدة شيء. فيرى المستخدمُ حصيلةَ الملفّ قبل
 * أن يقرّر — لا سطراً سطراً بعد أن يبدأ.
 *
 * **وملفٌّ لنوعٍ واحد لا مصنَّفٌ يجمع الاثنين.** الطلبةُ يُستوردون من
 * شاشتهم والأساتذةُ من شاشتهم، ولكلٍّ ملفُّه. ومصنَّفٌ يحمل الورقتين
 * يجعل شاشةَ الطلبة تكتب أساتذةً — وهو ما لا يتوقّعه من ضغط الزرّ في
 * محور الطلبة. فإن جاء الملفُّ للنوع الآخر رُدَّ باسمه لا بغموض.
 *
 * و`exceljs` يُستورَد ديناميكياً: مكتبةٌ بحجم ميغابايت لا تُحمَّل مع
 * الإقلاع لأجل شاشةٍ تُفتح مرّةً في السنة.
 */

export interface CellProblem {
  /** عنوان العمود كما في الملفّ — لا اسمُه البرمجيّ */
  readonly column: string;
  readonly message: string;
}

export interface ParsedRow {
  /** رقمُ السطر في Excel كما يراه المستخدم — الترويسة هي 1 */
  readonly rowNumber: number;
  readonly values: Readonly<Record<string, string | number | boolean | null>>;
  readonly errors: readonly CellProblem[];
  readonly warnings: readonly CellProblem[];
}

export interface ParsedSheet {
  readonly kind: SheetKind;
  readonly rows: readonly ParsedRow[];
  /** عناوينُ في الملفّ لا يعرفها المستورِد — تُتجاهَل ويُخبَر بها */
  readonly unknownHeaders: readonly string[];
  /** أعمدةٌ إلزامية غائبةٌ عن الورقة كلِّها */
  readonly missingColumns: readonly string[];
}

export interface ReadResult {
  readonly sheet?: ParsedSheet;
  /** ما يمنع القراءة أصلاً */
  readonly fatal?: string;
}

/** أقصى ما يُقرأ — حارسٌ ضدّ ملفٍّ فيه مليون سطرٍ فارغ */
const MAX_ROWS = 5000;

const isBlankRow = (
  values: Record<string, string | number | boolean | null>,
): boolean => Object.values(values).every((v) => v === null || v === "");

const readSheet = (
  worksheet: {
    name: string;
    rowCount: number;
    getRow: (n: number) => { getCell: (n: number) => { value: unknown } };
  },
  kind: SheetKind,
): ParsedSheet => {
  const spec = COLUMNS[kind];

  // ---------- الترويسة ----------
  const header = worksheet.getRow(1);
  const mapped = new Map<number, ColumnSpec>();
  const unknownHeaders: string[] = [];

  /* يُمسح عرضٌ أوسع من عدد الأعمدة المعروفة — قد تتخلّلها فراغات */
  for (let c = 1; c <= spec.length + 12; c++) {
    const raw = header.getCell(c).value;
    const text = raw === null || raw === undefined ? "" : String(raw).trim();

    if (!text) continue;

    const column = matchColumn(text, spec);

    if (column) {
      /* عنوانٌ مكرَّر: الأوّل يفوز، والثاني يُبلَّغ مجهولاً */
      if ([...mapped.values()].includes(column)) unknownHeaders.push(text);
      else mapped.set(c, column);
    } else {
      unknownHeaders.push(text);
    }
  }

  const present = new Set([...mapped.values()].map((c) => c.key));
  const missingColumns = spec
    .filter((c) => c.required && !present.has(c.key))
    .map((c) => c.header);

  // ---------- الصفوف ----------
  const rows: ParsedRow[] = [];
  const last = Math.min(worksheet.rowCount, MAX_ROWS + 1);

  for (let r = 2; r <= last; r++) {
    const row = worksheet.getRow(r);
    const values: Record<string, string | number | boolean | null> = {};
    const errors: CellProblem[] = [];
    const warnings: CellProblem[] = [];

    for (const [index, column] of mapped) {
      const result = normalizeCell(row.getCell(index).value, column);

      values[column.key] = result.value;

      if (result.error) errors.push({ column: column.header, message: result.error });
      if (result.warning)
        warnings.push({ column: column.header, message: result.warning });
    }

    /*
     * السطرُ الفارغ يُتخطّى بلا شكوى — الفراغُ بين الدفعات عادةٌ في
     * جداول الناس، وعدُّه خطأً يُغرق التقرير بمئات الأسطر الوهمية.
     * والفراغُ يُقاس قبل أخطاء «مطلوب»، وإلّا صار كلُّ سطرٍ فارغ
     * أربعةَ أخطاء.
     */
    if (isBlankRow(values)) continue;

    /* والأعمدةُ الإلزامية الغائبة عن الورقة تُسجَّل على كلّ سطر */
    for (const header of missingColumns) {
      errors.push({ column: header, message: "العمود غائبٌ عن الورقة" });
    }

    rows.push({ rowNumber: r, values, errors, warnings });
  }

  return { kind, rows, unknownHeaders, missingColumns };
};

/**
 * يقرأ ورقةَ النوع المطلوب وحدها.
 *
 * وتُعرف الورقةُ باسمها (`الطلبة` / `الأساتذة`)؛ وإن لم يُعرف اسمُها
 * وكانت الورقةَ الوحيدة، حُملت على النوع المطلوب — فمن صدّر قائمةً
 * من برنامجٍ آخر تجيئه الورقةُ باسم `Sheet1`.
 */
export const readWorkbook = async (
  file: File,
  kind: SheetKind,
): Promise<ReadResult> => {
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();

  try {
    await workbook.xlsx.load(await file.arrayBuffer());
  } catch {
    return {
      fatal: "تعذّرت قراءة الملفّ — تأكّد أنّه بصيغة ‎.xlsx وليس ‎.xls أو ‎.csv",
    };
  }

  const wanted = workbook.worksheets.find((w) => matchSheet(w.name) === kind);

  if (wanted) return { sheet: readSheet(wanted, kind) };

  /* ملفُّ النوع الآخر — يُردّ باسمه لا بـ«لم تُوجد ورقة» */
  const other = workbook.worksheets.find(
    (w) => matchSheet(w.name) !== null && matchSheet(w.name) !== kind,
  );

  if (other) {
    const otherKind = matchSheet(other.name) as SheetKind;

    return {
      fatal: `هذا ملفُّ ${SHEET_NAMES[otherKind]} — استورده من شاشة ${SHEET_NAMES[otherKind]}`,
    };
  }

  /* ورقةٌ وحيدةٌ بلا اسمٍ معروف: تُحمل على المطلوب */
  if (workbook.worksheets.length === 1) {
    return { sheet: readSheet(workbook.worksheets[0], kind) };
  }

  return {
    fatal: `لم تُوجد ورقةٌ باسم «${SHEET_NAMES[kind]}» — سمِّ الورقة باسم ما فيها`,
  };
};
