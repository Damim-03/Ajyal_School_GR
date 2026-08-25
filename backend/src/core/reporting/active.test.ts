import { describe, expect, it } from "vitest";
import {
  activeDebtCollection,
  activeDebtShare,
  activeInvoice,
  activePayment,
  activeReceipt,
  activeSettlement,
  activeTeacherAllocation,
  activeTeacherPayment,
  cancelledInvoice,
  cancelledPayment,
  cancelledSettlement,
  cancelledTeacherPayment,
  committedDebtShare,
  committedSettlement,
} from "./active";

// ======================================================
// §52 — قواعد الاستثناء
//
// هذه ثوابتُ `where` لا دوالّ، فالاختبارُ لا يقيس حساباً بل يحرس
// نصّاً: تغييرُ حرفٍ في `"CANCELLED"` أو إضافةُ `DRAFT` إلى
// `committedSettlement` لا يُسقط أيَّ اختبارٍ آخر في المشروع، ولا
// يُنتج خطأً في وقت التشغيل — يُنتج تقريراً يبدو سليماً وأرقامُه
// خاطئة.
//
// فالغرضُ من هذا الملف أن يُسقط البناءَ عند مثل ذلك التغيير، لا
// أن يبرهن على شيءٍ رياضي.
// ======================================================

describe("الفواتير — §52.2", () => {
  it("النشط يستثني الملغى", () => {
    expect(activeInvoice).toEqual({ status: { not: "CANCELLED" } });
  });

  /*
   * النشطُ والملغى متكاملان لا متداخلان: كلُّ فاتورةٍ في أحدهما
   * حصراً. وتداخلُهما يعني احتسابَ صفٍّ مرّتين في تقريرٍ يجمعهما.
   */
  it("النشط والملغى متكاملان", () => {
    expect(cancelledInvoice).toEqual({ status: "CANCELLED" });
    expect(activeInvoice.status).not.toEqual(cancelledInvoice.status);
  });
});

describe("دفعات الطلبة — §52.1", () => {
  it("النشط هو ACTIVE صراحةً", () => {
    expect(activePayment).toEqual({ status: "ACTIVE" });
    expect(cancelledPayment).toEqual({ status: "CANCELLED" });
  });
});

describe("دفعات الأساتذة — §52.3 و§52.5", () => {
  it("لها شرطُها المستقلّ عن دفعات الطلبة", () => {
    expect(activeTeacherPayment).toEqual({ status: "ACTIVE" });
    expect(cancelledTeacherPayment).toEqual({ status: "CANCELLED" });
  });
});

describe("التخليص — §52.4", () => {
  /*
   * الفرقُ بين «النشط» و«الملتزَم به» هو الفرقُ بين حسابٍ ومطلوب.
   *
   * المسوّدةُ استحقاقٌ حُسب ولم يُعتمد. إدخالُها في «الواجب دفعه»
   * يُظهر ديناً وهمياً على المؤسسة لأستاذٍ لم يُقرّ استحقاقُه بعد
   * — وقد يكون التخليصُ حُسب للتجربة ثم أُهمل.
   */
  it("النشط يشمل المسوّدة", () => {
    expect(activeSettlement).toEqual({ status: { not: "CANCELLED" } });
  });

  it("الملتزَم به يستثني المسوّدة", () => {
    expect(committedSettlement).toEqual({ status: { in: ["CONFIRMED", "PAID"] } });
    expect(committedSettlement.status.in).not.toContain("DRAFT");
    expect(committedSettlement.status.in).not.toContain("CANCELLED");
  });
});

describe("حصص الدَّين — §52.8", () => {
  it("النشط يستثني الملغى ويشمل المعلّق", () => {
    expect(activeDebtShare).toEqual({ status: { not: "CANCELLED" } });
  });

  it("الملتزَم به يستثني المعلّق", () => {
    expect(committedDebtShare.status.in).toEqual(["APPROVED", "PAID"]);
    expect(committedDebtShare.status.in).not.toContain("PENDING");
  });
});

describe("الكيانات التابعة", () => {
  /*
   * `DebtCollection` و `TeacherPaymentAllocation` بلا حقلِ حالة:
   * حياتُهما من حياة الدفعة التي أنشأتهما. فالشرطُ يمرّ عبر
   * العلاقة، وإلغاءُ الدفعة يُخرجهما من المجاميع تلقائياً.
   */
  it("تحصيلُ الدَّين يرث حالةَ دفعته", () => {
    expect(activeDebtCollection).toEqual({ payment: { status: "ACTIVE" } });
  });

  it("تخصيصُ دفعة الأستاذ يرث حالةَ دفعته", () => {
    expect(activeTeacherAllocation).toEqual({
      teacherPayment: { status: "ACTIVE" },
    });
  });
});

describe("الإيصالات — §24", () => {
  it("الملغى يخرج من العدّ ويبقى في التدقيق", () => {
    expect(activeReceipt).toEqual({ status: { not: "CANCELLED" } });
  });
});
