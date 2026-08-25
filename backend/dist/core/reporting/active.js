"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeTeacherAllocation = exports.activeDebtCollection = exports.activeReceipt = exports.committedDebtShare = exports.activeDebtShare = exports.cancelledSettlement = exports.committedSettlement = exports.activeSettlement = exports.cancelledTeacherPayment = exports.activeTeacherPayment = exports.cancelledPayment = exports.activePayment = exports.cancelledInvoice = exports.activeInvoice = void 0;
// ======================================================
// «النشط» — استثناءُ الملغى، §52
//
// القواعد الاثنتا عشرة في §52 تتكرّر في كل استعلامٍ مالي، وتكرارُها
// نصّاً يعني أنّ إغفالَها مرّةً واحدة يُنتج تقريراً يعدّ فاتورةً
// ملغاةً ضمن الإيراد. ولا يكشفه اختبار: الرقم يبدو معقولاً، وإنّما
// يزيد قليلاً.
//
// فتُعرَّف هنا مرّةً كشرائحِ `where` تُدمج في كل استعلام. ومن أراد
// الملغى — شاشةُ الإلغاءات §38 وسجلُّ التدقيق §37 — استعمل
// `cancelledOnly` صراحةً. أي أنّ رؤية الملغى قرارٌ يُكتب، لا سهوٌ
// يقع.
//
// و«الملغى يُستثنى من المجاميع ولا يُحذف من التدقيق» ليست تفصيلاً
// تقنياً بل شرطُ مراجَعةٍ: السجلّ المالي يبقى كاملاً، والمجاميع
// وحدها تُصفّى.
// ======================================================
// --------------------------------------------------
// الفواتير — §52.2
// --------------------------------------------------
exports.activeInvoice = {
    status: { not: "CANCELLED" },
};
exports.cancelledInvoice = {
    status: "CANCELLED",
};
// --------------------------------------------------
// دفعات الطلبة — §52.1
//
// منفصلةٌ عن دفعات الأساتذة تماماً (§52.5): هذه واردٌ إلى المؤسسة،
// وتلك صادرٌ منها. وخلطُهما في مجموعٍ واحد يُنتج رقماً بلا معنى.
// --------------------------------------------------
exports.activePayment = {
    status: "ACTIVE",
};
exports.cancelledPayment = {
    status: "CANCELLED",
};
// --------------------------------------------------
// دفعات الأساتذة — §52.3
// --------------------------------------------------
exports.activeTeacherPayment = {
    status: "ACTIVE",
};
exports.cancelledTeacherPayment = {
    status: "CANCELLED",
};
// --------------------------------------------------
// التخليص — §52.4
//
// `activeSettlement` يشمل DRAFT: المسوّدة استحقاقٌ محسوبٌ لم
// يُعتمد بعد، فتدخل في «إجمالي المستحقّ» ولا تدخل في «الواجب
// دفعه». ولهذا `committedSettlement` منفصل — CONFIRMED و PAID
// وحدهما التزامٌ فعلي على المؤسسة.
//
// وخلطُهما يُنتج مطلوباً وهمياً: مسوّدةٌ حُسبت للتجربة تظهر ديناً
// على المؤسسة لأستاذٍ لم يُعتمد استحقاقُه.
// --------------------------------------------------
exports.activeSettlement = {
    status: { not: "CANCELLED" },
};
exports.committedSettlement = {
    status: { in: ["CONFIRMED", "PAID"] },
};
exports.cancelledSettlement = {
    status: "CANCELLED",
};
// --------------------------------------------------
// حصص الأساتذة من الديون المحصَّلة — §52.8
//
// CANCELLED تُستثنى، وPENDING تدخل في «المحسوب» لا في «الواجب».
// نفس منطق التخليص: الاعتمادُ هو ما يُحوّل الحسابَ إلى التزام.
// --------------------------------------------------
exports.activeDebtShare = {
    status: { not: "CANCELLED" },
};
exports.committedDebtShare = {
    status: { in: ["APPROVED", "PAID"] },
};
// --------------------------------------------------
// الإيصالات
//
// الإيصال الملغى يبقى في التدقيق (§24) ويخرج من العدّ الفعلي.
// --------------------------------------------------
exports.activeReceipt = {
    status: { not: "CANCELLED" },
};
// --------------------------------------------------
// تحصيلُ الدين يتبع دفعتَه — §52.6 و§52.7
//
// `DebtCollection` لا تحمل حالةً خاصّة بها؛ حياتُها من حياة الدفعة
// التي أنشأتها. فإلغاءُ الدفعة يُخرج التحصيلَ من المجاميع تلقائياً
// بلا حقلٍ إضافي.
//
// ولا يمسّ ذلك الفاتورةَ الأصلية: تحصيلُ دينٍ من سبتمبر في نوفمبر
// واقعةٌ في نوفمبر، وإيرادُ سبتمبر يبقى كما كان (§52.7).
// --------------------------------------------------
exports.activeDebtCollection = {
    payment: exports.activePayment,
};
// --------------------------------------------------
// تخصيصاتُ دفعات الأساتذة — §52.9
//
// التخصيص يتبع دفعتَه أيضاً: `TeacherPaymentAllocation` بلا حالة،
// فالمُلغى منها ما تبعَ دفعةً ملغاة.
// --------------------------------------------------
exports.activeTeacherAllocation = {
    teacherPayment: exports.activeTeacherPayment,
};
//# sourceMappingURL=active.js.map