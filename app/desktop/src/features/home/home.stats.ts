import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../../core/api/client";
import { formatMoney as money } from "../../core/utils/money";

/**
 * إحصاءات المعاينة السياقية لكل قسم.
 *
 * قاعدة حاكمة منقولة عن SKK: **لا رقم مختلَق**. رقمٌ معروض بثقة
 * والمستخدم يظنّه حقيقياً أسوأ من غياب الرقم. القسم الذي لا مصدر
 * لبياناته يُعيد `stats: null` والواجهة تقول ذلك صراحةً.
 *
 * كل الأرقام هنا تأتي من `/reports/dashboard` — نقطة نهاية واحدة
 * تُجلب مرّة وتُقرأ منها كل الأقسام، بدل طلب لكل بلاطة.
 *
 * التخزين المؤقّت في React Query هو نفسه «ذاكرة المعاينة»: العودة إلى
 * قسم زُرتَه لا تُعيد الجلب فتظهر أرقامه فوراً.
 */

export interface Stat {
  label: string;
  value: string;
  hint?: string;
}

export interface Activity {
  id: string;
  title: string;
  meta: string;
}

export interface ModuleStatus {
  text: string;
  tone: "ok" | "warn" | "idle";
}

export interface ModuleContext {
  loading: boolean;
  stats: Stat[] | null;
  activity: Activity[];
  status: ModuleStatus | null;
}

// --------------------------------------------------
// تنسيق الأرقام
// --------------------------------------------------

const count = (n: number) => n.toLocaleString("ar-DZ");

const MONTHS = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

// --------------------------------------------------
// شكل رد /reports/dashboard كما يبنيه الخادم
// --------------------------------------------------

interface Dashboard {
  academicYear: { id: string; name: string } | null;
  counts: {
    activeStudents: number;
    activeTeachers: number;
    activeStudyGroups: number;
    activeEnrollments: number;
  };
  currentMonth: {
    month: number;
    year: number;
    invoiceCount: number;
    invoiced: number;
    collected: number;
    remaining: number;
  };
  outstanding: { invoiceCount: number; amount: number };
}

function useDashboard() {
  return useQuery({
    queryKey: ["reports", "dashboard"],
    queryFn: async () => {
      const { data } = await apiClient.get("/reports/dashboard");
      return data.data as Dashboard;
    },
    staleTime: 60_000,
  });
}

// --------------------------------------------------
// useModuleStats
// --------------------------------------------------

export function useModuleStats(moduleId: string): ModuleContext {
  const { data, isLoading } = useDashboard();

  if (isLoading) {
    return { loading: true, stats: null, activity: [], status: null };
  }

  /*
   * تعذّر الجلب حالة حقيقية معلومة — تُقال ولا تُخفى خلف أصفار.
   */
  if (!data) {
    return {
      loading: false,
      stats: null,
      activity: [],
      status: { text: "تعذّر الاتصال بالخادم", tone: "warn" },
    };
  }

  const { counts, currentMonth, outstanding, academicYear } = data;

  const yearHint = academicYear?.name ?? "بلا سنة جارية";
  const monthLabel = `${MONTHS[currentMonth.month - 1]} ${currentMonth.year}`;

  switch (moduleId) {
    case "students":
      return {
        loading: false,
        stats: [
          { label: "طالب نشط", value: count(counts.activeStudents) },
          { label: "تسجيل في مادة", value: count(counts.activeEnrollments), hint: yearHint },
        ],
        activity: [],
        status: academicYear
          ? { text: `السنة الجارية: ${academicYear.name}`, tone: "ok" }
          : { text: "لم تُحدَّد سنة جارية بعد", tone: "warn" },
      };

    case "teachers":
      return {
        loading: false,
        stats: [
          { label: "أستاذ نشط", value: count(counts.activeTeachers) },
          { label: "فوج نشط", value: count(counts.activeStudyGroups) },
        ],
        activity: [],
        status: counts.activeTeachers > 0
          ? { text: "هيئة التدريس جاهزة", tone: "ok" }
          : { text: "لا أساتذة مسجّلون بعد", tone: "warn" },
      };

    case "finance":
      return {
        loading: false,
        stats: [
          { label: `محصَّل ${monthLabel}`, value: money(currentMonth.collected) },
          { label: "مستحقّ", value: money(currentMonth.remaining), hint: `${count(currentMonth.invoiceCount)} فاتورة` },
        ],
        activity: [],
        status:
          outstanding.amount > 0
            ? { text: `متأخرات: ${money(outstanding.amount)}`, tone: "warn" }
            : { text: "لا متأخرات", tone: "ok" },
      };

    case "reports":
      return {
        loading: false,
        stats: [
          { label: "إجمالي المستحقّ", value: money(outstanding.amount) },
          { label: "فاتورة غير مسدَّدة", value: count(outstanding.invoiceCount) },
        ],
        activity: [],
        status: { text: yearHint, tone: "ok" },
      };

    case "settings":
      return {
        loading: false,
        stats: [
          { label: "فوج نشط", value: count(counts.activeStudyGroups) },
        ],
        activity: [],
        status: academicYear
          ? { text: `السنة الجارية: ${academicYear.name}`, tone: "ok" }
          : { text: "اضبط السنة الجارية أولاً", tone: "warn" },
      };

    /*
     * الجداول والحضور والمستخدمون: لا تجميعات لها في /reports/dashboard
     * بعد. لا نخترع لها أرقاماً — تبقى بلا إحصاءات حتى تُضاف تجميعاتها.
     */
    default:
      return { loading: false, stats: null, activity: [], status: null };
  }
}
