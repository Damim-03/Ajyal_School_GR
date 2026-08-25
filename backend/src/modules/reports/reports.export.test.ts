import AdmZip from "adm-zip";
import { describe, expect, it } from "vitest";
import { metric, summaryOf, type ReportResponse } from "./reports.contract";
import { column } from "./reports.table";
import {
  exportFilename,
  selectColumns,
  toCsv,
  toXlsx,
} from "./reports.export";

const columns = [
  column("name", "الاسم", "text"),
  column("amount", "المبلغ", "money"),
  column("rate", "النسبة", "percent"),
  column("date", "التاريخ", "date"),
  column("note", "ملاحظة", "text", { hiddenByDefault: true }),
];

const report = (overrides: Partial<ReportResponse> = {}): ReportResponse =>
  ({
    meta: {
      report: "financial",
      academicYear: { id: "ay1", name: "2026/2027" },
      period: {
        kind: "month",
        label: "2026-09",
        from: null,
        to: null,
        month: 9,
        year: 2026,
      },
      filters: { studyGroupId: "g1" },
      supportedFilters: [],
      comparison: null,
      generatedAt: "2026-09-15T10:30:00.000Z",
      freshness: { source: "live", cachedAt: null },
    },
    summary: summaryOf([
      metric("invoiced", 980000),
      metric("collectionRate", null),
    ]),
    charts: [],
    table: {
      columns,
      rows: [
        {
          name: "عبد الله",
          amount: 1500.5,
          rate: 92.4,
          date: new Date(2026, 8, 1, 12),
          note: "مخفيّ",
        },
        {
          name: 'اسم "به" ; فاصلة',
          amount: null,
          rate: null,
          date: null,
          note: null,
        },
      ],
      pagination: {
        page: 1,
        pageSize: 50,
        total: 2,
        totalPages: 1,
        hasNext: false,
        hasPrevious: false,
      },
      sort: null,
    },
    ...overrides,
  }) as ReportResponse;

describe("selectColumns — §42", () => {
  it("يستثني المخفيّ افتراضياً", () => {
    const selected = selectColumns(columns);

    expect(selected.map((c) => c.key)).toEqual(["name", "amount", "rate", "date"]);
  });

  /*
   * الترتيبُ ترتيبُ الطلب لا ترتيبُ التعريف: من رتّب أعمدتَه في
   * الشاشة يتوقّعها بذلك الترتيب في الملفّ.
   */
  it("يحترم ترتيب المطلوب", () => {
    const selected = selectColumns(columns, ["amount", "name"]);

    expect(selected.map((c) => c.key)).toEqual(["amount", "name"]);
  });

  it("يُدرج المخفيّ متى طُلب صراحةً", () => {
    expect(selectColumns(columns, ["note"]).map((c) => c.key)).toEqual(["note"]);
  });

  /*
   * العمودُ المجهول يُهمَل بصمت لا يُسقط التصدير: من أرسل اسماً
   * خاطئاً يرى عموداً ناقصاً — أوضحُ من خطأٍ يمنع الملفَّ كلَّه.
   */
  it("يتجاهل المجهول ولا يرمي", () => {
    expect(selectColumns(columns, ["nope", "name"]).map((c) => c.key)).toEqual([
      "name",
    ]);
  });

  it("قائمةٌ فارغة تعني الافتراضي", () => {
    expect(selectColumns(columns, [])).toHaveLength(4);
  });
});

describe("toCsv", () => {
  const text = () => toCsv(report()).toString("utf8");

  /*
   * BOM يحسم الترميز: Excel على ويندوز يفترض ترميزَ النظام حين لا
   * يجد علامة، فيقرأ UTF-8 العربيةَ رموزاً مشوّهة.
   */
  it("يبدأ بعلامة BOM", () => {
    const buffer = toCsv(report());

    expect([buffer[0], buffer[1], buffer[2]]).toEqual([0xef, 0xbb, 0xbf]);
  });

  it("يكتب ترويسة السياق", () => {
    const csv = text();

    expect(csv).toContain("التقرير;financial");
    expect(csv).toContain("الفترة;2026-09");
    expect(csv).toContain("2026/2027");
    expect(csv).toContain("studyGroupId=g1");
  });

  it("يكتب المؤشّرات بعناوينها لا بمفاتيحها", () => {
    expect(text()).toContain("إجمالي المفوتر;980000");
  });

  it("المؤشّر غير المحسوب خانةٌ فارغة لا صفر", () => {
    const csv = text();
    const line = csv.split("\r\n").find((row) => row.startsWith("نسبة التحصيل"));

    expect(line).toBe("نسبة التحصيل;");
  });

  /*
   * الأرقامُ بلا فواصلِ آلافٍ ولا رمزِ عملة: «980,000.00 دج» نصٌّ
   * لا يُجمع في Excel، فيُفقد الملفَّ غرضَه.
   */
  it("يكتب الأرقام أرقاماً خامّة", () => {
    const csv = text();

    expect(csv).toContain("1500.5");
    expect(csv).not.toContain("1,500.50");
    expect(csv).not.toContain("دج");
  });

  it("يستعمل الفاصلة المنقوطة محدِّداً", () => {
    expect(text()).toContain("الاسم;المبلغ;النسبة;التاريخ");
  });

  /*
   * التهريب حسب RFC 4180: الاقتباسُ يُضاعَف والحقلُ يُحاط.
   */
  it("يهرّب الاقتباس والمحدِّد", () => {
    expect(text()).toContain('"اسم ""به"" ; فاصلة"');
  });

  it("لا يُدرج العمود المخفيّ", () => {
    expect(text()).not.toContain("مخفيّ");
  });

  it("القيمة الفارغة خانةٌ خالية", () => {
    const rows = text().split("\r\n");
    const last = rows[rows.length - 1];

    expect(last).toMatch(/;;;$/);
  });

  it("يحذف المؤشّرات متى طُلب", () => {
    const csv = toCsv(report(), { includeSummary: false }).toString("utf8");

    expect(csv).not.toContain("المؤشّرات");
    expect(csv).toContain("الاسم;");
  });

  it("تقريرٌ بلا جدول يُصدَّر بمؤشّراته", () => {
    const csv = toCsv(report({ table: null })).toString("utf8");

    expect(csv).toContain("إجمالي المفوتر");
    expect(csv).not.toContain("الاسم;المبلغ");
  });
});

