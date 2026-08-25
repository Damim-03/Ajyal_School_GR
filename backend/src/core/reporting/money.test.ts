import { describe, expect, it } from "vitest";
import { Prisma } from "../../../generated/prisma";
import { change, money, rate, subtract, sum, toDecimal, toNumber } from "./money";

const D = (value: string | number) => new Prisma.Decimal(value);

describe("toDecimal", () => {
  it("يعامل غيابَ القيمة صفراً — تجميعُ Prisma يُرجع null حين لا صفوف", () => {
    expect(toDecimal(null).toString()).toBe("0");
    expect(toDecimal(undefined).toString()).toBe("0");
  });

  it("يمرّر Decimal كما هو بلا تحويل", () => {
    const value = D("1234.56");
    expect(toDecimal(value)).toBe(value);
  });

  it("يرفض القيم غير المنتهية بدل تمريرها صامتة", () => {
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(TypeError);
    expect(() => toDecimal(Number.NaN)).toThrow(TypeError);
  });
});

describe("sum", () => {
  /*
   * هذا الاختبار هو سببُ وجود الملف كلِّه.
   *
   * 0.1 + 0.2 في الفاصلة العائمة = 0.30000000000000004. ومئةُ
   * مبلغٍ صغير تُراكم فرقاً يظهر في التقرير كدينارٍ لا مصدرَ له.
   */
  it("يجمع بلا خطأ الفاصلة العائمة", () => {
    expect(sum([0.1, 0.2]).toString()).toBe("0.3");
    expect(0.1 + 0.2).not.toBe(0.3);
  });

  it("يجمع مئةَ مبلغٍ عشريّ بدقّة تامّة", () => {
    const values = Array.from({ length: 100 }, () => "0.1");
    expect(sum(values).toString()).toBe("10");
  });

  it("قائمةٌ فارغة تُنتج صفراً لا NaN", () => {
    expect(sum([]).toString()).toBe("0");
  });

  it("يتجاهل الفجوات ضمن القائمة", () => {
    expect(sum([100, null, 50, undefined]).toString()).toBe("150");
  });
});

describe("money — التقريب", () => {
  it("يقرّب إلى منزلتين بـHALF_UP كبقية النظام", () => {
    expect(money("10.005").toString()).toBe("10.01");
    expect(money("10.004").toString()).toBe("10");
    expect(money("10.015").toString()).toBe("10.02");
  });

  it("لا يعرض 980000.0000001", () => {
    expect(toNumber("980000.0000001")).toBe(980000);
  });
});

describe("rate — القسمة الآمنة", () => {
  it("يحسب النسبة بخانتين", () => {
    expect(rate(91, 100)).toBe(91);
    expect(rate(2, 3)).toBe(66.67);
  });

  /*
   * المقامُ صفرٌ حالةٌ متكرّرة: شهرٌ بلا فواتير، فوجٌ بلا حصص.
   * و`null` تعني «لا معنى لنسبةٍ هنا»، بخلاف 0 التي تعني «حُسبت
   * فكانت صفراً». الواجهةُ تعرض «—» للأولى و«0%» للثانية.
   */
  it("يُرجع null لا NaN ولا صفر حين المقام صفر", () => {
    expect(rate(0, 0)).toBeNull();
    expect(rate(100, 0)).toBeNull();
  });

  it("يميّز الصفرَ المحسوب عن غير المحسوب", () => {
    expect(rate(0, 100)).toBe(0);
    expect(rate(0, 0)).toBeNull();
  });

  it("النسبة الكاملة 100 لا 99.99", () => {
    expect(rate("1234.56", "1234.56")).toBe(100);
  });
});

describe("change — مقارنة الفترتين §34", () => {
  it("يحسب المطلق والنسبة معاً", () => {
    expect(change(112.4, 100)).toEqual({ absolute: 12.4, percentage: 12.4 });
  });

  /*
   * التوقّعُ المكتوب هنا رقمٌ حرفيّ لا تعبيرٌ حسابي.
   *
   * كُتب أوّلَ مرّة `112.4 - 100` فسقط الاختبار: تحسبها JavaScript
   * 12.400000000000006 بينما الدالّة تُرجع 12.4. أي أنّ الاختبار
   * كان يقيس الدالّةَ بالمسطرة المعوجّة التي وُجدت الدالّةُ
   * لتفاديها — والسطرُ التالي يوثّق ذلك بدل أن يُنسى.
   */
  it("الحسابُ العائم نفسه يُخطئ حيث تصيب الدالّة", () => {
    expect(112.4 - 100).not.toBe(12.4);
    expect(change(112.4, 100).absolute).toBe(12.4);
  });

  it("يتعامل مع التراجع", () => {
    const result = change(92, 100);
    expect(result.absolute).toBe(-8);
    expect(result.percentage).toBe(-8);
  });

  /*
   * §34 يطلب «التعامل الصحيح مع المقام الصفري». والصواب أن تبقى
   * النسبة null: مؤسسةٌ انتقلت من صفر إلى 40 طالباً نموُّها ليس
   * «+∞%» بل «+40 طالباً» — والواجهةُ تعرض المطلق وحده.
   */
  it("النسبة null حين تكون الفترة السابقة صفراً، والمطلق يبقى محسوباً", () => {
    expect(change(40, 0)).toEqual({ absolute: 40, percentage: null });
  });

  it("صفرٌ إلى صفر: لا تغيّر ولا نسبة", () => {
    expect(change(0, 0)).toEqual({ absolute: 0, percentage: null });
  });

  it("يقيس التغيّر عن أساسٍ سالب بقيمته المطلقة", () => {
    expect(change(-50, -100).percentage).toBe(50);
  });
});

describe("subtract", () => {
  it("يطرح بلا خطأ عائم", () => {
    expect(subtract("0.3", "0.1").toString()).toBe("0.2");
  });
});
