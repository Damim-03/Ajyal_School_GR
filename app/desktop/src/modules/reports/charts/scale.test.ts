import { describe, expect, it } from "vitest";
import {
  bandScale,
  compactNumber,
  formatByUnit,
  linearScale,
  ratioOf,
} from "./scale";

// ======================================================
// هذا الملفُّ هو ثمنُ اختيار SVG على مكتبةٍ جاهزة.
//
// حسابُ المقياس يُخطئ بصمت: محورٌ لا يشمل أكبرَ قيمة يقصّ عموداً
// ولا يشكو أحد، ومحورٌ خطوتُه 2437 يُنتج رسماً صحيحَ النسب قبيحَ
// التدريج. فالاختبارُ هنا بديلُ الثقة التي تُعطيها مكتبةٌ مجرَّبة.
// ======================================================

describe("linearScale", () => {
  it("يشمل أكبر قيمة", () => {
    const scale = linearScale([10, 45, 98]);

    expect(scale.max).toBeGreaterThanOrEqual(98);
    expect(scale.ticks[scale.ticks.length - 1]).toBe(scale.max);
  });

  /*
   * القاعدةُ صفر: محورٌ يبدأ من أدنى قيمة يضخّم الفروقَ بصرياً.
   * عمودان 980 و1000 يظهران بفارق الضِّعف إن بدأ المحور من 970 —
   * تضليلٌ لا تحسينُ عرض.
   */
  it("يبدأ من الصفر مع القيم الموجبة", () => {
    expect(linearScale([980, 1000]).min).toBe(0);
  });

  it("يمتدّ تحت الصفر مع القيم السالبة", () => {
    const scale = linearScale([-40000, 100000]);

    expect(scale.min).toBeLessThanOrEqual(-40000);
    expect(scale.max).toBeGreaterThanOrEqual(100000);
  });

  /*
   * «الرقم الجميل»: 1 أو 2 أو 2.5 أو 5 أو 10 × قوّة عشرة. والغرضُ
   * أن يُقرأ التدريجُ بلا حساب.
   */
  it("يختار خطوةً مقروءة", () => {
    for (const values of [[97], [980000], [3.7], [45231]]) {
      const { step } = linearScale(values);
      const normalized = step / 10 ** Math.floor(Math.log10(step));

      expect([1, 2, 2.5, 5, 10]).toContain(Number(normalized.toFixed(1)));
    }
  });

  /*
   * التوليدُ بالضرب لا بالجمع المتراكم: `current += step` يُراكم
   * خطأ الفاصلة العائمة فتظهر علامةٌ قيمتُها 0.30000000000000004.
   */
  it("العلامات بلا خطأ عائم", () => {
    for (const tick of linearScale([0.1, 0.5]).ticks) {
      expect(String(tick)).not.toMatch(/\d{10,}/);
    }
  });

  it("العلامات متصاعدة ومتساوية الخطوة", () => {
    const { ticks, step } = linearScale([0, 1000]);

    for (let i = 1; i < ticks.length; i += 1) {
      expect(ticks[i] - ticks[i - 1]).toBeCloseTo(step, 6);
    }
  });

  // §74 على مستوى العرض
  it("بلا قيم: مقياسٌ صالحٌ لا انهيار", () => {
    const scale = linearScale([]);

    expect(scale.min).toBe(0);
    expect(scale.max).toBe(1);
    expect(scale.ticks.length).toBeGreaterThan(1);
  });

  it("قيمٌ كلُّها null تُعامَل كالفراغ", () => {
    expect(linearScale([null, null]).max).toBe(1);
  });

  /*
   * كلُّ القيم متساوية: المدى صفر. ولولا المعالجة لقُسم على صفر
   * فخرجت إحداثيّاتٌ NaN ولم يُرسم شيء.
   */
  it("قيمٌ متساوية تُنتج مدىً صالحاً", () => {
    const scale = linearScale([500, 500, 500]);

    expect(scale.max).toBeGreaterThan(scale.min);
    expect(Number.isFinite(scale.step)).toBe(true);
  });

  it("كلُّ القيم صفر", () => {
    const scale = linearScale([0, 0, 0]);

    expect(scale.min).toBe(0);
    expect(scale.max).toBeGreaterThan(0);
  });

  it("يتجاهل القيم غير المنتهية", () => {
    const scale = linearScale([10, Number.NaN, 90, Number.POSITIVE_INFINITY]);

    expect(Number.isFinite(scale.max)).toBe(true);
    expect(scale.max).toBeGreaterThanOrEqual(90);
  });
});

