import { Prisma } from "../../../generated/prisma";

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

export const activeInvoice = {
  status: { not: "CANCELLED" },
} satisfies Prisma.InvoiceWhereInput;

export const cancelledInvoice = {
  status: "CANCELLED",
} satisfies Prisma.InvoiceWhereInput;

// --------------------------------------------------
// دفعات الطلبة — §52.1
//
// منفصلةٌ عن دفعات الأساتذة تماماً (§52.5): هذه واردٌ إلى المؤسسة،
// وتلك صادرٌ منها. وخلطُهما في مجموعٍ واحد يُنتج رقماً بلا معنى.
// --------------------------------------------------

export const activePayment = {
  status: "ACTIVE",
} satisfies Prisma.PaymentWhereInput;

export const cancelledPayment = {
  status: "CANCELLED",
} satisfies Prisma.PaymentWhereInput;

// --------------------------------------------------
// دفعات الأساتذة — §52.3
// --------------------------------------------------

export const activeTeacherPayment = {
  status: "ACTIVE",
} satisfies Prisma.TeacherPaymentWhereInput;

export const cancelledTeacherPayment = {
  status: "CANCELLED",
} satisfies Prisma.TeacherPaymentWhereInput;

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

export const activeSettlement = {
  status: { not: "CANCELLED" },
} satisfies Prisma.SettlementWhereInput;

export const committedSettlement = {
  status: { in: ["CONFIRMED", "PAID"] },
} satisfies Prisma.SettlementWhereInput;

export const cancelledSettlement = {
  status: "CANCELLED",
} satisfies Prisma.SettlementWhereInput;

// --------------------------------------------------
// حصص الأساتذة من الديون المحصَّلة — §52.8
//
// CANCELLED تُستثنى، وPENDING تدخل في «المحسوب» لا في «الواجب».
// نفس منطق التخليص: الاعتمادُ هو ما يُحوّل الحسابَ إلى التزام.
// --------------------------------------------------

export const activeDebtShare = {
  status: { not: "CANCELLED" },
} satisfies Prisma.TeacherDebtShareWhereInput;

export const committedDebtShare = {
  status: { in: ["APPROVED", "PAID"] },
} satisfies Prisma.TeacherDebtShareWhereInput;

// --------------------------------------------------
// الإيصالات
//
// الإيصال الملغى يبقى في التدقيق (§24) ويخرج من العدّ الفعلي.
// --------------------------------------------------

export const activeReceipt = {
  status: { not: "CANCELLED" },
} satisfies Prisma.ReceiptWhereInput;

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

export const activeDebtCollection = {
  payment: activePayment,
} satisfies Prisma.DebtCollectionWhereInput;

// --------------------------------------------------
// تخصيصاتُ دفعات الأساتذة — §52.9
//
// التخصيص يتبع دفعتَه أيضاً: `TeacherPaymentAllocation` بلا حالة،
// فالمُلغى منها ما تبعَ دفعةً ملغاة.
// --------------------------------------------------

export const activeTeacherAllocation = {
  teacherPayment: activeTeacherPayment,
} satisfies Prisma.TeacherPaymentAllocationWhereInput;
