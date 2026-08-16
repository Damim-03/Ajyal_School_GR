import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { GraduationCap, Loader2, LogIn } from "lucide-react";

import { apiClient } from "../../../core/api/client";
import { useAuthStore } from "../../../core/stores/auth.store";
import { useSchool, useSchoolStore } from "../../../core/stores/school.store";
import { PATHS } from "../../../routes/paths";
import { AmbientBackground } from "../../../components/ambient/AmbientBackground";
import { MOTION } from "../../../motion/system";
import { sfx, playAmbient, stopAmbient } from "../../../lib/sound";
import type { User } from "../../../core/types";

/**
 * شاشة الدخول.
 *
 * تفترق عن نظيرتها في SKK في نقطة جوهرية: هناك تُعرض قائمة المستخدمين
 * ليختار المستخدم صورته ثم يكتب كلمته. هنا لا يمكن ذلك — `/users` في
 * خادم أجيال محميّ بصلاحية `user.view`، فلا سبيل لجلب القائمة قبل
 * الدخول. وكشفُ أسماء الحسابات لمن لم يدخل بعدُ تسريبٌ لا داعي له.
 * فالنموذج مباشر: اسم المستخدم وكلمة المرور.
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  /*
   * الهوية تُقرأ من المتجر بافتراضياتها قبل الدخول، وتُحمَّل من الخادم
   * بعده — القراءة تحتاج مصادقة، فشاشة الدخول تعرض الافتراضي أو آخر
   * قيمة عرفها هذا الجهاز.
   */
  const schoolName = useSchool("school.name_ar");
  const shortName = useSchool("school.short_name");
  const shortSuffix = useSchool("school.short_suffix");
  const brand = useSchool("school.brand_color");

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    playAmbient("select");
    usernameRef.current?.focus();
    return () => stopAmbient(600);
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const { data } = await apiClient.post("/auth/login", {
        username: username.trim(),
        password,
      });

      const user = data.data.user as User;
      const accessToken = data.data.accessToken as string;

      /*
       * الصلاحيات لا تأتي مع /auth/login — الخادم يرسلها من /auth/me
       * وحده. نجلبها فوراً وإلا فتح المستخدمُ الرئيسيةَ بلا صلاحيات
       * فبدت كلّ الأقسام ممنوعةً عليه.
       */
      setAuth(user, accessToken);

      const me = await apiClient.get("/auth/me");
      setAuth(me.data.data.user as User, accessToken);

      /* هوية المدرسة صارت متاحة الآن — تُحمَّل قبل رسم الرئيسية */
      await useSchoolStore.getState().load(true);

      sfx("enter", 0.55);
      navigate(PATHS.home, { replace: true });
    } catch (err: unknown) {
      sfx("error", 0.5);

      const response = (err as { response?: { data?: { message?: string } } })
        .response;

      setError(response?.data?.message ?? "تعذّر الاتصال بالخادم");
      setBusy(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05070d] text-white">
      <AmbientBackground />

      <div className="relative z-10 grid min-h-screen place-items-center px-6">
        <motion.form
          onSubmit={submit}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: MOTION.duration.slow,
            ease: MOTION.easing.enter,
          }}
          className="w-full max-w-95 rounded-3xl border border-white/10 bg-white/5 p-8 backdrop-blur-xl"
          style={{ boxShadow: "0 30px 80px -40px rgba(125,211,252,0.45)" }}
        >
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <span
              className="grid h-16 w-16 place-items-center rounded-2xl"
              style={{ background: `${brand}24` }}
            >
              <GraduationCap className="h-8 w-8" style={{ color: brand }} />
            </span>
            <div>
              <div className="flex items-baseline justify-center gap-1.5">
                <span className="text-2xl font-black">{shortName}</span>
                <span className="text-2xl font-black" style={{ color: brand }}>
                  {shortSuffix}
                </span>
              </div>
              <div className="mt-1 text-xs text-white/50">{schoolName}</div>
            </div>
          </div>

          <label className="mb-4 block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">
              اسم المستخدم
            </span>
            <input
              ref={usernameRef}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              dir="ltr"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left outline-none transition focus:border-[#7dd3fc]/60"
            />
          </label>

          <label className="mb-6 block">
            <span className="mb-1.5 block text-xs font-bold text-white/60">
              كلمة المرور
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              dir="ltr"
              className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-left outline-none transition focus:border-[#7dd3fc]/60"
            />
          </label>

          {/*
            الخطأ يُعرض حيث وقع لا في ركن الشاشة: الرسالة القادمة من
            الخادم كما هي — «اسم المستخدم أو كلمة المرور غير صحيحة»
            أو «تجاوزت عدد المحاولات» — فلا يُخمّن المستخدم السبب.
          */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
            >
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            style={{ background: brand }}
            className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-black text-[#04121c] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? (
              <Loader2 className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <LogIn className="h-4.5 w-4.5" />
            )}
            {busy ? "جارٍ الدخول…" : "دخول"}
          </button>
        </motion.form>
      </div>
    </div>
  );
}
