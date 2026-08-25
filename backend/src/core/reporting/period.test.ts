import { describe, expect, it } from "vitest";
import {
  academicYearMonths,
  addMonths,
  comparisonMonth,
  comparisonRange,
  endOfDay,
  endOfMonth,
  isBeforePeriod,
  monthsBetween,
  startOfDay,
  startOfMonth,
  yearMonthKey,
  yearMonthOf,
} from "./period";

const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 12, 0, 0);

describe("حدود اليوم", () => {
  /*
   * المدى شاملٌ ليوم النهاية. وإغفالُ ذلك يُسقط دفعاتِ آخر يومٍ
   * من كل تقرير — نقصٌ منتظم صغير لا يلفت النظر.
   */
  it("نهايةُ اليوم آخرُ مللي ثانية فيه", () => {
    const end = endOfDay(at(2026, 9, 30));

    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getMilliseconds()).toBe(999);
    expect(end.getDate()).toBe(30);
  });

  it("بدايةُ اليوم منتصفُ ليله", () => {
    const start = startOfDay(at(2026, 9, 30));
    expect(start.getHours()).toBe(0);
    expect(start.getMilliseconds()).toBe(0);
  });

  it("لا يُعدّل الكائن الأصلي", () => {
    const original = at(2026, 9, 30);
    const copy = new Date(original);
    endOfDay(original);
    expect(original.getTime()).toBe(copy.getTime());
  });
});

describe("حدود الشهر", () => {
  it("يبدأ الشهر في يومه الأول", () => {
    const start = startOfMonth({ year: 2026, month: 9 });
    expect(start.getDate()).toBe(1);
    expect(start.getMonth()).toBe(8);
  });

  it("ينتهي سبتمبر في الثلاثين", () => {
    expect(endOfMonth({ year: 2026, month: 9 }).getDate()).toBe(30);
  });

  it("ينتهي ديسمبر في الحادي والثلاثين بلا تسرّبٍ إلى يناير", () => {
    const end = endOfMonth({ year: 2026, month: 12 });
    expect(end.getDate()).toBe(31);
    expect(end.getMonth()).toBe(11);
    expect(end.getFullYear()).toBe(2026);
  });

  /*
   * السنةُ الكبيسة تحسبها البيئةُ نفسها، فلا جدولَ أيّامٍ ولا
   * استثناءَ مكتوباً بيدٍ يمكن أن يُخطئ.
   */
  it("ينتهي فبراير الكبيس في التاسع والعشرين", () => {
    expect(endOfMonth({ year: 2028, month: 2 }).getDate()).toBe(29);
    expect(endOfMonth({ year: 2027, month: 2 }).getDate()).toBe(28);
  });
});

describe("addMonths", () => {
  it("يضيف داخل السنة", () => {
    expect(addMonths({ year: 2026, month: 9 }, 2)).toEqual({
      year: 2026,
      month: 11,
    });
  });

  it("يعبر رأس السنة صعوداً", () => {
    expect(addMonths({ year: 2026, month: 11 }, 3)).toEqual({
      year: 2027,
      month: 2,
    });
  });

  /*
   * هذه الحالةُ سببُ استعمال Math.floor لا Math.trunc.
   *
   * «يناير ناقص شهر» يجب أن تكون ديسمبر من السنة **السابقة**.
   * والبترُ يُبقي السنةَ كما هي فتصير ديسمبر 2026 بدل ديسمبر 2025
   * — خطأُ سنةٍ كاملة في كل مقارنةٍ تعبر رأس السنة.
   */
  it("يعبر رأس السنة نزولاً: يناير ناقص شهر = ديسمبر السابقة", () => {
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
    });
  });

  it("يطرح سنةً كاملة", () => {
    expect(addMonths({ year: 2026, month: 3 }, -12)).toEqual({
      year: 2025,
      month: 3,
    });
  });

  it("يطرح أكثر من سنة عبر رأس السنة", () => {
    expect(addMonths({ year: 2026, month: 2 }, -14)).toEqual({
      year: 2024,
      month: 12,
    });
  });

  it("الصفر لا يغيّر شيئاً", () => {
    expect(addMonths({ year: 2026, month: 9 }, 0)).toEqual({
      year: 2026,
      month: 9,
    });
  });
});

describe("monthsBetween", () => {
  it("يحسب الفارق داخل السنة", () => {
    expect(
      monthsBetween({ year: 2026, month: 9 }, { year: 2026, month: 12 }),
    ).toBe(3);
  });

  it("يحسب الفارق عبر السنوات", () => {
    expect(
      monthsBetween({ year: 2025, month: 11 }, { year: 2026, month: 2 }),
    ).toBe(3);
  });

  it("الفارقُ سالبٌ حين ينعكس الترتيب", () => {
    expect(
      monthsBetween({ year: 2026, month: 12 }, { year: 2026, month: 9 }),
    ).toBe(-3);
  });
});

