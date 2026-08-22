import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import {
  ArrowRight,
  BadgeDollarSign,
  Percent,
  Printer,
  Receipt,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { uiSound } from "../../lib/ui-sound";
import { listInvoices, listPayments, money } from "./finance.api";

const ACCENT = "#ff8fb1";

/**
 * محور المالية.
 *
 * البطاقتان الأوليان تحملان رقمَين لهما معنى تشغيلي: كم فاتورة متأخّرة
 * الآن، وكم حُصِّل اليوم. الأولى تقول «هنا عمل ينتظر»، والثانية تقول
 * «هذا ما أُنجز».
 *
 * والصفّ الثاني هو **الإعداد** لا التشغيل: ما يدخل الطالب وما يخرج
 * للأستاذ. كان الأول في الإعدادات بين القاعات وأوقات الحصص، وهذا خلطٌ
 * بين وصف البنية الدراسية ووصف المال.
 *
 * الإيصالات ليست شاشة مستقلّة عمداً: الإيصال يُطبع من الدفعة التي
 * أنشأته، وشاشةٌ مستقلّة له تفصل الورقة عن سببها.
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
    key: "invoices",
    label: "الفواتير",
    desc: "متابعة المستحقّ والمتأخّر، والبحث بمسح باركود الورقة المطبوعة.",
    icon: Receipt,
    to: PATHS.invoices,
    tone: "#ff8fb1",
  },
  {
    key: "payments",
    label: "المدفوعات",
    desc: "دفعة واحدة تُسدّد عدّة فواتير، ينتهي تسجيلها بمعاينة الإيصال وطباعته.",
    icon: Wallet,
    to: PATHS.payments,
    tone: "#a5b4fc",
  },
  {
    key: "fees",
    label: "حقوق الاشتراك",
    desc: "سعر كل مادة — لفوج أو مستوى أو طور أو نوعية. والأخصّ نطاقاً هو الذي يُطبَّق.",
    icon: BadgeDollarSign,
    to: PATHS.financeFees,
    tone: "#86efac",
  },
  {
    key: "policies",
    label: "سياسات التخليص",
    desc: "كيف يُحسب مستحقّ الأستاذ: نسبةً من الحقوق، أو مبلغاً لكل طالب أو حصة أو حضور.",
    icon: Percent,
    to: PATHS.financePolicies,
    tone: "#fbbf24",
  },
];

export default function FinanceHubPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");

  const [stats, setStats] = useState<{ overdue: number; collected: number } | null>(null);

  useEffect(() => {
    let alive = true;
    /* اليوم بتوقيت الجهاز لا UTC — بعد الحادية عشرة ليلاً يختلفان يوماً */
    const n = new Date();
    const today = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;

    Promise.all([
      listInvoices({ limit: 1, overdue: true }),
      listPayments({ limit: 100, dateFrom: today, dateTo: today, status: "ACTIVE" }),
    ])
      .then(([od, pay]) => {
        if (!alive) return;
        setStats({
          overdue: od.pagination.total,
          collected: pay.payments.reduce((s, p) => s + p.amount, 0),
        });
      })
      .catch(() => {
        /* الأرقام زينة لا شرط */
      });

    return () => { alive = false; };
  }, []);

  const badgeOf = (key: string) => {
    if (!stats) return null;
    if (key === "invoices")
      return stats.overdue > 0 ? `${stats.overdue} فاتورة متأخّرة` : "لا متأخرات";
    if (key === "payments") return `محصَّل اليوم ${money(stats.collected, currency)}`;
    return null;
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="المالية" subtitle="الفواتير والمدفوعات">
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

                <p className="flex-1 text-[13px] leading-relaxed text-white/50">{card.desc}</p>

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
          className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-white/30"
        >
          <Printer className="h-3.5 w-3.5" />
          الإيصالات تُطبع من شاشة المدفوعات — بعد كل دفعة تُسجَّل، وبإعادة طباعة عند اللزوم
        </motion.p>
      </div>
    </div>
  );
}

export { ACCENT };
