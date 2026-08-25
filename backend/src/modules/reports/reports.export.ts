import AdmZip from "adm-zip";
import type { ReportResponse, TableColumn } from "./reports.contract";

// ======================================================
// التصدير — §42
//
// ------------------------------------------------------
// لماذا لا PDF من الخادم
// ------------------------------------------------------
//
// `pdfkit` مثبَّتٌ في المشروع، ولا يصلح لتقاريرَ عربية:
//
//   1. خطوطُه المدمجة (Helvetica وأخواتها) بترميز WinAnsi، ولا
//      موضعَ فيه للحروف العربية أصلاً.
//   2. وحتى مع خطٍّ عربيّ مُضمَّن، لا يُجري PDFKit **تشكيلَ**
//      الحروف — لا يصل الحرفَ بما بعده ولا يختار صورتَه بحسب
//      موضعه — ولا يعكس اتجاهَ السطر. فتخرج «مرحبا» حروفاً
//      منفصلةً مقلوبة.
//
// والتشكيلُ ليس تفصيلاً تجميلياً: ورقةٌ رسمية بحروفٍ مقطّعة لا
// تُقرأ ولا تُقدَّم لأحد.
//
// والنظامُ يملك المخرجَ الصحيح سلفاً: الواجهةُ تطبع عبر
// `native-print.ts` — وهي داخل webview يُشكّل العربيةَ ويرتّبها
// كما يفعل المتصفّح، ويفرض A4 وهوامشَ صفر عبر Tauri. فالطباعةُ
// و PDF من هناك (§62)، لا من هنا.
//
// وما يصلح من الخادم صيغتا **بيانات** لا صيغتا صفحة: CSV و XLSX.
// كلتاهما نصٌّ بترميز UTF-8، والبرنامجُ الذي يفتحهما — Excel أو
// LibreOffice — يتولّى التشكيلَ والاتجاه بنفسه.
// ======================================================

export type ExportFormat = "csv" | "xlsx";

export type ExportOptions = {
  /** أعمدةٌ بعينها — §42 يطلب احترام اختيار المستخدم */
  columns?: string[];
  /** إدراجُ صفوف المؤشّرات فوق الجدول */
  includeSummary?: boolean;
};

// ------------------------------------------------------
// تنسيقُ القيم
// ------------------------------------------------------

/**
 * القيمةُ كما تُكتب في ملفّ بيانات.
 *
 * **لا تنسيقَ عرضٍ هنا**: لا فواصلَ آلاف ولا رمزَ عملة ولا نِسَبٍ
 * بعلامة `%`. الرقمُ يُكتب رقماً ليبقى قابلاً للجمع في Excel —
 * و«980,000.00 دج» نصٌّ لا يُجمع، فيُفقد الملفَّ غرضَه.
 *
 * والتنسيقُ مسؤوليةُ العارض: XLSX يحمل نمطَ الخلية، والقارئ
 * البشريُّ يقرأ PDF المطبوع من الواجهة.
 */
const cellValue = (
  value: unknown,
  type: TableColumn["type"],
): string | number | null => {
  if (value === null || value === undefined) return null;

  if (type === "money" || type === "number" || type === "percent") {
    return typeof value === "number" ? value : Number(value);
  }

  if (type === "date") {
    /*
     * التاريخُ إلى `YYYY-MM-DD` بالتقويم المحلّي.
     *
     * وقصُّ ISO مباشرةً يزحف يوماً كاملاً في التوقيتات الموجبة —
     * وهي الزلّةُ نفسها التي وقعت في تسمية الفترة. فيُبنى من
     * أجزاء التاريخ المحلّي.
     */
    const date = value instanceof Date ? value : new Date(String(value));

    if (Number.isNaN(date.getTime())) return String(value);

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
  }

  if (typeof value === "boolean") return value ? "نعم" : "لا";

  return String(value);
};

// ------------------------------------------------------
// اختيارُ الأعمدة
// ------------------------------------------------------

/**
 * الأعمدةُ المصدَّرة.
 *
 * الافتراضُ: الظاهرةُ وحدها — عمودٌ مخفيٌّ في الشاشة لا يُتوقَّع
 * في الملفّ. ومن طلب أعمدةً بعينها أُخذت بترتيبه هو لا بترتيب
 * التعريف، لأنّ ترتيبَ الأعمدة جزءٌ من الطلب.
 *
 * والعمودُ المطلوبُ غيرُ الموجود يُهمَل بصمت: `?columns=x,name`
 * يُصدّر `name` ولا يُسقط العملية. ومَن أرسل اسماً خاطئاً يرى
 * عموداً ناقصاً — أوضحُ من خطأٍ يمنع التصدير كلَّه.
 */
