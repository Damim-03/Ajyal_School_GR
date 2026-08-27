import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BookMarked,
  FileSpreadsheet,
  Info,
  Users,
  type LucideIcon,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { listAssignmentsPage, listTeachers } from "./teachers.api";

const ACCENT = "#5eead4";

/**
 * محور الأساتذة.
 *
 * الأستاذ كيانٌ، والإسناد علاقةٌ بينه وبين المادة والفوج والسنة.
 * وفصلُ العلاقة عن الكيان ليس ترتيباً للقوائم — الإسناد يُدار أفقياً
 * («من يدرّس الرياضيات للفوج الأول؟») لا من داخل ملف أستاذٍ بعينه.
 *
 * والاستيرادُ ثالثُها: فعلٌ لا مجموعةُ سجلّات، فلا عددَ تحته. ومحلُّه
 * هنا لا في شاشةٍ جامعة — الطلبةُ يُستوردون من محورهم، ولكلّ ملفِّه.
 */

interface Card {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  to: string;
  tone: string;
  count: number | null;
  unit: string;
}

export default function TeachersHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  const [teachers, setTeachers] = useState<number | null>(null);
  const [assignments, setAssignments] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;

    Promise.all([
      listTeachers({ limit: 1, isActive: true }),
      listAssignmentsPage({ limit: 1, isActive: true }),
    ])
      .then(([t, a]) => {
        if (!alive) return;
        setTeachers(t.pagination.total);
        setAssignments(a.pagination.total);
      })
      .catch(() => {
        /* الأرقام زينة لا شرط */
      });

    return () => {
      alive = false;
    };
  }, []);

  const cards: Card[] = [
    {
      key: "list",
      label: "قائمة الأساتذة",
      desc: "الملف الإداري لكل أستاذ: هويّته ومؤهّله وتخصّصه وتاريخ توظيفه، وما يدرّسه وجدولُه وحصصه.",
      icon: Users,
      to: PATHS.teachersList,
      tone: "#5eead4",
      count: teachers,
      unit: "أستاذاً نشطاً",
    },
    {
      key: "assignments",
      label: "الإسناد التدريسي",
      desc: "من يدرّس أيّ مادة لأيّ فوج في أيّ سنة. عليه تقوم الجداول والتسجيلات وكشوف الحضور.",
      icon: BookMarked,
      to: PATHS.assignments,
      tone: "#a5f3fc",
      count: assignments,
      unit: "إسناداً نشطاً",
    },
    {
      key: "import",
      label: "استيراد الأساتذة من Excel",
      desc: "إدخالُ قائمةِ أساتذةٍ دفعةً واحدة من ملفّ. يُفحص الملفُّ كاملاً أوّلاً، ولا يُكتب شيء حتى تقرّر.",
      icon: FileSpreadsheet,
      to: PATHS.teachersImport,
      tone: "#6ee7b7",
      /* لا عددَ يُعرض: الاستيرادُ فعلٌ لا مجموعةُ سجلّات */
      count: null,
      unit: "",
    },
  ];

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الأساتذة" subtitle="الملف الإداري والإسناد">
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
          {cards.map((card, i) => (
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
              style={{ minHeight: 220 }}
            >
              <span
                className="mb-4 grid h-14 w-14 place-items-center rounded-2xl transition group-hover:scale-105"
                style={{ background: `${card.tone}1f` }}
              >
                <card.icon className="h-7 w-7" style={{ color: card.tone }} />
              </span>

              <h2 className="mb-1.5 text-lg font-black">{card.label}</h2>
              <p className="flex-1 text-[13px] leading-relaxed text-white/50">{card.desc}</p>

              {card.count !== null && (
                <span
                  className="mt-4 rounded-full px-3 py-1 text-[11px] font-bold"
                  style={{ background: `${card.tone}1a`, color: card.tone }}
                >
                  {card.count} {card.unit}
                </span>
              )}
            </motion.button>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-white/30"
        >
          <Info className="h-3.5 w-3.5" />
          مستحقّات الأستاذ ليست هنا — تخليصه المالي وحدةٌ مستقلّة
        </motion.p>
      </div>
    </div>
  );
}

export { ACCENT };