describe("ratioOf", () => {
  it("يحوّل القيمة إلى نسبةٍ من الرقعة", () => {
    const scale = linearScale([0, 100]);

    expect(ratioOf(0, scale)).toBe(0);
    expect(ratioOf(scale.max, scale)).toBe(1);
  });

  /*
   * القصُّ حارسٌ لا تجميل: قيمةٌ خارج المقياس تُنتج إحداثيّاً خارج
   * الرقعة، فيُرسم عمودٌ يخرج من الإطار ويغطّي العنوان.
   */
  it("يقصّ ما خرج عن المقياس", () => {
    const scale = linearScale([0, 100]);

    expect(ratioOf(999999, scale)).toBe(1);
    expect(ratioOf(-999, scale)).toBe(0);
  });
});

describe("bandScale", () => {
  it("يوزّع الفئات بالتساوي", () => {
    const band = bandScale(4, 400);

    expect(band.bandWidth).toBe(100);
    expect(band.center(0)).toBe(50);
    expect(band.center(3)).toBe(350);
  });

  it("فئةٌ واحدة تملأ الرقعة", () => {
    expect(bandScale(1, 300).center(0)).toBe(150);
  });

  it("بلا فئات لا يقسم على صفر", () => {
    expect(Number.isFinite(bandScale(0, 300).bandWidth)).toBe(true);
  });
});

describe("compactNumber", () => {
  /*
   * الاختصارُ للمحور وحده: محورٌ علاماتُه «980000» يزدحم ويُقصّ.
   */
  it("يختصر الآلاف والملايين", () => {
    expect(compactNumber(980000)).toBe("980 ألف");
    expect(compactNumber(1500)).toBe("1.5 ألف");
    expect(compactNumber(2400000)).toBe("2.4 م");
  });

  it("يترك الصغير كما هو", () => {
    expect(compactNumber(42)).toBe("42");
    expect(compactNumber(0)).toBe("0");
  });

  it("يحترم السالب", () => {
    expect(compactNumber(-1500)).toBe("-1.5 ألف");
  });
});

describe("formatByUnit", () => {
  /*
   * `null` شرطةٌ لا صفر: «0%» تعني «حُسبت فكانت صفراً»، و«—» تعني
   * «لا معنى لنسبةٍ هنا».
   */
  it("null تُعرض شرطة", () => {
    expect(formatByUnit(null, "money")).toBe("—");
    expect(formatByUnit(null, "percent")).toBe("—");
  });

  it("الصفر المحسوب يُعرض صفراً", () => {
    expect(formatByUnit(0, "percent")).toBe("0%");
  });

  it("النسبة بعلامتها", () => {
    expect(formatByUnit(91.43, "percent")).toBe("91.43%");
  });

  it("المال بعملته", () => {
    expect(formatByUnit(1500, "money")).toContain("دج");
  });

  /*
   * البطاقاتُ تعرض الرقم كاملاً: «980 ألف» في بطاقة إيراد تُخفي
   * 437 ديناراً قد تُسأل عنها.
   */
  it("الوضع الكامل لا يختصر", () => {
    expect(formatByUnit(980437, "money")).toContain("437");
  });

  it("الوضع المختصر للمحور", () => {
    expect(formatByUnit(980000, "money", true)).toContain("ألف");
  });
});