describe("toXlsx", () => {
  const read = (path: string) => {
    const zip = new AdmZip(toXlsx(report()));
    return zip.getEntry(path)?.getData().toString("utf8") ?? "";
  };

  it("يبني أرشيفاً بالملفّات التي يطلبها Excel", () => {
    const names = new AdmZip(toXlsx(report()))
      .getEntries()
      .map((entry) => entry.entryName)
      .sort();

    expect(names).toEqual([
      "[Content_Types].xml",
      "_rels/.rels",
      "xl/_rels/workbook.xml.rels",
      "xl/styles.xml",
      "xl/workbook.xml",
      "xl/worksheets/sheet1.xml",
    ]);
  });

  /*
   * `rightToLeft` في عرض الورقة: جدولٌ عربيٌّ يبدأ من اليمين.
   * وبدونه يفتح Excel الورقةَ بمحاذاةٍ تجعل العمودَ الأوّل أقصى
   * اليسار — مقروءٌ لكنّه معكوسُ الترتيب على العين العربية.
   */
  it("يضبط اتجاه الورقة من اليمين", () => {
    expect(read("xl/worksheets/sheet1.xml")).toContain('rightToLeft="1"');
  });

  it("يكتب العربية نصّاً مضمَّناً بلا تشويه", () => {
    const sheet = read("xl/worksheets/sheet1.xml");

    expect(sheet).toContain("عبد الله");
    expect(sheet).toContain('t="inlineStr"');
  });

  /*
   * الرقمُ في `<v>` لا في `<is><t>`: الأوّلُ يُجمع في Excel
   * والثاني نصٌّ يُعرض ولا يُحسب.
   */
  it("يكتب الأرقام قيماً رقمية", () => {
    expect(read("xl/worksheets/sheet1.xml")).toContain("<v>1500.5</v>");
  });

  it("يهرّب محارف XML", () => {
    const sheet = read("xl/worksheets/sheet1.xml");

    expect(sheet).toContain("&quot;");
    expect(sheet).not.toMatch(/<t[^>]*>[^<]*"به"/);
  });

  it("مراجعُ الخلايا متسلسلة", () => {
    const sheet = read("xl/worksheets/sheet1.xml");

    expect(sheet).toContain('r="A1"');
    expect(sheet).toContain('r="B1"');
  });

  it("الخلية الفارغة بلا محتوى", () => {
    expect(read("xl/worksheets/sheet1.xml")).toMatch(/<c r="[A-Z]+\d+"\/>/);
  });
});

describe("exportFilename", () => {
  /*
   * اسمٌ يصف محتواه: مجلّدُ تنزيلاتٍ فيه عشرةُ ملفّاتٍ باسم
   * `export.xlsx` لا يُميَّز بعضُها من بعض.
   */
  it("يضمّ اسم التقرير وفترته", () => {
    expect(exportFilename(report(), "xlsx")).toBe(
      "ajyal-financial-2026-09.xlsx",
    );
  });

  it("يحترم الصيغة", () => {
    expect(exportFilename(report(), "csv").endsWith(".csv")).toBe(true);
  });

  /*
   * المحارفُ لاتينية عمداً: أسماءُ الملفّات العربية تُرمَّز في
   * ترويسة HTTP وتظهر مشوّهةً في بعض العملاء.
   */
  it("ينظّف المحارف غير الآمنة من التسمية", () => {
    const name = exportFilename(
      report({
        meta: {
          ...report().meta,
          report: "debts",
          period: { ...report().meta.period, label: "2026-09-01 → 2026-09-30" },
        },
      } as never),
      "csv",
    );

    expect(name).toMatch(/^ajyal-debts-[\w-]*\.csv$/);
    expect(name).not.toContain("→");
    expect(name).not.toContain(" ");
  });
});
