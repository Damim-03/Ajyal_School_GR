import { ChartSkeleton, ReportChartView } from "./charts/ReportChartView";
import { MetricCard, MetricSkeleton } from "./components/MetricCard";
import { ReportShell } from "./components/ReportShell";
import { useReport } from "./hooks/use-report";
import { useReportQuery } from "./hooks/use-report-query";
import type { ReportSummary } from "./reports.api";

// ======================================================
// نظرةُ العموم — §5 §6 §7
//
// شاشةٌ مستقلّة لا `ReportPage` عامّة، لسببٍ واحد: §5 يطلب تجميعَ
// المؤشّرات في **مجموعاتٍ معنونة** لا شبكةً مسطّحة.
//
// وتسعةٌ وعشرون مؤشّراً في شبكةٍ واحدة جدارٌ من الأرقام لا «صورةٌ
// في ثوانٍ». والعنوانُ فوق كلّ أربعةٍ يقول للعين أين تقف: هذه
// أرقامُ الطلبة، وهذه أرقامُ المال.
// ======================================================

/**
 * المجموعاتُ كما ترتّبها §5 — بالترتيب الذي تُقرأ به.
 *
 * المالُ أوّلاً لا الطلبة: المديرُ يفتح الشاشةَ ليعرف حالَ الصندوق،
 * وعددُ الطلبة معلومةٌ يعرفها ولا تتغيّر كلَّ يوم.
 */
const SECTIONS: { title: string; keys: string[]; emphasis?: string[] }[] = [
  {
    title: "المال",
    keys: ["invoiced", "collected", "outstanding", "collectionRate"],
    emphasis: ["collected", "outstanding"],
  },
  {
    title: "الديون",
    keys: ["debtTotal", "debtOld", "debtCurrent", "collectedOldDebt"],
  },
  {
    title: "الأساتذة",
    keys: [
      "teacherEntitlement",
      "teacherPaid",
      "teacherOutstanding",
      "unallocatedTeacherPayment",
    ],
  },
  {
    title: "الحضور",
    keys: ["attendanceRate", "absenceRate", "lateRate", "attendanceRecords"],
  },
  {
    title: "حركة النقد",
    keys: ["moneyIn", "moneyOut", "netCashMovement", "teacherCostRatio"],
  },
];

/**
 * تنبيهاتٌ ذكية — §7.
 *
 * تُشتقّ من المؤشّرات الموجودة ولا تُطلب من الخادم: كلُّ ما تحتاجه
 * وصلَ سلفاً في `summary`، ونداءٌ ثانٍ لأجلها إسرافٌ.
 *
 * وعتباتُها **بنيوية لا عشوائية** — §7 يمنع اختراع عتبات. فالتنبيهُ
 * هنا لا يقول «الحضور أقلّ من 85%» (رقمٌ من أين؟) بل يقول «يوجد
 * دينارٌ دُفع بلا تخصيص» — وهي حالةٌ خطؤها في ذاتها لا في مقدارها.
 */
const buildAlerts = (summary: ReportSummary) => {
  const alerts: { key: string; text: string; to?: string }[] = [];

  const value = (key: string) => summary[key]?.value ?? null;

  const unallocated = value("unallocatedTeacherPayment");

  if (unallocated !== null && Math.abs(unallocated) > 0.005) {
    alerts.push({
      key: "unallocated",
      text: "توجد دفعات أساتذة بلا تخصيص — مبلغ دُفع دون بيان مقابله.",
      to: "/reports/data-quality",
    });
  }

  const oldDebt = value("debtOld");

  if (oldDebt !== null && oldDebt > 0) {
    alerts.push({
      key: "oldDebt",
      text: "يوجد دَين قديم لم يُسترَدّ من فترات سابقة.",
      to: "/reports/debts",
    });
  }

  const teacherOutstanding = value("teacherOutstanding");

  if (teacherOutstanding !== null && teacherOutstanding > 0) {
    alerts.push({
      key: "teacherOutstanding",
      text: "توجد مستحقّات أساتذة لم تُدفع بعد.",
      to: "/reports/settlements",
    });
  }

  return alerts;
};

export const OverviewPage = () => {
  const state = useReportQuery();

  const { data, isLoading, isFetching, error, refetch } = useReport(
    "overview",
    state.query,
  );

  const alerts = data ? buildAlerts(data.summary) : [];

  return (
    <ReportShell
      reportKey="overview"
      title="نظرة العموم"
      description="صورة المؤسسة في لمحة: المال والديون والأساتذة والحضور."
      meta={data?.meta}
      report={data}
      state={state}
      isLoading={isLoading}
      isFetching={isFetching}
      error={error}
      onRetry={() => void refetch()}
    >
      {/* التنبيهات — §7: كلٌّ منها قابل للنقر */}
      {alerts.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {alerts.map((alert) => (
            <li key={alert.key}>
              <a
                href={`#${alert.to ?? ""}`}
                onClick={(event) => {
                  event.preventDefault();
                  if (alert.to) window.location.hash = alert.to;
                }}
                className="inline-flex items-center gap-2 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-400/20"
              >
                <span className="inline-block size-1.5 rounded-full bg-amber-400" />
                {alert.text}
              </a>
            </li>
          ))}
        </ul>
      )}

      {isLoading ? (
        <div className="space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <div className="mb-2 h-3 w-20 animate-pulse rounded bg-white/12" />
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {section.keys.map((key) => (
                  <MetricSkeleton key={key} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        data && (
          <div className="space-y-5">
            {SECTIONS.map((section) => {
              const present = section.keys.filter((key) => key in data.summary);

              if (present.length === 0) return null;

              return (
                <section key={section.title}>
                  <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-white/35">
                    {section.title}
                  </h2>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {present.map((key) => (
                      <MetricCard
                        key={key}
                        metric={data.summary[key]}
                        emphasis={section.emphasis?.includes(key)}
                      />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )
      )}

      {/* الرسوم */}
      {isLoading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
      ) : (
        data && (
          <div className="grid gap-4 lg:grid-cols-2">
            {data.charts.map((chart) => (
              <ReportChartView key={chart.key} chart={chart} />
            ))}
          </div>
        )
      )}
    </ReportShell>
  );
};
