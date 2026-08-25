"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.metricsByDomain = exports.METRICS_BY_KEY = exports.ALL_METRIC_DEFINITIONS = exports.METRIC_DEFINITIONS = void 0;
const definitions_extra_1 = require("./definitions.extra");
exports.METRIC_DEFINITIONS = [
    // --------------------------------------------------
    // المالية — الطالب
    // --------------------------------------------------
    {
        key: "invoiced",
        domain: "financial",
        label: "إجمالي المفوتر",
        unit: "money",
        direction: "neutral",
        formula: "SUM(Invoice.total) WHERE status != CANCELLED",
        description: "مجموع ما استُحقّ على الطلبة في الفترة، بعد الحسومات.",
        exclusions: "الفواتير الملغاة لا تدخل (§52.2).",
        caveat: "استحقاقٌ لا نقد. ما حُصِّل منه فعلاً في «المحصَّل».",
        drillTo: "/reports/invoices",
    },
    {
        key: "collected",
        domain: "financial",
        label: "المحصَّل",
        unit: "money",
        direction: "higherIsBetter",
        formula: "SUM(Invoice.total) - SUM(Invoice.remaining)",
        description: "ما سُدِّد من فواتير الفترة، منسوباً إلى شهر الفاتورة.",
        exclusions: "الفواتير الملغاة لا تدخل.",
        caveat: "يُنسب إلى شهر الفاتورة لا يوم الدفع: دفعةُ نوفمبر لفاتورة سبتمبر تظهر في سبتمبر. للنقد الداخل فعلاً انظر «حركة النقد».",
        drillTo: "/reports/payments",
    },
    {
        key: "outstanding",
        domain: "financial",
        label: "المتبقّي",
        unit: "money",
        direction: "lowerIsBetter",
        formula: "SUM(Invoice.remaining) WHERE status != CANCELLED",
        description: "ما استُحقّ ولم يُسدَّد بعد. هو نفسه الدَّين.",
        exclusions: "الفواتير الملغاة لا تدخل.",
        drillTo: "/reports/debts",
    },
    {
        key: "collectionRate",
        domain: "financial",
        label: "نسبة التحصيل",
        unit: "percent",
        direction: "higherIsBetter",
        formula: "collected / invoiced × 100",
        description: "أيُّ نسبةٍ من استحقاق الفترة وصلت إلى الصندوق.",
        caveat: "لا تُحسب حين لا فواتير — تُعرض «—» لا 0%.",
    },
    {
        key: "averagePayment",
        domain: "financial",
        label: "متوسّط الدفعة",
        unit: "money",
        direction: "neutral",
        formula: "SUM(Payment.amount) / COUNT(Payment) WHERE status = ACTIVE",
        description: "متوسّط قيمة الدفعة الواحدة في الفترة.",
        exclusions: "الدفعات الملغاة لا تدخل (§52.1).",
    },
    // --------------------------------------------------
    // الديون
    // --------------------------------------------------
    {
        key: "debtTotal",
        domain: "debt",
        label: "إجمالي الدَّين",
        unit: "money",
        direction: "lowerIsBetter",
        formula: "SUM(Invoice.remaining) WHERE status != CANCELLED",
        description: "كلُّ ما على الطلبة، جارياً كان أو قديماً.",
        drillTo: "/reports/debts",
    },
    {
        key: "debtOld",
        domain: "debt",
        label: "الدَّين القديم",
        unit: "money",
        direction: "lowerIsBetter",
        formula: "SUM(Invoice.remaining) WHERE (Invoice.year, Invoice.month) < الفترة المرجعية",
        description: "متبقّي فواتير فتراتٍ سابقة للفترة المعروضة.",
        caveat: "المقارنة بشهر الفاتورة وسنتها لا بتاريخ إنشائها — فاتورة سبتمبر المُدخَلة في أكتوبر دَينُها سبتمبريّ (§58).",
    },
    {
        key: "collectedOldDebt",
        domain: "debt",
        label: "المحصَّل من الديون القديمة",
        unit: "money",
        direction: "higherIsBetter",
        formula: "SUM(DebtCollection.collectedAmount) WHERE Payment.status = ACTIVE",
        description: "ما استُرِدّ في هذه الفترة من ديون فتراتٍ ماضية.",
        exclusions: "تحصيلٌ تبع دفعةً ملغاة لا يدخل.",
        caveat: "لا يُعدّل إيراد الفترة الأصلية — التاريخ المالي ثابت (§52.7).",
        drillTo: "/reports/debt-collections",
    },
    // --------------------------------------------------
    // الحضور
    // --------------------------------------------------
    {
        key: "attendanceRate",
        domain: "attendance",
        label: "نسبة الحضور",
        unit: "percent",
        direction: "higherIsBetter",
        formula: "(PRESENT + LATE) / (PRESENT + ABSENT + LATE + EXCUSED) × 100",
        description: "نسبة سجلّات الحضور التي حضر فيها الطالب.",
        caveat: "المتأخّر يُحتسب حاضراً لأنه تلقّى الدرس؛ انضباطُه في «نسبة التأخّر». والمعذور يبقى في المقام لئلّا يظهر فوجٌ نصفُه بأعذار بحضورٍ كامل.",
        drillTo: "/reports/attendance",
    },
    {
        key: "absenceRate",
        domain: "attendance",
        label: "نسبة الغياب",
        unit: "percent",
        direction: "lowerIsBetter",
        formula: "ABSENT / كل السجلّات × 100",
        description: "الغياب غير المعذور.",
    },
    // --------------------------------------------------
    // الأساتذة
    // --------------------------------------------------
    {
        key: "teacherEntitlement",
        domain: "teacher",
        label: "مستحقّ الأساتذة",
        unit: "money",
        direction: "neutral",
        formula: "SUM(Settlement.teacherAmount) + SUM(TeacherDebtShare.shareAmount) WHERE status != CANCELLED",
        description: "ما استحقّه الأساتذة: تخليصُ فتراتهم زائدَ حصصهم من ديونٍ حُصِّلت لاحقاً.",
        exclusions: "التخليصات وحصص الدَّين الملغاة لا تدخل (§52.4 و§52.8).",
        caveat: "يشمل المسوّدات. للالتزام الفعلي على المؤسسة انظر «المستحقّ المعتمَد» — المسوّدة حسابٌ لم يُعتمد.",
        drillTo: "/reports/settlements",
    },
    {
        key: "teacherPaid",
        domain: "teacher",
        label: "المدفوع للأساتذة",
        unit: "money",
        direction: "neutral",
        formula: "SUM(TeacherPaymentAllocation.amount) WHERE TeacherPayment.status = ACTIVE",
        description: "ما دُفع فعلاً، محسوباً من التخصيصات لا من مجاميع الدفعات.",
        exclusions: "دفعات الأساتذة الملغاة لا تدخل (§52.3).",
        caveat: "منفصلٌ تماماً عن دفعات الطلبة — هذا صادرٌ من المؤسسة وذاك واردٌ إليها (§52.5).",
        drillTo: "/reports/teacher-payments",
    },
    {
        key: "teacherOutstanding",
        domain: "teacher",
        label: "المتبقّي للأساتذة",
        unit: "money",
        direction: "lowerIsBetter",
        formula: "teacherEntitlement - teacherPaid",
        description: "ما بقي على المؤسسة للأساتذة.",
    },
    {
        key: "unallocatedTeacherPayment",
        domain: "teacher",
        label: "دفعات بلا تخصيص",
        unit: "money",
        direction: "lowerIsBetter",
        formula: "TeacherPayment.amount - SUM(allocations.amount)",
        description: "مبلغٌ دُفع للأستاذ دون بيان مقابل أيِّ استحقاق.",
        caveat: "مؤشّر جودة بيانات (§39) — ينبغي أن يكون صفراً دائماً.",
        drillTo: "/reports/data-quality",
    },
    // --------------------------------------------------
    // التدفّق النقدي
    // --------------------------------------------------
    {
        key: "netCashMovement",
        domain: "cashflow",
        label: "صافي حركة النقد",
        unit: "money",
        direction: "neutral",
        formula: "دفعات الطلبة النشطة − دفعات الأساتذة النشطة",
        description: "الفرق بين ما دخل الصندوق وما خرج منه في الفترة.",
        caveat: "ليس ربحاً. النظام لا يعرف الإيجار ولا الكهرباء ولا الأجور الإدارية، فتسميتُه ربحاً تُخفي مصاريف حقيقية (§33).",
        drillTo: "/reports/financial-flow",
    },
];
/*
 * الكتالوجُ كاملاً: الأساسيُّ أعلاه وتتمّتُه في ملفٍّ ثانٍ.
 *
 * والفصلُ عرضيٌّ لا منطقي — ملفٌّ بخمسةٍ وسبعين تعريفاً لا يُقرأ
 * دفعةً واحدة. أمّا `ALL_METRIC_DEFINITIONS` فهو المصدرُ الوحيد
 * الذي يُبحث فيه، فلا يهمّ القارئَ في أيّ ملفٍّ كُتب التعريف.
 */
exports.ALL_METRIC_DEFINITIONS = [
    ...exports.METRIC_DEFINITIONS,
    ...definitions_extra_1.EXTRA_METRIC_DEFINITIONS,
];
exports.METRICS_BY_KEY = new Map(exports.ALL_METRIC_DEFINITIONS.map((metric) => [metric.key, metric]));
const metricsByDomain = (domain) => exports.ALL_METRIC_DEFINITIONS.filter((metric) => metric.domain === domain);
exports.metricsByDomain = metricsByDomain;
//# sourceMappingURL=definitions.js.map