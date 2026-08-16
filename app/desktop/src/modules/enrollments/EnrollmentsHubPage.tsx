import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  ArrowRightLeft,
  Info,
  Table2,
  UserPlus,
  type LucideIcon,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";

const ACCENT = "#fda4af";

/**
 * محور إسناد الطلبة.
 *
 * ثلاث شاشات لثلاثة أسئلة مختلفة، وفصلُها ليس ترتيباً للقوائم:
 *
 *   • الإسناد يبدأ من **الطالب**: أين يذهب هذا الواحد؟
 *   • النقل يبدأ من **إسنادٍ قائم**: هذا في الفوج الخطأ، صحّحه.
 *   • العرض يبدأ من **الفوج**: مَن فيه؟ وما وضعية كلٍّ منهم؟
 *
 * ومن يجمعها في شاشة واحدة يجعل المستخدم يبحث عن مدخله في كل مرة.
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
    key: "assign",
    label: "إسناد طالب",
    desc: "اختر الطالب ثم مادته عند أستاذها في فوجه — والطور والمستوى يضيّقان الاختيار فلا يقع خلط.",
    icon: UserPlus,
    to: PATHS.enrollmentsAssign,
    tone: "#fda4af",
  },
  {
    key: "transfer",
    label: "نقل بين الأفواج",
    desc: "غيّر فوج الطالب في مادةٍ بعينها. القديم يُعطَّل ويبقى بفواتيره وحضوره، ولا يقع الطالب في فوجين.",
    icon: ArrowRightLeft,
    to: PATHS.enrollmentsTransfer,
    tone: "#c4b5fd",
  },
  {
    key: "browse",
    label: "عرض الطلبة",
    desc: "صفِّ الأفواج حتى يبقى الفوج الذي تريده وحده، ثم افتح ملفّ أيّ طالب: بياناته وحضوره وديونه ووضعيته.",
    icon: Table2,
    to: PATHS.enrollmentsBrowse,
    tone: "#7dd3fc",
  },
];

export default function EnrollmentsHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="إسناد الطلبة" subtitle="كل طالب في فوجه">
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
          {CARDS.map((card, i) => (
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
              style={{ minHeight: 240 }}
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
          الطالب يُسند إلى مادةٍ عند أستاذٍ في فوج — والثلاثة صفٌّ واحد قائم لا
          تركيبةٌ تُؤلَّف
        </motion.p>
      </div>
    </div>
  );
}

export { ACCENT };
