import { describe, expect, it } from "vitest";
import { chart, metric, pagination, summaryOf } from "./reports.contract";

describe("pagination", () => {
  it("يحسب الصفحات والحدود", () => {
    const page = pagination(2, 50, 428);

    expect(page.totalPages).toBe(9);
    expect(page.hasNext).toBe(true);
    expect(page.hasPrevious).toBe(true);
  });

  it("الصفحة الأولى بلا سابقة", () => {
    expect(pagination(1, 50, 428).hasPrevious).toBe(false);
  });

  it("الصفحة الأخيرة بلا تالية", () => {
    expect(pagination(9, 50, 428).hasNext).toBe(false);
  });

  /*
   * صفحةٌ واحدة على الأقلّ حتى بلا صفوف: «صفحة 1 من 0» عبارةٌ لا
   * معنى لها، والجدولُ الفارغ صفحةٌ واحدة فارغة.
   */
  it("جدولٌ فارغ: صفحةٌ واحدة لا صفر", () => {
    const page = pagination(1, 50, 0);

    expect(page.totalPages).toBe(1);
    expect(page.hasNext).toBe(false);
    expect(page.hasPrevious).toBe(false);
  });

  it("صفٌّ واحد يملأ صفحةً واحدة", () => {
    expect(pagination(1, 50, 1).totalPages).toBe(1);
  });

  it("العدد المطابق تماماً لا يُنتج صفحةً زائدة", () => {
    expect(pagination(1, 50, 100).totalPages).toBe(2);
    expect(pagination(1, 50, 101).totalPages).toBe(3);
  });
});

describe("metric — §70", () => {
  /*
   * التعريفُ يُحقن من الكتالوج لا يُعاد كتابته في الواجهة، فتصحيحُ
   * تعريفٍ يظهر في كل شاشةٍ تعرضه بلا تعديلِ واجهة.
   */
  it("يحقن التعريف من الكتالوج", () => {
    const card = metric("collectionRate", 72.45);

    expect(card.value).toBe(72.45);
    expect(card.definition?.label).toBe("نسبة التحصيل");
    expect(card.definition?.unit).toBe("percent");
    expect(card.definition?.formula).toContain("collected");
  });

  /*
   * مفتاحٌ بلا تعريف لا يُسقط الاستجابة: تُرسل البطاقة بلا تلميح.
   * إسقاطُ تقريرٍ ماليٍّ كامل لأنّ نصَّ تلميحٍ ناقص مقايضةٌ خاسرة.
   */
  it("مفتاحٌ مجهول يمرّ بلا تعريف ولا يرمي", () => {
    const card = metric("someNewMetric", 42);

    expect(card.value).toBe(42);
    expect(card.definition).toBeUndefined();
  });

  it("القيمة null تُنقل كما هي — «غير محسوب» لا صفر", () => {
    expect(metric("collectionRate", null).value).toBeNull();
  });

  it("يُرفق المقارنة حين تُطلب", () => {
    const card = metric("invoiced", 980000, {
      previous: 870000,
      absolute: 110000,
      percentage: 12.64,
    });

    expect(card.comparison?.percentage).toBe(12.64);
  });

  it("يُسقط حقل المقارنة حين لا تُطلب", () => {
    expect("comparison" in metric("invoiced", 980000)).toBe(false);
  });

  it("التعريفُ يحمل التحذير حين وُجد", () => {
    expect(metric("netCashMovement", 425000).definition?.caveat).toContain(
      "ليس ربحاً",
    );
  });
});

describe("summaryOf", () => {
  it("يفهرس البطاقات بمفاتيحها", () => {
    const summary = summaryOf([
      metric("invoiced", 980000),
      metric("collected", 710000),
    ]);

    expect(Object.keys(summary)).toEqual(["invoiced", "collected"]);
    expect(summary.collected.value).toBe(710000);
  });
});

describe("chart — §48", () => {
  it("رسمٌ بقيمٍ ليس فارغاً", () => {
    const result = chart({
      key: "revenue",
      title: "الإيراد",
      kind: "line",
      unit: "money",
      categories: ["2026-09", "2026-10"],
      series: [{ key: "revenue", label: "الإيراد", data: [100, 200] }],
    });

    expect(result.isEmpty).toBe(false);
  });

  /*
   * الفرقُ الذي تطلبه §48: شهرٌ كلُّ إيراده صفر رسمٌ مسطّح على
   * الصفر — بيانٌ صحيح يُعرض. وشهرٌ لا بيانات فيه حالةٌ فارغة
   * برسالة. والخلطُ بينهما يُخفي معلومةً حقيقية.
   */
  it("قيمٌ كلُّها صفر ليست فراغاً", () => {
    const result = chart({
      key: "revenue",
      title: "الإيراد",
      kind: "line",
      unit: "money",
      categories: ["2026-09"],
      series: [{ key: "revenue", label: "الإيراد", data: [0] }],
    });

    expect(result.isEmpty).toBe(false);
  });

  it("قيمٌ كلُّها null فراغ", () => {
    const result = chart({
      key: "revenue",
      title: "الإيراد",
      kind: "line",
      unit: "money",
      categories: ["2026-09", "2026-10"],
      series: [{ key: "revenue", label: "الإيراد", data: [null, null] }],
    });

    expect(result.isEmpty).toBe(true);
  });

  it("بلا فئات: فراغ", () => {
    const result = chart({
      key: "revenue",
      title: "الإيراد",
      kind: "bar",
      unit: "money",
      categories: [],
      series: [],
    });

    expect(result.isEmpty).toBe(true);
  });

  it("سلسلةٌ واحدة بقيمة تكفي لنفي الفراغ", () => {
    const result = chart({
      key: "mixed",
      title: "مختلط",
      kind: "bar",
      unit: "count",
      categories: ["أ", "ب"],
      series: [
        { key: "a", label: "أ", data: [null, null] },
        { key: "b", label: "ب", data: [null, 5] },
      ],
    });

    expect(result.isEmpty).toBe(false);
  });

  it("يحفظ وجهة التنقيب — §40", () => {
    const result = chart({
      key: "revenueBySubject",
      title: "الإيراد بالمادة",
      kind: "horizontalBar",
      unit: "money",
      categories: ["رياضيات"],
      series: [{ key: "revenue", label: "الإيراد", data: [50000] }],
      drill: {
        to: "/reports/financial",
        param: "subjectId",
        categoryIds: ["sub1"],
      },
    });

    expect(result.drill?.param).toBe("subjectId");
    expect(result.drill?.categoryIds).toEqual(["sub1"]);
  });
});