describe("comparisonMonth — §34", () => {
  it("الشهرُ السابق مباشرةً", () => {
    expect(comparisonMonth({ year: 2026, month: 1 }, "previousMonth")).toEqual({
      year: 2025,
      month: 12,
    });
  });

  /*
   * سبتمبر شهرُ تسجيلٍ وديسمبر شهرُ عطلة. فمقارنةُ ديسمبر بنوفمبر
   * تُظهر انهياراً موسمياً كأنّه تدهورُ أداء — وهذا الوضعُ وحده
   * يعزل الموسمية.
   */
  it("نفسُ الشهر من السنة الماضية", () => {
    expect(
      comparisonMonth({ year: 2026, month: 9 }, "sameMonthLastYear"),
    ).toEqual({ year: 2025, month: 9 });
  });
});

describe("comparisonRange — §34", () => {
  it("المدى السابق بنفس الطول ينتهي قُبيل بداية الحالي", () => {
    const previous = comparisonRange(
      { from: at(2026, 9, 1), to: at(2026, 9, 30) },
      "previousPeriod",
    );

    expect(previous.to.getMonth()).toBe(7);
    expect(previous.to.getDate()).toBe(31);
    expect(previous.from.getMonth()).toBe(7);
    expect(previous.from.getDate()).toBe(2);
  });

  it("مدى يومٍ واحد يقابله اليومُ السابق", () => {
    const previous = comparisonRange(
      { from: at(2026, 9, 15), to: at(2026, 9, 15) },
      "previousPeriod",
    );

    expect(previous.from.getDate()).toBe(14);
    expect(previous.to.getDate()).toBe(14);
  });

  it("نفسُ المدى من السنة الماضية", () => {
    const previous = comparisonRange(
      { from: at(2026, 9, 1), to: at(2026, 9, 30) },
      "sameMonthLastYear",
    );

    expect(previous.from.getFullYear()).toBe(2025);
    expect(previous.to.getFullYear()).toBe(2025);
    expect(previous.from.getMonth()).toBe(8);
  });
});

describe("isBeforePeriod — أساس الدَّين القديم", () => {
  it("فاتورةُ شهرٍ سابق دَينٌ قديم", () => {
    expect(
      isBeforePeriod({ year: 2026, month: 9 }, { year: 2026, month: 11 }),
    ).toBe(true);
  });

  it("فاتورةُ نفس الشهر ليست قديمة", () => {
    expect(
      isBeforePeriod({ year: 2026, month: 11 }, { year: 2026, month: 11 }),
    ).toBe(false);
  });

  it("فاتورةٌ مسبقة لشهرٍ قادم ليست قديمة", () => {
    expect(
      isBeforePeriod({ year: 2026, month: 12 }, { year: 2026, month: 11 }),
    ).toBe(false);
  });

  it("يعبر رأس السنة", () => {
    expect(
      isBeforePeriod({ year: 2025, month: 12 }, { year: 2026, month: 1 }),
    ).toBe(true);
  });
});

describe("academicYearMonths", () => {
  /*
   * الأشهرُ تُولَّد من حدود السنة المخزَّنة لا من افتراضِ اثني عشر
   * شهراً تبدأ بسبتمبر. المؤسسةُ تضبط سنتها، والرسمُ البياني يعرض
   * أشهرَها هي.
   */
  it("يولّد أشهر سنةٍ من سبتمبر إلى يونيو", () => {
    const months = academicYearMonths({
      id: "ay1",
      name: "2026/2027",
      startDate: at(2026, 9, 1),
      endDate: at(2027, 6, 30),
    });

    expect(months).toHaveLength(10);
    expect(months[0]).toEqual({ year: 2026, month: 9 });
    expect(months[9]).toEqual({ year: 2027, month: 6 });
  });

  it("سنةٌ داخل شهرٍ واحد تُنتج شهراً واحداً", () => {
    const months = academicYearMonths({
      id: "ay2",
      name: "قصيرة",
      startDate: at(2026, 9, 1),
      endDate: at(2026, 9, 30),
    });

    expect(months).toEqual([{ year: 2026, month: 9 }]);
  });

  it("حدودٌ معكوسة لا تُسقط الحساب", () => {
    const months = academicYearMonths({
      id: "ay3",
      name: "معطوبة",
      startDate: at(2026, 9, 1),
      endDate: at(2026, 6, 30),
    });

    expect(months).toHaveLength(1);
  });
});

describe("yearMonthKey", () => {
  it("يُصفّر الشهر ليصحّ الترتيب المعجمي", () => {
    expect(yearMonthKey({ year: 2026, month: 9 })).toBe("2026-09");
  });

  it("سبتمبر يسبق أكتوبر نصّياً", () => {
    const keys = [
      yearMonthKey({ year: 2026, month: 10 }),
      yearMonthKey({ year: 2026, month: 9 }),
    ].sort();

    expect(keys).toEqual(["2026-09", "2026-10"]);
  });
});

describe("yearMonthOf", () => {
  it("يستخرج الشهر 1-based من التاريخ", () => {
    expect(yearMonthOf(at(2026, 9, 15))).toEqual({ year: 2026, month: 9 });
  });
});