export const selectColumns = (
  columns: TableColumn[],
  requested?: string[],
): TableColumn[] => {
  if (!requested || requested.length === 0) {
    return columns.filter((column) => !column.hiddenByDefault);
  }

  const byKey = new Map(columns.map((column) => [column.key, column]));

  return requested
    .map((key) => byKey.get(key))
    .filter((column): column is TableColumn => column !== undefined);
};

// ======================================================
// CSV
// ======================================================

/**
 * تهريبُ حقلٍ واحد.
 *
 * القاعدةُ من RFC 4180: يُحاط بعلامتَي اقتباس متى حوى فاصلةً أو
 * اقتباساً أو سطراً جديداً، والاقتباسُ داخله يُضاعَف.
 *
 * والفاصلةُ المنقوطة لا الفاصلة كمحدِّد: Excel في المناطق التي
 * فاصلتُها العشرية فاصلة — وأكثرُ الإعدادات العربية كذلك — يقرأ
 * `1,5` رقمين لا رقماً واحداً. والفاصلةُ المنقوطة تنجو من ذلك.
 */
const CSV_DELIMITER = ";";

const csvField = (value: string | number | null): string => {
  if (value === null) return "";

  const text = String(value);

  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export const toCsv = (
  report: ReportResponse,
  options: ExportOptions = {},
): Buffer => {
  const lines: string[] = [];

  const push = (cells: (string | number | null)[]) =>
    lines.push(cells.map(csvField).join(CSV_DELIMITER));

  /*
   * ترويسةُ السياق — §42.
   *
   * ملفٌّ بلا فترةٍ ولا فلاتر يصير بعد أسبوعٍ مجهولَ المصدر: أيَّ
   * شهرٍ يمثّل؟ وأيَّ فوج؟ فتُكتب في أوّله ثلاثةُ سطور.
   */
  push(["التقرير", report.meta.report]);
  push(["الفترة", report.meta.period.label]);
  push([
    "السنة الدراسية",
    report.meta.academicYear?.name ?? "—",
  ]);
  push(["وُلّد في", cellValue(report.meta.generatedAt, "date")]);

  const activeFilters = Object.entries(report.meta.filters);

  if (activeFilters.length > 0) {
    push([
      "الفلاتر",
      activeFilters.map(([key, value]) => `${key}=${String(value)}`).join(" · "),
    ]);
  }

  push([]);

  if (options.includeSummary !== false) {
    push(["المؤشّرات"]);

    for (const [key, value] of Object.entries(report.summary)) {
      push([value.definition?.label ?? key, value.value]);
    }

    push([]);
  }

  if (report.table) {
    const columns = selectColumns(report.table.columns, options.columns);

    push(columns.map((column) => column.label));

    for (const row of report.table.rows) {
      push(
        columns.map((column) =>
          cellValue((row as Record<string, unknown>)[column.key], column.type),
        ),
      );
    }
  }

  /*
   * BOM في أوّل الملفّ.
   *
   * Excel على ويندوز يفترض ترميزَ النظام حين لا يجد علامةً، فيقرأ
   * UTF-8 العربيةَ رموزاً مشوّهة. والثلاثةُ بايتات تحسم الأمر.
   */
  return Buffer.concat([
    Buffer.from([0xef, 0xbb, 0xbf]),
    Buffer.from(lines.join("\r\n"), "utf8"),
  ]);
};

// ======================================================
// XLSX
//
// ملفُّ XLSX أرشيفُ ZIP فيه ملفّاتُ XML. وبناؤه هنا بـ`adm-zip`
// المثبَّت سلفاً بدل إضافة تبعيةٍ جديدة — والمطلوبُ منه واحد:
// جدولٌ بأرقامٍ تبقى أرقاماً وعربيةٍ تُقرأ. لا صيغَ ولا رسوم.
//
// والعربيةُ لا تحتاج تشكيلاً هنا: الملفُّ نصٌّ بترميز UTF-8،
// و Excel يشكّله ويرتّبه عند العرض.
// ======================================================

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** A, B, ... Z, AA, AB ... */
const columnLetter = (index: number): string => {
  let letter = "";
  let remaining = index;

  while (remaining >= 0) {
    letter = String.fromCharCode(65 + (remaining % 26)) + letter;
    remaining = Math.floor(remaining / 26) - 1;
  }

  return letter;
};

type SheetCell = string | number | null;

const cellXml = (
  value: SheetCell,
  reference: string,
  bold: boolean,
): string => {
  if (value === null || value === "") {
    return `<c r="${reference}"${bold ? ' s="1"' : ""}/>`;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return `<c r="${reference}"${bold ? ' s="1"' : ""}><v>${value}</v></c>`;
  }

  /*
   * `t="inlineStr"` بدل جدول السلاسل المشتركة.
   *
   * المشتركُ أصغرُ حجماً حين تتكرّر النصوص، لكنّه يحتاج ملفّاً
   * ثانياً وفهرسةً وتزامناً بينهما — وخطأٌ في الفهرس يُنتج ملفّاً
   * يرفض Excel فتحه. والمضمَّنُ يجعل كلَّ خليةٍ مستقلّةً بذاتها،
   * فالملفُّ إمّا صحيحٌ كلُّه أو خطأٌ ظاهر.
   */
  return `<c r="${reference}" t="inlineStr"${
    bold ? ' s="1"' : ""
  }><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
};

const sheetXml = (rows: { cells: SheetCell[]; bold?: boolean }[]): string => {
  const body = rows
    .map((row, rowIndex) => {
      const cells = row.cells
        .map((cell, columnIndex) =>
          cellXml(
            cell,
            `${columnLetter(columnIndex)}${rowIndex + 1}`,
            row.bold ?? false,
          ),
        )
        .join("");

      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews><sheetData>${body}</sheetData></worksheet>`;
};

export const toXlsx = (
  report: ReportResponse,
  options: ExportOptions = {},
): Buffer => {
  const rows: { cells: SheetCell[]; bold?: boolean }[] = [];

  rows.push({ cells: ["التقرير", report.meta.report], bold: true });
  rows.push({ cells: ["الفترة", report.meta.period.label] });
  rows.push({
    cells: ["السنة الدراسية", report.meta.academicYear?.name ?? "—"],
  });
  rows.push({
    cells: ["وُلّد في", cellValue(report.meta.generatedAt, "date")],
  });

  const activeFilters = Object.entries(report.meta.filters);

  if (activeFilters.length > 0) {
    rows.push({
      cells: [
        "الفلاتر",
        activeFilters
          .map(([key, value]) => `${key}=${String(value)}`)
          .join(" · "),
      ],
    });
  }

  rows.push({ cells: [] });

  if (options.includeSummary !== false) {
    rows.push({ cells: ["المؤشّرات"], bold: true });

    for (const [key, value] of Object.entries(report.summary)) {
      rows.push({ cells: [value.definition?.label ?? key, value.value] });
    }

    rows.push({ cells: [] });
  }

  if (report.table) {
    const columns = selectColumns(report.table.columns, options.columns);

    rows.push({ cells: columns.map((column) => column.label), bold: true });

    for (const row of report.table.rows) {
      rows.push({
        cells: columns.map((column) =>
          cellValue((row as Record<string, unknown>)[column.key], column.type),
        ),
      });
    }
  }

  const zip = new AdmZip();

  zip.addFile(
    "[Content_Types].xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
      "utf8",
    ),
  );

  zip.addFile(
    "_rels/.rels",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
      "utf8",
    ),
  );

  zip.addFile(
    "xl/workbook.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="التقرير" sheetId="1" r:id="rId1"/></sheets></workbook>`,
      "utf8",
    ),
  );

  zip.addFile(
    "xl/_rels/workbook.xml.rels",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
      "utf8",
    ),
  );

  /*
   * نمطان اثنان: عاديّ وعريض.
   *
   * وأقلُّ ما يقبله Excel من `styles.xml` هو `cellXfs` بمدخلٍ صفريّ
   * — وحذفُ الملفّ كلِّه يجعله يشكو من «محتوى غير قابل للقراءة».
   */
  zip.addFile(
    "xl/styles.xml",
    Buffer.from(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs></styleSheet>`,
      "utf8",
    ),
  );

  zip.addFile("xl/worksheets/sheet1.xml", Buffer.from(sheetXml(rows), "utf8"));

  return zip.toBuffer();
};

// ======================================================
// اسمُ الملفّ
// ======================================================

/**
 * اسمٌ يصف محتواه.
 *
 * `ajyal-financial-2026-09.xlsx` لا `export.xlsx`: مجلّدُ تنزيلاتٍ
 * فيه عشرةُ ملفّاتٍ بالاسم الثاني لا يُميَّز بعضُها من بعض.
 *
 * والمحارفُ لاتينيةٌ عمداً رغم أنّ التقرير عربي: أسماءُ الملفّات
 * العربية تُرمَّز في ترويسة HTTP وتَظهر مشوّهةً في بعض العملاء،
 * وقد تُرفض في مزامنةٍ أو نسخٍ إلى وسائط أخرى.
 */
export const exportFilename = (
  report: ReportResponse,
  format: ExportFormat,
): string => {
  const period = report.meta.period.label
    .replace(/[^\w-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);

  return `ajyal-${report.meta.report}${period ? `-${period}` : ""}.${format}`;
};

export const CONTENT_TYPE: Record<ExportFormat, string> = {
  csv: "text/csv; charset=utf-8",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export const serialize = (
  report: ReportResponse,
  format: ExportFormat,
  options: ExportOptions = {},
): Buffer => (format === "csv" ? toCsv(report, options) : toXlsx(report, options));
