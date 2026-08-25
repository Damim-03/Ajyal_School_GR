import { motion } from "motion/react";
import {
  ArrowRight,
  ClipboardCheck,
  Download,
  GraduationCap,
  LayoutDashboard,
  ShieldCheck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { AppHeader } from "../../components/AppHeader";
import { ReportScanner } from "./components/ReportScanner";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { SCREENS } from "./reports.catalog";

// ======================================================
// محورُ التقارير — بطاقاتٌ لا قائمةٌ جانبية
//
// النمطُ نفسُه في كلّ أقسام التطبيق: بلاطةٌ في الرئيسية ← محورٌ
// ببطاقات ← شاشةُ عمل. وكسرُ هذا التسلسل في التقارير وحدها كان
// سيجعلها تبدو تطبيقاً آخر دُسّ في التطبيق.
//
// وستٌّ وعشرون شاشةً لا تُعرض بطاقةً بطاقة: خمسُ مجموعاتٍ في المحور
// الأوّل، وشاشاتُ كلِّ مجموعةٍ في محورها. طبقتان لا واحدة — والعينُ
// تمسح ستّ بطاقاتٍ ولا تمسح ستّاً وعشرين.
// ======================================================

const ACCENT = "#86efac";

interface Card {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  to: string;
  tone: string;
}

const CARDS: Card[] = [
  {
    key: "overview",
    label: "نظرة العموم",
    desc: "صورة المؤسسة في لمحة: المال والديون ومستحقّات الأساتذة والحضور، مع مقارنة بالفترة السابقة.",
    icon: LayoutDashboard,
    to: "/reports/overview",
    tone: "#86efac",
  },
  {
    key: "academic",
    label: "الأكاديمي",
    desc: "الطلبة والحضور والأطوار والمستويات والمواد والأفواج والإسنادات والحصص.",
    icon: GraduationCap,
    to: "/reports/section/academic",
    tone: "#a5b4fc",
  },
  {
    key: "financial",
    label: "المالي",
    desc: "الفوترة والتحصيل والفواتير والدفعات والإيصالات والديون وتحصيلها.",
    icon: Wallet,
    to: "/reports/section/financial",
    tone: "#ff8fb1",
  },
  {
    key: "teacher",
    label: "الأساتذة",
    desc: "عبء التدريس والتخليص والدفعات، وأين ذهب كلّ دينار دُفع لأستاذ.",
    icon: ClipboardCheck,
    to: "/reports/section/teacher",
    tone: "#fbbf24",
  },
  {
    key: "audit",
    label: "المراجعة",
    desc: "سجلّ التدقيق المالي، والإلغاءات، وفحوص جودة البيانات.",
    icon: ShieldCheck,
    to: "/reports/section/audit",
    tone: "#f9a8d4",
  },
  {
    key: "exports",
    label: "مركز التصدير",
    desc: "تصدير أيّ تقرير بصيغة Excel أو CSV. والطباعة وPDF من داخل التقرير نفسه.",
    icon: Download,
    to: "/reports/exports",
    tone: "#67e8f9",
  },
];

export default function ReportsHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  /*
   * عددُ الشاشات في كلّ مجموعة يُحسب من السجلّ لا يُكتب يدوياً.
   *
   * فإضافةُ تقريرٍ في `reports.catalog.ts` تُحدّث الشارةَ من نفسها،
   * ولا يبقى رقمٌ مكتوبٌ بيدٍ يتقادم عند أوّل إضافة.
   */
  const countOf = (group: string) =>
    SCREENS.filter((screen) => screen.group === group).length;

  const badgeOf = (card: Card) => {
    if (card.key === "overview" || card.key === "exports") return null;

    const count = countOf(card.key);

    return count > 0 ? `${count} تقارير` : null;
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="التقارير" subtitle="مركز معلومات المؤسسة">
        <ReportScanner />
        <button
          onClick={() => exitToHome(PATHS.home)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-250 p-6 pt-10">
        <div className="grid gap-5 md:grid-cols-2">
          {CARDS.map((card, index) => {
            const badge = badgeOf(card);

            return (
              <motion.button
                key={card.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: MOTION.duration.normal,
                  delay: 0.07 * index,
                  ease: MOTION.easing.enter,
                }}
                whileHover={{ y: -4 }}
                onClick={() => {
                  uiSound("navigate");
                  navigate(card.to);
                }}
                className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-right transition hover:border-white/25"
                style={{ minHeight: 230 }}
              >
                <span
                  className="mb-4 grid h-14 w-14 place-items-center rounded-2xl transition group-hover:scale-105"
                  style={{ background: `${card.tone}1f` }}
                >
                  <card.icon className="h-7 w-7" style={{ color: card.tone }} />
                </span>

                <h2 className="mb-1.5 text-lg font-black">{card.label}</h2>

                <p className="flex-1 text-[13px] leading-relaxed text-white/50">
                  {card.desc}
                </p>

                {badge && (
                  <span
                    className="mt-4 rounded-full px-3 py-1 text-[11px] font-bold"
                    style={{ background: `${card.tone}1a`, color: card.tone }}
                  >
                    {badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 text-center text-xs text-white/30"
        >
          كلّ رقم في التقارير قابل للنقر — يفتح التقرير المفصّل بالفلتر
          مطبَّقاً
        </motion.p>
      </div>
    </div>
  );
}

export { ACCENT };
