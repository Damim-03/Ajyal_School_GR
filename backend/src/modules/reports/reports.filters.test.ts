import { describe, expect, it } from "vitest";
import {
  REPORT_CAPABILITIES,
  applyCapability,
  reportQuerySchema,
  supportsComparison,
} from "./reports.filters";

const parse = (input: Record<string, unknown>) =>
  reportQuerySchema.parse(input);

describe("reportQuerySchema — التحقّق", () => {
  it("يطبّق القيم الافتراضية", () => {
    const query = parse({});

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(50);
    expect(query.comparison).toBe("none");
    expect(query.sortDir).toBe("desc");
  });

  it("يحوّل النصوص القادمة من معاملات الاستعلام", () => {
    const query = parse({ month: "9", year: "2026", page: "3" });

    expect(query.month).toBe(9);
    expect(query.year).toBe(2026);
    expect(query.page).toBe(3);
  });

  /*
   * §41 و§67: السقفُ في المخطّط لا في الخدمة.
   *
   * لو كان في الخدمة لأمكن تجاوزُه بمعامل استعلامٍ مصنوع يدوياً،
   * فيُطلب خمسون ألف صفٍّ دفعةً واحدة ويسقط الخادم — أو تُسحب
   * بياناتٌ أكثر ممّا تعرضه الشاشة.
   */
  it("يرفض حجمَ صفحةٍ يتجاوز السقف", () => {
    expect(() => parse({ pageSize: "5000" })).toThrow();
    expect(parse({ pageSize: "200" }).pageSize).toBe(200);
  });

  it("يرفض مدىً معكوساً", () => {
    expect(() =>
      parse({ dateFrom: "2026-09-30", dateTo: "2026-09-01" }),
    ).toThrow();
  });

  it("يقبل مدىً من يومٍ واحد", () => {
    const query = parse({ dateFrom: "2026-09-15", dateTo: "2026-09-15" });
    expect(query.dateFrom).toBeInstanceOf(Date);
  });

  /*
   * «سبتمبر» بلا سنةٍ غامض. ولو أكملناه بالسنة الجارية صامتين
   * لعرضنا سبتمبر 2026 لمن قصد 2025 — والرقمُ يبدو سليماً.
   */
  it("يرفض الشهر بلا سنة", () => {
    expect(() => parse({ month: "9" })).toThrow();
    expect(parse({ month: "9", year: "2026" }).month).toBe(9);
  });

  it("يقبل السنة وحدها", () => {
    expect(parse({ year: "2026" }).year).toBe(2026);
  });

  it("يرفض شهراً خارج المدى", () => {
    expect(() => parse({ month: "13", year: "2026" })).toThrow();
    expect(() => parse({ month: "0", year: "2026" })).toThrow();
  });

  it("يرفض حالةً غير معروفة", () => {
    expect(() => parse({ invoiceStatus: "ARCHIVED" })).toThrow();
    expect(() => parse({ paymentMethod: "CRYPTO" })).toThrow();
  });

  it("يرفض المعرّف الفارغ بدل تمريره شرطاً يطابق لا شيء", () => {
    expect(() => parse({ studentId: "   " })).toThrow();
  });
});

describe("applyCapability — §4", () => {
  /*
   * الفلترُ غيرُ المدعوم يُسقط ويُعلَن.
   *
   * والبديلُ الساذج — تمريرُ كلّ شيء وتجاهلُ ما لا يُفهم — يجعل
   * المستخدم يضبط فلتراً ويرى الرقمَ لا يتغيّر، فيظنّ البياناتِ
   * خاطئة والفلترُ لم يُقرأ أصلاً.
   */
  it("يُسقط ما لا يدعمه التقرير ويُبلّغ عنه", () => {
    const query = parse({
      month: "9",
      year: "2026",
      studyGroupId: "g1",
      paymentMethod: "CASH",
    });

    const result = applyCapability("attendance", query);

    expect(result.filters.studyGroupId).toBe("g1");
    expect(result.filters.paymentMethod).toBeUndefined();
    expect(result.ignored).toContain("paymentMethod");
  });

  it("يمرّر ما يدعمه", () => {
    const query = parse({ paymentMethod: "CASH", month: "9", year: "2026" });
    const result = applyCapability("financial", query);

    expect(result.filters.paymentMethod).toBe("CASH");
    expect(result.ignored).toHaveLength(0);
  });

  it("لا يُدرج الفلاتر غير المرسَلة", () => {
    const result = applyCapability("financial", parse({}));

    expect(Object.keys(result.filters)).toHaveLength(0);
    expect(result.ignored).toHaveLength(0);
  });

  /*
   * §67: سجلُّ التدقيق لا يقبل فلاتر النطاق الأكاديمي.
   *
   * واقعاتُه على كياناتٍ مختلفة الأنواع لا صفوفٌ تنتمي إلى فوج.
   * وتقييدُه بفوجٍ يُنتج قائمةً ناقصة تُقرأ كأنّها كاملة — وهذا
   * أسوأ ما يقع في شاشة مراجعة.
   */
  it("التدقيق يرفض كلّ فلاتر النطاق", () => {
    const query = parse({ studyGroupId: "g1", teacherId: "t1", studentId: "s1" });
    const result = applyCapability("audit", query);

    expect(Object.keys(result.filters)).toHaveLength(0);
    expect(result.ignored).toEqual(
      expect.arrayContaining(["studyGroupId", "teacherId", "studentId"]),
    );
  });

  it("يرفض تقريراً مجهولاً بدل تمريره بلا قيود", () => {
    expect(() => applyCapability("does-not-exist", parse({}))).toThrow();
  });

  it("كلُّ تقريرٍ يُصرّح بمفتاحٍ يطابق اسمه", () => {
    for (const [key, capability] of Object.entries(REPORT_CAPABILITIES)) {
      expect(capability.report).toBe(key);
    }
  });

  it("لا فلترَ مكرّرٌ في تصريحٍ واحد", () => {
    for (const capability of Object.values(REPORT_CAPABILITIES)) {
      expect(new Set(capability.supports).size).toBe(capability.supports.length);
    }
  });
});

describe("supportsComparison — §34", () => {
  it("يقبل الأوضاع المصرَّح بها", () => {
    expect(supportsComparison("financial", "sameMonthLastYear")).toBe(true);
    expect(supportsComparison("financial", "previousMonth")).toBe(true);
  });

  it("يرفض ما لم يُصرَّح به", () => {
    expect(supportsComparison("payments", "sameMonthLastYear")).toBe(false);
  });

  it("«بلا مقارنة» مقبولةٌ دائماً", () => {
    expect(supportsComparison("audit", "none")).toBe(true);
  });

  it("التدقيق لا يقبل مقارنة", () => {
    expect(supportsComparison("audit", "previousMonth")).toBe(false);
  });

  it("تقريرٌ مجهول لا يقبل شيئاً", () => {
    expect(supportsComparison("nope", "previousMonth")).toBe(false);
  });
});
