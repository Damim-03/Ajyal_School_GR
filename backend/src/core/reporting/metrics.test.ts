import { describe, expect, it } from "vitest";
import {
  allocationGap,
  attendance,
  cashCollected,
  cashFlow,
  countsFromGroupBy,
  debt,
  debtAgeBucket,
  debtAgeInMonths,
  emptyAttendanceCounts,
  invoicing,
  mergeAttendanceCounts,
  teacherFinancials,
} from "./metrics";

// ======================================================
// §74 — الحالات الحديّة
//
// تُختبر هنا قبل وجود بيانات: الدوالُّ نقيّة تأخذ أعداداً مجمّعة،
// فالمؤسسةُ الفارغة والمؤسسةُ الكبيرة سواءٌ في الاستدعاء.
// ======================================================

describe("invoicing — الفوترة والتحصيل", () => {
  it("يحسب الحالة الطبيعية", () => {
    const result = invoicing({
      invoicedTotal: "980000.00",
      remainingTotal: "270000.00",
      discountTotal: "15000.00",
      invoiceCount: 428,
    });

    expect(result.invoiced).toBe(980000);
    expect(result.collected).toBe(710000);
    expect(result.outstanding).toBe(270000);
    expect(result.collectionRate).toBe(72.45);
  });

  // §74: لا فواتير
  it("مؤسسةٌ بلا فواتير: أصفارٌ ونسبةٌ غير محسوبة", () => {
    const result = invoicing({ invoicedTotal: null, remainingTotal: null });

    expect(result.invoiced).toBe(0);
    expect(result.collected).toBe(0);
    expect(result.collectionRate).toBeNull();
  });

  // §74: صفر إيراد
  it("فواتيرُ كلُّها غير مسدَّدة: نسبة تحصيل صفر لا null", () => {
    const result = invoicing({
      invoicedTotal: "50000",
      remainingTotal: "50000",
    });

    expect(result.collected).toBe(0);
    expect(result.collectionRate).toBe(0);
  });

  it("تحصيلٌ كامل: 100%", () => {
    const result = invoicing({ invoicedTotal: "50000", remainingTotal: "0" });
    expect(result.collectionRate).toBe(100);
  });

  // §74: سداد جزئي
  it("سدادٌ جزئي يُحسب بدقّة عشرية", () => {
    const result = invoicing({
      invoicedTotal: "1000.00",
      remainingTotal: "333.33",
    });

    expect(result.collected).toBe(666.67);
    expect(result.collectionRate).toBe(66.67);
  });
});

describe("cashCollected — النقد الداخل", () => {
  it("يحسب المتوسّط", () => {
    const result = cashCollected({ paymentTotal: "30000", paymentCount: 4 });
    expect(result.average).toBe(7500);
  });

  // §74: لا دفعات
  it("لا دفعات: المتوسّط null لا صفر", () => {
    const result = cashCollected({ paymentTotal: null, paymentCount: 0 });

    expect(result.total).toBe(0);
    expect(result.average).toBeNull();
  });

  /*
   * §74: «دفعاتٌ كلُّها ملغاة».
   *
   * لا يُختبر هنا شرطُ الاستبعاد — ذاك في active.ts ويُختبر بالنوع.
   * المُختبَر أنّ الاستبعاد حين يُطبَّق لا يُنتج قسمةً على صفر:
   * الاستدعاءُ يصل بمجموعٍ null وعددٍ صفر، وهو ما تفعله Prisma حين
   * لا يطابق الشرطُ صفّاً.
   */
  it("كلُّ الدفعات ملغاة: يصل المجموع فارغاً ولا ينكسر", () => {
    expect(cashCollected({ paymentTotal: null, paymentCount: 0 })).toEqual({
      total: 0,
      count: 0,
      average: null,
    });
  });
});

describe("debt — الديون", () => {
  it("يفصل الجاري عن القديم", () => {
    const result = debt({
      currentRemaining: "80000",
      previousRemaining: "190000",
      studentsInDebt: 37,
      collectedOld: "45000",
    });

    expect(result.total).toBe(270000);
    expect(result.current).toBe(80000);
    expect(result.old).toBe(190000);
    expect(result.collectedOld).toBe(45000);
  });

  /*
   * نسبةُ الاسترداد على حجم الدَّين القديم **قبل** التحصيل.
   * 45000 من (190000 + 45000) = 19.15%. وقسمتُها على المتبقّي
   * وحده كانت ستُنتج 23.68% — نسبةً تتجاوز 100% متى حُصِّل أكثر
   * ممّا بقي.
   */
  it("نسبة الاسترداد تُنسب إلى الدَّين قبل التحصيل", () => {
    const result = debt({
      currentRemaining: 0,
      previousRemaining: "190000",
      collectedOld: "45000",
    });

    expect(result.oldRecoveryRate).toBe(19.15);
  });

  it("استردادٌ كامل للدَّين القديم: 100% لا أكثر", () => {
    const result = debt({
      currentRemaining: 0,
      previousRemaining: "0",
      collectedOld: "50000",
    });

    expect(result.oldRecoveryRate).toBe(100);
  });

  it("لا ديون قديمة ولا تحصيل: النسبة غير محسوبة", () => {
    const result = debt({ currentRemaining: 0, previousRemaining: 0 });
    expect(result.oldRecoveryRate).toBeNull();
  });
});

