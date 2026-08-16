import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Building2, Printer, Shield } from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { ADMIN_RESOURCES } from "./resource.config";

/**
 * محور الإعدادات.
 *
 * ما بقي هنا بعد الفرز: **المؤسسة وحساباتها**. أمّا الأطوار
 * والمستويات والأفواج والمواد فانتقلت إلى «البنية الدراسية» — لأنّها
 * هيكلُ المؤسسة يُبنى ويُعدَّل كل سنة، لا ضبطٌ تقنيّ يُفعل مرّةً
 * ويُنسى. وحقوق الاشتراك في المالية لأنّ السعر شأنٌ ماليّ.
 *
 * فما يستحقّ البقاء تحت «إعدادات» هو ما لا يتغيّر إلا نادراً: هويّة
 * المؤسسة، ومن يدخل النظام، وبأيّ صلاحية.
 */
export default function SettingsHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  const cards = [
    {
      key: "school",
      label: "هوية المدرسة",
      desc: "الاسم واللون والتواصل وما يُطبع على المستندات.",
      icon: Building2,
      tone: "#cbd5e1",
      to: PATHS.settingsSchool,
    },
    ...ADMIN_RESOURCES.map((r) => ({
      key: r.key,
      label: r.label,
      desc: r.desc,
      icon: r.icon,
      tone: r.tone,
      to: r.path,
    })),
    {
      key: "roles",
      label: "الأدوار والصلاحيات",
      desc: "ما يستطيعه كل دور — والمستخدم يرث صلاحياته من دوره.",
      icon: Shield,
      tone: "#fda4af",
      to: PATHS.settingsRoles,
    },
    {
      key: "print",
      label: "تجربة الطباعة",
      desc: "اطبع نموذجاً تجريبياً للتأكّد من الورق والهوامش والعربية قبل أول إيصال حقيقي.",
      icon: Printer,
      tone: "#fda4af",
      to: PATHS.settingsPrint,
    },
  ];

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الإعدادات" subtitle="المؤسسة والحسابات">
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
          {cards.map((c, i) => (
            <motion.button
              key={c.key}
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
                navigate(c.to);
              }}
              className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-white/25"
            >
              <span
                className="grid h-12 w-12 shrink-0 place-items-center rounded-xl transition group-hover:scale-105"
                style={{ background: `${c.tone}1f` }}
              >
                <c.icon className="h-6 w-6" style={{ color: c.tone }} />
              </span>

              <span className="min-w-0">
                <span className="block font-black">{c.label}</span>
                <span className="mt-1 block text-[12px] leading-relaxed text-white/45">
                  {c.desc}
                </span>
              </span>
            </motion.button>
          ))}
        </div>

        <p className="mt-8 text-center text-xs text-white/30">
          الأطوار والمستويات والأفواج والمواد في «البنية الدراسية»، وحقوق
          الاشتراك في «المالية».
        </p>
      </div>
    </div>
  );
}
