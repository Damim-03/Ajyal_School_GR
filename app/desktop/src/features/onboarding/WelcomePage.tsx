/**
 * مرحباً بك — **ما بعد التهيئة، لا جزءٌ منها** (§30/§65).
 *
 * التهيئةُ انتهت والنظامُ جاهز، والمؤسسةُ لم تُبنَ بعد: لا موادَّ ولا
 * أفواجَ ولا طلبة. وأسوأُ ما يُستقبَل به مستخدمٌ في هذه اللحظة أن
 * يُترك أمام شبكةِ بلاطاتٍ تفتح شاشاتٍ فارغة — أو أن يُساق إلى استمارةٍ
 * ثانيةٍ طويلة بعد أن قيل له «أنت جاهز».
 *
 * فهذه لوحةُ **بدايةٍ لا إلزام**: تقول ما بقي، وتفتح أوّلَ بابٍ منه،
 * وتترك الاستكشافَ مفتوحاً. ولا شيءَ فيها يمنع الدخولَ إلى أيّ شاشة.
 *
 * **والأعدادُ من القاعدة لا من علاماتٍ محفوظة.** من أضاف مادّةً من
 * شاشة المواد يجد البندَ متمّاً وإن لم يمرّ بهذه اللوحة قطّ — وعلامةٌ
 * تُحفظ عند «اضغط تمّ» كانت ستفترق عن الواقع في أوّل يوم.
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { Check, Circle } from "lucide-react";

import nexschoolLogo from "../../assets/nexschool/nexschool.png";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchool } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { uiSound } from "../../lib/ui-sound";
import {
  dismissOnboarding,
  fetchInstitutionProgress,
} from "../first-boot/services/firstBoot.service";
import type { InstitutionProgress } from "../first-boot/types/firstBoot.types";

/** البابُ الذي يفتحه كلُّ بند — وهي شاشاتٌ قائمةٌ لا شاشاتٌ تُبنى */
const AREA_PATHS: Record<string, string> = {
  stages: PATHS.academicStages,
  levels: PATHS.academicLevels,
  subjects: PATHS.academicSubjects,
  teachers: PATHS.teachersList,
  groups: PATHS.academicGroups,
  classrooms: PATHS.academicClassrooms,
  schedules: PATHS.schedulesWeekly,
  fees: PATHS.financeFees,
  policies: PATHS.financePolicies,
  students: PATHS.studentsList,
};

const AREA_LABELS: Record<string, string> = {
  stages: "الأطوار",
  levels: "المستويات",
  subjects: "المواد",
  teachers: "الأساتذة",
  groups: "الأفواج",
  classrooms: "القاعات",
  schedules: "الجداول",
  fees: "حقوق الاشتراك",
  policies: "سياسات التخليص",
  students: "الطلبة",
};

export default function WelcomePage() {
  const navigate = useNavigate();
  const token = useAuthStore((store) => store.accessToken);
  const user = useAuthStore((store) => store.user);
  const schoolName = useSchool("school.name_ar");

  const [progress, setProgress] = useState<InstitutionProgress | null>(null);

  useEffect(() => {
    if (!token) return;

    fetchInstitutionProgress(token)
      .then(setProgress)
      .catch(() => {
        /*
         * سقوطُ القراءة لا يُسقط الشاشة: تبقى بالترحيب وزرَّي الانتقال.
         * فقائمةُ ما بقي راحةٌ لا شرطٌ لدخول التطبيق.
         */
      });
  }, [token]);

  /**
   * «لا تعرضها ثانيةً» — تُحفظ في الخادم لا في الجهاز.
   *
   * فالمؤسسةُ التي بنت هيكلها من حاسوب الإدارة لا يُعرض عليها الترحيبُ
   * على حاسوب الأمانة كأنّها لم تبدأ. وهذا فرقٌ يظهر في اليوم الأوّل
   * من التركيب على أكثر من جهاز.
   */
  const hide = () => {
    if (token) void dismissOnboarding(token);

    uiSound("navigate");
    navigate(PATHS.home);
  };

  const percent = progress?.percent ?? 0;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col justify-center gap-8 p-8">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.slow, ease: MOTION.easing.enter }}
          className="flex items-center gap-4"
        >
          <img src={nexschoolLogo} alt="" className="h-14 w-auto" />

          <div>
            <h1 className="text-2xl font-black">
              {user ? `أهلاً ${user.firstName}` : "أهلاً بك في NexSchool"}
            </h1>
            <p className="mt-1 text-sm text-white/55">
              نظامُ {schoolName} جاهز. لنبنِ الآن مؤسستك.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: MOTION.duration.slow,
            delay: 0.08,
            ease: MOTION.easing.enter,
          }}
          className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"
        >
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-bold text-white/70">
              تقدّمُ بناء المؤسسة
            </span>
            <span className="text-2xl font-black tabular-nums">{percent}٪</span>
          </div>

          {/* الشريطُ يعكس عدداً محسوباً من القاعدة — لا تقدّماً مصنوعاً (§43) */}
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full rounded-full bg-sky-300"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.8, ease: MOTION.easing.enter }}
            />
          </div>

          <div className="mt-5 grid gap-1.5 sm:grid-cols-2">
            {(progress?.areas ?? []).map((area) => (
              <button
                key={area.key}
                onClick={() => {
                  uiSound("navigate");
                  navigate(AREA_PATHS[area.key] ?? PATHS.home);
                }}
                className="flex items-center gap-3 rounded-xl px-3 py-2 text-right transition hover:bg-white/5"
              >
                {area.done ? (
                  <Check className="h-4 w-4 shrink-0 text-emerald-300" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-white/25" />
                )}

                <span
                  className={
                    area.done
                      ? "flex-1 text-sm text-white/75"
                      : "flex-1 text-sm text-white/50"
                  }
                >
                  {AREA_LABELS[area.key] ?? area.key}
                </span>

                {area.count > 0 && (
                  <span className="text-xs tabular-nums text-white/35">
                    {area.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: MOTION.duration.slow,
            delay: 0.16,
            ease: MOTION.easing.enter,
          }}
          className="flex flex-wrap items-center gap-3"
        >
          <button
            onClick={() => {
              uiSound("navigate");
              navigate(PATHS.academic);
            }}
            className="rounded-xl bg-sky-300 px-6 py-3 text-sm font-black text-[#041018] transition hover:bg-sky-200"
          >
            متابعة الإعداد
          </button>

          <button
            onClick={hide}
            className="rounded-xl border border-white/15 px-6 py-3 text-sm font-bold text-white/75 transition hover:border-white/30 hover:text-white"
          >
            استكشاف NexSchool
          </button>
        </motion.div>
      </div>
    </div>
  );
}
