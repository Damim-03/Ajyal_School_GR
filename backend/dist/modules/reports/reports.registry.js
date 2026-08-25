"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GROUP_TITLE = exports.REGISTRY_BY_KEY = exports.REPORT_REGISTRY = void 0;
const reports_service_1 = require("./reports.service");
const reports_service_finance_1 = require("./reports.service.finance");
const reports_service_academic_1 = require("./reports.service.academic");
const entry = (key, title, description, group, hasTable, service) => ({ key, title, description, group, hasTable, service });
exports.REPORT_REGISTRY = [
    entry("overview", "نظرة العموم", "صورة المؤسسة في لمحة: الطلبة والحضور والمال والمستحقّات.", "overview", false, reports_service_1.overviewReportService),
    // --------------------------------------------------
    // الأكاديمي
    // --------------------------------------------------
    entry("students", "الطلبة", "تحليل الطلبة: التوزيع والحضور والوضع المالي لكلٍّ منهم.", "academic", true, reports_service_1.studentsReportService),
    entry("attendance", "الحضور", "سجلّات الحضور مفصّلةً بالطالب والمادة والحصّة.", "academic", true, reports_service_1.attendanceReportService),
    entry("academic", "الأكاديمي", "ملخّص أكاديمي حسب الأطوار التعليمية.", "academic", true, reports_service_academic_1.academicReportService),
    entry("stages", "الأطوار التعليمية", "مقارنة الأطوار: الطلبة والحصص والحضور والإيراد.", "academic", true, reports_service_academic_1.stagesReportService),
    entry("levels", "المستويات", "مقارنة المستويات داخل الأطوار.", "academic", true, reports_service_academic_1.levelsReportService),
    entry("subjects", "المواد", "المواد: التسجيلات والحضور والإيراد والمتبقّي.", "academic", true, reports_service_academic_1.subjectsReportService),
    entry("groups", "الأفواج", "الأفواج: الطلبة والحصص والحضور والوضع المالي.", "academic", true, reports_service_academic_1.groupsReportService),
    entry("assignments", "الإسنادات التدريسية", "الرابط التشغيلي بين الأستاذ والمادة والفوج.", "academic", true, reports_service_academic_1.assignmentsReportService),
    entry("sessions", "الحصص", "الحصص المجدولة والمكتملة، وما سُجّل حضورُه وما لم يُسجَّل.", "academic", true, reports_service_academic_1.sessionsReportService),
    // --------------------------------------------------
    // المالية — جانب الطالب
    // --------------------------------------------------
    entry("financial", "المالي", "الفوترة والتحصيل والمتبقّي وحركة الشهور.", "financial", false, reports_service_1.financialReportService),
    entry("invoices", "الفواتير", "الفواتير بحالاتها ومبالغها وما سُدِّد منها.", "financial", true, reports_service_finance_1.invoicesReportService),
    entry("payments", "الدفعات", "دفعات الطلبة بطرقها وإيصالاتها.", "financial", true, reports_service_finance_1.paymentsReportService),
    entry("receipts", "الإيصالات", "الإيصالات: المطبوع والملغى والمعاد طبعه.", "financial", true, reports_service_finance_1.receiptsReportService),
    entry("debts", "الديون", "المتبقّي على الطلبة وتعتيقه بحسب فترته الأصلية.", "financial", true, reports_service_finance_1.debtsReportService),
    entry("debt-collections", "تحصيل الديون", "ما استُرِدّ من ديون فتراتٍ ماضية، وحصص الأساتذة منه.", "financial", true, reports_service_finance_1.debtCollectionsReportService),
    // --------------------------------------------------
    // المالية — جانب الأستاذ
    // --------------------------------------------------
    entry("teachers", "الأساتذة", "عبء التدريس والمستحقّ والمدفوع لكلّ أستاذ.", "teacher", true, reports_service_1.teachersReportService),
    entry("settlements", "التخليص", "تخليصات الأساتذة بلقطاتها المجمَّدة لحظةَ الحساب.", "teacher", true, reports_service_finance_1.settlementsReportService),
    entry("teacher-payments", "دفعات الأساتذة", "ما دُفع للأساتذة وما بقي بلا تخصيص.", "teacher", true, reports_service_finance_1.teacherPaymentsReportService),
    entry("allocations", "تخصيصات الدفعات", "أين ذهب كلُّ دينار من دفعات الأساتذة.", "teacher", true, reports_service_finance_1.allocationsReportService),
    // --------------------------------------------------
    // المراجعة
    // --------------------------------------------------
    entry("audit", "سجلّ التدقيق المالي", "من غيّر أيَّ قيمة، ومتى، ولماذا.", "audit", true, reports_service_finance_1.auditReportService),
    entry("cancellations", "الإلغاءات", "كلُّ ما أُلغي من فواتير ودفعات وإيصالات وتخليصات.", "audit", true, reports_service_finance_1.cancellationsReportService),
    entry("data-quality", "جودة البيانات", "فحوص اتّساق لا تُعدّل شيئاً — تنبّه فقط.", "audit", true, reports_service_finance_1.dataQualityReportService),
];
exports.REGISTRY_BY_KEY = new Map(exports.REPORT_REGISTRY.map((report) => [report.key, report]));
exports.GROUP_TITLE = {
    overview: "نظرة العموم",
    academic: "الأكاديمي",
    financial: "المالي",
    teacher: "الأساتذة",
    audit: "المراجعة",
};
//# sourceMappingURL=reports.registry.js.map