describe("debtAge — تعتيق الدَّين", () => {
  it("يحسب العمر على الشهر والسنة لا على التواريخ", () => {
    expect(
      debtAgeInMonths({ month: 9, year: 2026 }, { month: 12, year: 2026 }),
    ).toBe(3);
  });

  it("يعبر رأس السنة بصحّة", () => {
    expect(
      debtAgeInMonths({ month: 11, year: 2026 }, { month: 2, year: 2027 }),
    ).toBe(3);
  });

  it("يصنّف الشرائح", () => {
    expect(debtAgeBucket(0)).toBe("current");
    expect(debtAgeBucket(1)).toBe("d30");
    expect(debtAgeBucket(3)).toBe("d90");
    expect(debtAgeBucket(7)).toBe("older");
  });

  /*
   * العمرُ السالب ممكن: فاتورةٌ مسبقة لشهرٍ قادم. تُصنَّف «جارية»
   * لا تُسقط الحساب.
   */
  it("عمرٌ سالب (فاتورة مسبقة) يُصنَّف جارياً", () => {
    expect(debtAgeBucket(-2)).toBe("current");
  });
});

describe("attendance — الحضور", () => {
  it("المتأخّر يُحتسب حاضراً", () => {
    const result = attendance({
      PRESENT: 80,
      ABSENT: 10,
      LATE: 5,
      EXCUSED: 5,
    });

    expect(result.attended).toBe(85);
    expect(result.attendanceRate).toBe(85);
    expect(result.lateRate).toBe(5);
  });

  /*
   * المعذورُ يبقى في المقام.
   *
   * فوجٌ نصفُه بأعذار: 50 حاضراً و50 معذوراً. النسبةُ 50% لا 100%
   * — ووظيفةُ المؤشّر كشفُ الفجوة لا تجميلُها. ومن أراد قياسَ
   * الانضباط وحده فله النسبةُ الأخرى صريحةً باسمها.
   */
  it("المعذور يبقى في المقام، والنسبة بلا أعذار تُعرض منفصلة", () => {
    const result = attendance({
      PRESENT: 50,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 50,
    });

    expect(result.attendanceRate).toBe(50);
    expect(result.attendanceRateExcused).toBe(100);
  });

  // §74: لا سجلّات حضور
  it("لا سجلّات: كل النسب null لا صفر", () => {
    const result = attendance(emptyAttendanceCounts());

    expect(result.total).toBe(0);
    expect(result.attendanceRate).toBeNull();
    expect(result.absenceRate).toBeNull();
  });

  /*
   * الفرقُ الذي يمنع تنبيهاً كاذباً في §7:
   * فوجٌ غاب كلُّ طلبته حضورُه 0%، وفوجٌ لم يبدأ الدراسة حضورُه
   * غيرُ محسوب. الخلطُ بينهما ينبّه على فوجٍ لا مشكلةَ فيه.
   */
  it("يميّز الغيابَ الكامل عن غياب السجلّات", () => {
    const allAbsent = attendance({
      PRESENT: 0,
      ABSENT: 30,
      LATE: 0,
      EXCUSED: 0,
    });
    const noRecords = attendance(emptyAttendanceCounts());

    expect(allAbsent.attendanceRate).toBe(0);
    expect(noRecords.attendanceRate).toBeNull();
  });

  it("كلُّ السجلّات أعذار: النسبة بلا أعذار غير محسوبة", () => {
    const result = attendance({
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 20,
    });

    expect(result.attendanceRate).toBe(0);
    expect(result.attendanceRateExcused).toBeNull();
  });
});

describe("countsFromGroupBy", () => {
  /*
   * Prisma لا تُرجع صفّاً للحالة التي لا يطابقها سجلّ. والقراءةُ
   * المباشرة من النتيجة تُنتج undefined يتسرّب إلى الجمع فيصير NaN.
   */
  it("يملأ الحالات الغائبة بأصفار", () => {
    const counts = countsFromGroupBy([
      { status: "PRESENT", _count: 40 },
      { status: "ABSENT", _count: 3 },
    ]);

    expect(counts).toEqual({ PRESENT: 40, ABSENT: 3, LATE: 0, EXCUSED: 0 });
    expect(attendance(counts).total).toBe(43);
  });

  it("نتيجةٌ فارغة تُنتج عدّاداً صفرياً كاملاً", () => {
    expect(countsFromGroupBy([])).toEqual(emptyAttendanceCounts());
  });
});

describe("mergeAttendanceCounts", () => {
  it("يجمع عدّة مصادر", () => {
    const merged = mergeAttendanceCounts([
      { PRESENT: 10, ABSENT: 1, LATE: 0, EXCUSED: 0 },
      { PRESENT: 5, ABSENT: 2, LATE: 3, EXCUSED: 1 },
    ]);

    expect(merged).toEqual({ PRESENT: 15, ABSENT: 3, LATE: 3, EXCUSED: 1 });
  });
});

