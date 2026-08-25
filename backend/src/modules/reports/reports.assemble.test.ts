import { describe, expect, it } from "vitest";
import {
  assembleAttendanceChart,
  assembleAttendanceSummary,
  assembleCashFlowSummary,
  assembleDebtSummary,
  assembleFinancialSummary,
  assembleInvoiceStatusChart,
  assembleMonthlyFinancialChart,
  assemblePaymentMethodChart,
  assembleTeacherSummary,
} from "./reports.assemble";
import type { FinancialSnapshot, TeacherSnapshot } from "./reports.queries";

// ======================================================
// لقطاتٌ مصنوعة يدوياً.
//
// هذه ليست بياناتٍ وهمية بالمعنى الذي تمنعه §64: لا تُعرض على
// مستخدم ولا تدخل استجابةً. هي مدخلاتُ اختبارٍ للدوالّ النقيّة —
// وهي الطريقةُ الوحيدة لاختبار «هل استُثني الملغى» قبل وجود بياناتٍ
// أصلاً.
// ======================================================

const financialSnapshot = (
  overrides: Partial<FinancialSnapshot> = {},
): FinancialSnapshot =>
  ({
    invoices: {
      invoicedTotal: "980000.00",
      remainingTotal: "270000.00",
      discountTotal: "15000.00",
      invoiceCount: 428,
    },
    payments: { paymentTotal: "710000.00", paymentCount: 96 },
    methods: [],
    byMonth: [],
    byStatus: [],
    cancelledInvoices: 4,
    oldDebt: { oldRemaining: "190000.00", oldInvoiceCount: 61 },
    ...overrides,
  }) as unknown as FinancialSnapshot;

const teacherSnapshot = (
  overrides: Record<string, unknown> = {},
): TeacherSnapshot =>
  ({
    settlements: { settlementEntitlement: "285000.00", settlementCount: 22 },
    debtShares: { debtShareEntitlement: "18750.00", debtShareCount: 9 },
    allocations: { allocatedPaid: "250000.00", allocationCount: 30 },
    payments: { teacherPaymentTotal: "250000.00", teacherPaymentCount: 18 },
    byStatus: [],
    ...overrides,
  }) as unknown as TeacherSnapshot;

describe("assembleFinancialSummary", () => {
  it("يبني البطاقات بتعريفاتها", () => {
    const summary = assembleFinancialSummary({ current: financialSnapshot() });

    expect(summary.invoiced.value).toBe(980000);
    expect(summary.collected.value).toBe(710000);
    expect(summary.outstanding.value).toBe(270000);
    expect(summary.collectionRate.value).toBe(72.45);
    expect(summary.invoiced.definition?.label).toBe("إجمالي المفوتر");
  });

  /*
   * §21: الملغى يُعرض عدداً ولا يدخل أيَّ مجموعٍ مالي.
   *
   * إخفاؤه كلّياً يمنع ملاحظةَ إلغاءٍ غير معتاد، وإدخالُه في
   * المجاميع يكذب. فالعدُّ وحده — وهذا الاختبار يحرس الفرق.
   */
  it("الفواتير الملغاة عددٌ لا مبلغ", () => {
    const summary = assembleFinancialSummary({ current: financialSnapshot() });

    expect(summary.cancelledInvoices.value).toBe(4);
    expect(summary.invoiced.value).toBe(980000);
  });

  it("يحسب المقارنة حين تُعطى فترةٌ سابقة", () => {
    const summary = assembleFinancialSummary({
      current: financialSnapshot(),
      previous: financialSnapshot({
        invoices: {
          invoicedTotal: "870000.00",
          remainingTotal: "300000.00",
          discountTotal: "0",
          invoiceCount: 400,
        },
      } as never),
    });

    expect(summary.invoiced.comparison?.previous).toBe(870000);
    expect(summary.invoiced.comparison?.absolute).toBe(110000);
    expect(summary.invoiced.comparison?.percentage).toBe(12.64);
  });

  it("بلا فترةٍ سابقة لا حقلَ مقارنة", () => {
    const summary = assembleFinancialSummary({ current: financialSnapshot() });
    expect(summary.invoiced.comparison).toBeUndefined();
  });

  // §74: مؤسسةٌ فارغة
  it("مؤسسةٌ بلا فواتير: أصفارٌ ونسبةٌ غير محسوبة", () => {
    const summary = assembleFinancialSummary({
      current: financialSnapshot({
        invoices: {
          invoicedTotal: null,
          remainingTotal: null,
          discountTotal: null,
          invoiceCount: 0,
        },
        payments: { paymentTotal: null, paymentCount: 0 },
        cancelledInvoices: 0,
      } as never),
    });

    expect(summary.invoiced.value).toBe(0);
    expect(summary.collectionRate.value).toBeNull();
    expect(summary.averagePayment.value).toBeNull();
  });

  /*
   * §74: مقارنةٌ بفترةٍ صفرية.
   *
   * المطلقُ يُحسب والنسبةُ `null`: مؤسسةٌ انتقلت من صفر إلى 980
   * ألفاً نموُّها ليس «+∞%».
   */
  it("مقارنةٌ بصفر: مطلقٌ بلا نسبة", () => {
    const summary = assembleFinancialSummary({
      current: financialSnapshot(),
      previous: financialSnapshot({
        invoices: {
          invoicedTotal: null,
          remainingTotal: null,
          discountTotal: null,
          invoiceCount: 0,
        },
      } as never),
    });

    expect(summary.invoiced.comparison?.absolute).toBe(980000);
    expect(summary.invoiced.comparison?.percentage).toBeNull();
  });
});

