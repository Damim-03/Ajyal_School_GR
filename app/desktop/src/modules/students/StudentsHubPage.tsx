import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  FolderCheck,
  UserPlus,
  Users,
  type LucideIcon,
  FileSpreadsheet,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { listStudents } from "./student.api";

const ACCENT = "#7dd3fc";

/**
 * محور قسم الطلبة.
 *
 * القسم صار ثلاث مهامّ لا جدولاً واحداً، فبطاقةٌ لكل مهمّة أصدق من
 * جدولٍ تُحشر فوقه أزرارٌ لا تنتمي إليه.
 *
 * وكلّ بطاقة تحمل **رقمها الحقيقي** لا وصفاً عاماً: «12 ملفاً ناقصاً»
 * تدفع إلى الضغط، و«ملفات الطلبة» وحدها لا تقول شيئاً.
 */

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
    key: "new",
    label: "تسجيل طالب جديد",
    desc: "المعلومات الشخصية ثمّ رفع وثائق الملف — خطوتان تنتهيان بملفٍّ مكتمل.",
    icon: UserPlus,
    to: PATHS.studentNew,
    tone: "#7dd3fc",
  },
  {
    key: "list",
    label: "عرض الطلبة",
    desc: "القائمة كاملة مع الفلترة بالجنس والمادة والمستوى والسنة الدراسية والحالة.",
    icon: Users,
    to: PATHS.studentsList,
    tone: "#a5b4fc",
  },
  {
    key: "files",
    label: "ملفات الطلبة",
    desc: "حالة الوثائق لكل طالب: ما اكتمل وما ينقصه، مع تصفية الناقص وحده.",
    icon: FolderCheck,
    to: PATHS.studentsFiles,
    tone: "#fcd34d",
  },
  {
    key: "import",
    label: "استيراد الطلبة من Excel",
    desc: "إدخالُ قائمةِ طلبةٍ دفعةً واحدة من ملفّ. يُفحص الملفُّ كاملاً أوّلاً، ولا يُكتب شيء حتى تقرّر.",
    icon: FileSpreadsheet,
    to: PATHS.studentsImport,
    tone: "#6ee7b7",
  },
];

export default function StudentsHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  const [stats, setStats] = useState<{
    total: number;
    incomplete: number;
  } | null>(null);

  /*
   * طلبان صغيران بـ limit=1: العدد يأتي من `pagination.total` فلا
   * تُجلب صفوفٌ لا تُعرض.
   */
  useEffect(() => {
    let alive = true;

    Promise.all([
      listStudents({ limit: 1 }),
      listStudents({ limit: 1, documentsComplete: false }),
    ])
      .then(([all, incomplete]) => {
        if (!alive) return;
        setStats({
          total: all.pagination.total,
          incomplete: incomplete.pagination.total,
        });
      })
      .catch(() => {
        /* الأرقام زينة لا شرط — الشاشة تعمل بدونها */
      });

    return () => {
      alive = false;
    };
  }, []);

  const badgeOf = (key: string) => {
    if (!stats) return null;
    if (key === "list") return `${stats.total} طالب`;
    if (key === "files")
      return stats.incomplete > 0
        ? `${stats.incomplete} ملفاً ناقصاً`
        : "كل الملفات مكتملة";
    return null;
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الطلبة" subtitle="شؤون الطلبة">
        <button
          onClick={() => exitToHome(PATHS.home)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-300 p-6 pt-10">
        <div className="grid gap-5 md:grid-cols-3">
          {CARDS.map((card, i) => {
            const badge = badgeOf(card.key);

            return (
              <motion.button
                key={card.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: MOTION.duration.normal,
                  delay: 0.07 * i,
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
          الملف مكتمل حين تُرفع الوثائق الإلزامية الثلاث: شهادة الميلاد ·
          شهادة مدرسية · صورة شمسية
        </motion.p>
      </div>
    </div>
  );
}

export { ACCENT };
