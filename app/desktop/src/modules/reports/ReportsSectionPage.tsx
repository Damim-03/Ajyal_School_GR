import { motion } from "motion/react";
import { ArrowRight, FileBarChart } from "lucide-react";
import { Navigate, useNavigate, useParams } from "react-router-dom";

import { AppHeader } from "../../components/AppHeader";
import { ReportScanner } from "./components/ReportScanner";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { MOTION } from "../../motion/system";
import { GROUPS, SCREENS, type ReportGroupKey } from "./reports.catalog";

// ======================================================
// محورُ المجموعة — الطبقةُ الثانية
//
// بطاقةٌ لكلّ تقريرٍ داخل المجموعة. ونصُّ البطاقة هو نفسُه وصفُ
// التقرير في السجلّ — فالوصفُ الذي يقرؤه المستخدمُ هنا هو الذي
// يراه في ترويسة التقرير وفي مركز التصدير، ولا ثلاثةُ أوصافٍ
// تتباعد.
// ======================================================

const SECTION_META: Record<
  ReportGroupKey,
  { subtitle: string; tone: string }
> = {
  overview: { subtitle: "صورة المؤسسة", tone: "#86efac" },
  academic: { subtitle: "الطلبة والبنية الدراسية", tone: "#a5b4fc" },
  financial: { subtitle: "الفوترة والتحصيل والديون", tone: "#ff8fb1" },
  teacher: { subtitle: "المستحقّات والتخليص", tone: "#fbbf24" },
  audit: { subtitle: "التدقيق وجودة البيانات", tone: "#f9a8d4" },
};

export default function ReportsSectionPage() {
  const { group } = useParams<{ group: string }>();
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  const known = GROUPS.find((entry) => entry.key === group);

  /*
   * مجموعةٌ مجهولة تُحوَّل إلى المحور لا تُعرض فارغة.
   *
   * ورابطٌ قديمٌ أو مكتوبٌ بيدٍ يجب أن يوصل إلى شيء — وصفحةٌ بيضاء
   * تُقرأ عطباً في التطبيق لا خطأً في العنوان.
   */
  if (!known) return <Navigate to="/reports" replace />;

  const meta = SECTION_META[known.key];
  const screens = SCREENS.filter((screen) => screen.group === known.key);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title={known.title} subtitle={meta.subtitle}>
        <ReportScanner />
        <button
          onClick={() => exitToHome("/reports")}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-250 p-6 pt-10">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {screens.map((screen, index) => (
            <motion.button
              key={screen.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: MOTION.duration.normal,
                delay: 0.05 * index,
                ease: MOTION.easing.enter,
              }}
              whileHover={{ y: -3 }}
              onClick={() => {
                uiSound("navigate");
                navigate(`/reports/${screen.key}`);
              }}
              className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-white/25"
              style={{ minHeight: 170 }}
            >
              <span
                className="mb-3 grid h-11 w-11 place-items-center rounded-xl transition group-hover:scale-105"
                style={{ background: `${meta.tone}1f` }}
              >
                <FileBarChart
                  className="h-5 w-5"
                  style={{ color: meta.tone }}
                />
              </span>

              <h2 className="mb-1 text-base font-black">{screen.title}</h2>

              <p className="flex-1 text-[12px] leading-relaxed text-white/50">
                {screen.description}
              </p>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