describe("teacherFinancials — مستحقّ الأستاذ", () => {
  /*
   * المستحقُّ من مصدرين. وإغفالُ حصص الدَّين يُنقص مستحقَّ كلِّ
   * أستاذٍ درّس فترةً لم تُحصَّل ديونُها إلا لاحقاً — وهو الغالب.
   */
  it("يجمع التخليص وحصص الدَّين معاً", () => {
    const result = teacherFinancials({
      settlementEntitlement: "8000",
      debtShareEntitlement: "1875",
      allocatedPaid: "9875",
    });

    expect(result.entitlement).toBe(9875);
    expect(result.fromSettlements).toBe(8000);
    expect(result.fromDebtShares).toBe(1875);
    expect(result.outstanding).toBe(0);
    expect(result.paidRate).toBe(100);
  });

  it("مستحقٌّ لم يُدفع بعد", () => {
    const result = teacherFinancials({
      settlementEntitlement: "8000",
      allocatedPaid: "0",
    });

    expect(result.outstanding).toBe(8000);
    expect(result.paidRate).toBe(0);
  });

  // §74: أستاذٌ بلا نشاط
  it("أستاذٌ بلا استحقاق: نسبةٌ غير محسوبة", () => {
    const result = teacherFinancials({
      settlementEntitlement: null,
      allocatedPaid: null,
    });

    expect(result.entitlement).toBe(0);
    expect(result.paidRate).toBeNull();
  });

  /*
   * دفعةٌ تتجاوز المستحقّ تُنتج متبقّياً سالباً — ولا تُقصّ إلى
   * صفر. الرقمُ السالب إشارةٌ إلى خللٍ يجب أن تراه الإدارة في §39،
   * وإخفاؤه بـ`Math.max(0, …)` يدفن المشكلة.
   */
  it("الدفع الزائد يظهر متبقّياً سالباً لا مقصوصاً", () => {
    const result = teacherFinancials({
      settlementEntitlement: "5000",
      allocatedPaid: "6000",
    });

    expect(result.outstanding).toBe(-1000);
  });
});

describe("allocationGap — §32 و§39", () => {
  it("دفعةٌ مخصَّصة بالكامل متوازنة", () => {
    const result = allocationGap({
      paymentAmount: "9875",
      allocatedAmount: "9875",
    });

    expect(result.isBalanced).toBe(true);
    expect(result.unallocated).toBe(0);
  });

  it("يكشف ديناراً دُفع بلا مقابلٍ معروف", () => {
    const result = allocationGap({
      paymentAmount: "9875",
      allocatedAmount: "8000",
    });

    expect(result.isBalanced).toBe(false);
    expect(result.unallocated).toBe(1875);
  });

  it("تخصيصٌ يتجاوز الدفعة يُكشف أيضاً", () => {
    const result = allocationGap({
      paymentAmount: "8000",
      allocatedAmount: "9875",
    });

    expect(result.isBalanced).toBe(false);
    expect(result.unallocated).toBe(-1875);
  });
});

describe("cashFlow — §33", () => {
  it("يحسب الحركة الصافية", () => {
    const result = cashFlow({
      studentPayments: "710000",
      debtCollections: "45000",
      teacherPayments: "285000",
    });

    expect(result.moneyIn).toBe(710000);
    expect(result.moneyOut).toBe(285000);
    expect(result.netMovement).toBe(425000);
    expect(result.teacherCostRatio).toBe(40.14);
  });

  /*
   * تحصيلُ الدَّين **ليس** إضافةً على الوارد.
   *
   * التحصيلُ واقعةٌ مشتقّة من دفعةٍ محسوبةٍ سلفاً في
   * studentPayments، فجمعُهما يحتسب الدينارَ مرّتين. هنا 45000
   * جزءٌ من 710000 لا زيادةٌ عليها.
   */
  it("تحصيل الدَّين تفصيلٌ داخل الوارد لا زيادةٌ عليه", () => {
    const result = cashFlow({
      studentPayments: "710000",
      debtCollections: "45000",
      teacherPayments: "0",
    });

    expect(result.moneyIn).toBe(710000);
    expect(result.ofWhichDebtCollection).toBe(45000);
  });

  it("خروجٌ يفوق الدخول: حركةٌ سالبة تُعرض كما هي", () => {
    const result = cashFlow({
      studentPayments: "100000",
      teacherPayments: "140000",
    });

    expect(result.netMovement).toBe(-40000);
  });

  // §74: صفر إيراد
  it("لا وارد: نسبة كلفة الأساتذة غير محسوبة", () => {
    const result = cashFlow({ studentPayments: 0, teacherPayments: "50000" });

    expect(result.netMovement).toBe(-50000);
    expect(result.teacherCostRatio).toBeNull();
  });

  // §74: مؤسسةٌ فارغة تماماً
  it("لا حركة إطلاقاً", () => {
    const result = cashFlow({ studentPayments: null, teacherPayments: null });

    expect(result.netMovement).toBe(0);
    expect(result.teacherCostRatio).toBeNull();
  });
});