describe("assembleDebtSummary", () => {
  /*
   * الجاري يُشتقّ طرحاً لا باستعلامٍ ثانٍ.
   *
   * استعلامان منفصلان قد يقعان على حدَّي فترةٍ مختلفين إن تغيّرت
   * الساعةُ بينهما، فيظهر مجموعٌ لا يساوي جمعَ جزأيه — أسوأُ ما
   * يُرى في تقريرٍ مالي.
   */
  it("الجاري = الكلّ ناقص القديم، والمجموع يطابق جزأيه", () => {
    const summary = assembleDebtSummary(financialSnapshot(), {
      studentsInDebt: 37,
      collectedOld: "45000.00",
    });

    expect(summary.debtTotal.value).toBe(270000);
    expect(summary.debtOld.value).toBe(190000);
    expect(summary.debtCurrent.value).toBe(80000);
    expect(
      (summary.debtCurrent.value ?? 0) + (summary.debtOld.value ?? 0),
    ).toBe(summary.debtTotal.value);
  });

  it("يعدّ الطلبة المدينين لا الفواتير", () => {
    const summary = assembleDebtSummary(financialSnapshot(), {
      studentsInDebt: 37,
      collectedOld: "0",
    });

    expect(summary.studentsInDebt.value).toBe(37);
  });

  it("نسبة الاسترداد تُنسب إلى الدَّين قبل التحصيل", () => {
    const summary = assembleDebtSummary(financialSnapshot(), {
      studentsInDebt: 37,
      collectedOld: "45000.00",
    });

    expect(summary.oldRecoveryRate.value).toBe(19.15);
  });
});

describe("assembleTeacherSummary — §52.8 و§32", () => {
  /*
   * المستحقُّ من مصدرين. وإغفالُ حصص الدَّين يُنقص مستحقَّ كلِّ
   * أستاذٍ درّس فترةً حُصِّلت ديونُها لاحقاً — وهو الغالب.
   */
  it("يجمع التخليص وحصص الدَّين", () => {
    const summary = assembleTeacherSummary(teacherSnapshot());

    expect(summary.teacherEntitlement.value).toBe(303750);
    expect(summary.teacherFromSettlements.value).toBe(285000);
    expect(summary.teacherFromDebtShares.value).toBe(18750);
  });

  it("المتبقّي = المستحقّ ناقص المخصَّص", () => {
    const summary = assembleTeacherSummary(teacherSnapshot());
    expect(summary.teacherOutstanding.value).toBe(53750);
  });

  /*
   * §32 و§39: الفجوةُ بين مجموع الدفعات ومجموع التخصيصات ينبغي
   * أن تكون صفراً. وظهورُها يعني ديناراً دُفع بلا بيانِ مقابله.
   */
  it("الفجوةُ صفرٌ حين تطابق التخصيصاتُ الدفعات", () => {
    expect(
      assembleTeacherSummary(teacherSnapshot()).unallocatedTeacherPayment.value,
    ).toBe(0);
  });

  it("يكشف دفعةً غير مخصَّصة", () => {
    const summary = assembleTeacherSummary(
      teacherSnapshot({
        payments: { teacherPaymentTotal: "260000.00", teacherPaymentCount: 19 },
      }),
    );

    expect(summary.unallocatedTeacherPayment.value).toBe(10000);
  });

  // §74: أستاذٌ بلا نشاط
  it("بلا تخليصٍ ولا دفعات: أصفار", () => {
    const summary = assembleTeacherSummary(
      teacherSnapshot({
        settlements: { settlementEntitlement: null, settlementCount: 0 },
        debtShares: { debtShareEntitlement: null, debtShareCount: 0 },
        allocations: { allocatedPaid: null, allocationCount: 0 },
        payments: { teacherPaymentTotal: null, teacherPaymentCount: 0 },
      }),
    );

    expect(summary.teacherEntitlement.value).toBe(0);
    expect(summary.teacherOutstanding.value).toBe(0);
  });
});

