import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight } from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { RESOURCES } from "../settings/resource.config";

/**
 * البنية الدراسية.
 *
 * كانت هذه الشاشات السبع تحت «الإعدادات»، وذلك خطأُ تصنيف: الأطوار
 * والمستويات والأفواج والمواد ليست ضبطاً تقنياً يُفعل مرّةً عند
 * التنصيب ثم يُنسى — هي **هيكل المؤسسة نفسه**، يُبنى في مطلع كل سنة
 * ويُعدَّل كلّما فُتح فوجٌ أو أُضيفت مادة.
 *
 * والترتيب يتبع **التبعية لا الأبجدية**: السنة والأطوار أولاً لأنّ
 * المستويات تحتاجها، والأفواج تحتاج المستويات. من يبدأ من الأعلى لا
 * يصطدم بقائمةٍ فارغة.
 */
export default function AcademicHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="البنية الدراسية" subtitle="هيكل المؤسسة">
        <button
          onClick={() => exitToHome(PATHS.home)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-325 p-6 pt-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {RESOURCES.map((r, i) => (
            <motion.button
              key={r.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: MOTION.duration.normal,
                delay: Math.min(i * 0.04, 0.3),
                ease: MOTION.easing.enter,
              }}
              whileHover={{ y: -3 }}
              onClick={() => {
                uiSound("navigate");
                navigate(r.path);
              }}
              className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-white/25"
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl transition group-hover:scale-105"
                style={{ background: `${r.tone}1f` }}
              >
                <r.icon className="h-6 w-6" style={{ color: r.tone }} />
              </span>

              <span className="min-w-0">
                <span className="block font-black">{r.label}</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-white/45">
                  {r.desc}
                </span>
              </span>
            </motion.button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          ابدأ من الأعلى: السنة الدراسية ← الأطوار ← المستويات ← الأفواج ←
          المواد. وحقوق الاشتراك في شاشة المالية.
        </p>
      </div>
    </div>
  );
}
