import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeDollarSign,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  Info,
  type LucideIcon,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";

const ACCENT = "#fcd34d";

/**
 * محور الكشوف.
 *
 * أربع أوراق تخرج من المؤسسة شهرياً، وكلّها تُقرأ على الحصة الفعلية
 * (Session) لا على الجدول الأسبوعي. جمعُها في محور واحد ليس ترتيباً
 * للقوائم: الموظّف الذي يملأ كشف الحضور هو نفسه الذي يُخلّص الحصص مع
 * الأستاذ ويحصّل حقوق الشهر، وتفريقُها على ثلاثة أقسام يجعله يبحث عن
 * الورقة بدل أن يجدها حيث يعمل.
 */

interface Card {
  key: string;
  label: string;
  desc: string;
  icon: LucideIcon;
  to: string | null;
  tone: string;
}

const CARDS: Card[] = [
  {
    key: "daily",
    label: "كشف الحضور اليومي",
    desc: "ورقة الشهر لكل مادة وفوج: عمودٌ لكل حصة بتاريخها، وحضورٌ يُعدَّل من الخلية مباشرة.",
    icon: ClipboardCheck,
    to: PATHS.attendanceDaily,
    tone: "#fcd34d",
  },
  {
    key: "fees",
    label: "كشف دفع الحقوق الشهري",
    desc: "طلبة الفوج في شهر الكشف: حصصُ كلٍّ منهم، وتأكيد دفعه بتاريخه، وورقةٌ تُطبع للإمضاء.",
    icon: BadgeDollarSign,
    to: PATHS.attendanceMonthlyFees,
    tone: "#86efac",
  },
  {
    key: "clearance",
    label: "كشف التخليص اليومي",
    desc: "حصص اليوم مع كل أستاذ، وأيُّها استُوفيت ورقة حضوره وأيُّها بقيت.",
    icon: ClipboardList,
    to: null,
    tone: "#93c5fd",
  },
  {
    key: "expected",
    label: "الكشف التقديري للحصص",
    desc: "مستحقّ الأستاذ عن كشفٍ بعينه، ومعه حضور كل طالب ومَن بقي عليه دَين.",
    icon: CalendarClock,
    to: PATHS.attendanceExpected,
    tone: "#93c5fd",
  },
];

export default function AttendanceHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الكشوف" subtitle="الحضور والحصص والحقوق">
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
          {CARDS.map((card, i) => {
            const ready = card.to !== null;

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
                whileHover={ready ? { y: -4 } : undefined}
                disabled={!ready}
                onClick={() => {
                  if (!card.to) return;
                  uiSound("navigate");
                  navigate(card.to);
                }}
                className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-right transition enabled:hover:border-white/25 disabled:cursor-default disabled:opacity-45"
                style={{ minHeight: 210 }}
              >
                <span
                  className="mb-4 grid h-14 w-14 place-items-center rounded-2xl transition group-enabled:group-hover:scale-105"
                  style={{ background: `${card.tone}1f` }}
                >
                  <card.icon className="h-7 w-7" style={{ color: card.tone }} />
                </span>

                <h2 className="mb-1.5 text-lg font-black">{card.label}</h2>

                <p className="flex-1 text-[13px] leading-relaxed text-white/50">{card.desc}</p>

                {!ready && (
                  <span className="mt-4 rounded-full bg-white/10 px-3 py-1 text-[11px] font-bold text-white/50">
                    قيد الإنجاز
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
          className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-white/30"
        >
          <Info className="h-3.5 w-3.5" />
          أعمدة الكشوف تُبنى من الحصص المسجَّلة فعلاً — تُولَّد من قسم الجداول، لا من هنا
        </motion.p>
      </div>
    </div>
  );
}

export { ACCENT };