describe("assembleCashFlowSummary — §33", () => {
  it("يحسب الحركة الصافية ولا يسمّيها ربحاً", () => {
    const summary = assembleCashFlowSummary({
      studentPayments: "710000.00",
      debtCollections: "45000.00",
      teacherPayments: "250000.00",
    });

    expect(summary.netCashMovement.value).toBe(460000);
    expect(summary.netCashMovement.definition?.label).toBe("صافي حركة النقد");
    expect(summary.netCashMovement.definition?.caveat).toContain("ليس ربحاً");
  });

  /*
   * تحصيلُ الدَّين تفصيلٌ داخل الوارد لا زيادةٌ عليه: هو واقعةٌ
   * مشتقّة من دفعةٍ محسوبةٍ سلفاً، وجمعُهما يحتسب الدينارَ مرّتين.
   */
  it("تحصيل الدَّين لا يُضاف إلى الوارد", () => {
    const summary = assembleCashFlowSummary({
      studentPayments: "710000.00",
      debtCollections: "45000.00",
      teacherPayments: "0",
    });

    expect(summary.moneyIn.value).toBe(710000);
    expect(summary.ofWhichDebtCollection.value).toBe(45000);
  });
});

describe("assembleAttendanceSummary", () => {
  it("يبني النسب", () => {
    const summary = assembleAttendanceSummary({
      PRESENT: 800,
      ABSENT: 60,
      LATE: 40,
      EXCUSED: 100,
    });

    expect(summary.attendanceRate.value).toBe(84);
    expect(summary.attendanceRecords.value).toBe(1000);
  });

  // §74: لا سجلّات حضور
  it("بلا سجلّات: النسب null", () => {
    const summary = assembleAttendanceSummary({
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    });

    expect(summary.attendanceRate.value).toBeNull();
    expect(summary.attendanceRecords.value).toBe(0);
  });
});

describe("الرسوم", () => {
  it("السلسلة الشهرية تحسب المحصَّل طرحاً", () => {
    const result = assembleMonthlyFinancialChart([
      {
        year: 2026,
        month: 9,
        _sum: { total: "100000", remaining: "30000" },
        _count: 50,
      },
      {
        year: 2026,
        month: 10,
        _sum: { total: "120000", remaining: "20000" },
        _count: 60,
      },
    ]);

    expect(result.categories).toEqual(["2026-09", "2026-10"]);
    expect(result.series[1].data).toEqual([70000, 100000]);
    expect(result.isEmpty).toBe(false);
  });

  it("سلسلةٌ بلا صفوف فارغة", () => {
    expect(assembleMonthlyFinancialChart([]).isEmpty).toBe(true);
  });

  it("توزيعُ الحالات يحمل وجهةَ التنقيب — §40", () => {
    const result = assembleInvoiceStatusChart([
      { status: "PAID", _sum: { total: "700000" }, _count: 300 },
      { status: "PENDING", _sum: { total: "280000" }, _count: 128 },
    ]);

    expect(result.drill?.param).toBe("invoiceStatus");
    expect(result.drill?.categoryIds).toEqual(["PENDING", "PAID"]);
    expect(result.categories).toEqual(["معلَّقة", "مسدَّدة"]);
  });

  it("لا يعرض حالةً لا صفَّ لها", () => {
    const result = assembleInvoiceStatusChart([
      { status: "PAID", _sum: { total: "700000" }, _count: 300 },
    ]);

    expect(result.categories).toEqual(["مسدَّدة"]);
  });

  it("طرقُ الدفع تُترجَم وتحمل وجهتها", () => {
    const result = assemblePaymentMethodChart([
      { paymentMethod: "CASH", _sum: { amount: "600000" }, _count: 80 },
      { paymentMethod: "BANK_TRANSFER", _sum: { amount: "110000" }, _count: 16 },
    ]);

    expect(result.categories).toEqual(["نقداً", "تحويل بنكي"]);
    expect(result.series[0].data).toEqual([600000, 110000]);
  });

  it("رسمُ الحضور يعرض الحالات الأربع دائماً", () => {
    const result = assembleAttendanceChart({
      PRESENT: 800,
      ABSENT: 60,
      LATE: 40,
      EXCUSED: 100,
    });

    expect(result.categories).toHaveLength(4);
    expect(result.series[0].data).toEqual([800, 60, 40, 100]);
  });

  /*
   * أصفارٌ ليست فراغاً — §48. فوجٌ بلا غيابٍ يُعرض رسماً صحيحاً،
   * وفوجٌ بلا سجلّاتٍ يُعرض حالةً فارغة.
   */
  it("حضورٌ كلُّه أصفار رسمٌ صحيح لا فراغ", () => {
    const result = assembleAttendanceChart({
      PRESENT: 0,
      ABSENT: 0,
      LATE: 0,
      EXCUSED: 0,
    });

    expect(result.isEmpty).toBe(false);
  });
});
