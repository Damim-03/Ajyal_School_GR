/**
 * شاشةُ اختيار المستخدم.
 *
 * **وهي طبقةٌ فوق البيئة لا شاشةٌ تحلّ محلَّها.** تُركَّب داخل شاشة
 * الإقلاع بعد ضغط Enter، فتبقى لوحةُ `CinematicEnvironment` هي هي: لا
 * تُفكَّك ولا تُعاد تهيئتُها، والغبارُ يواصل انجرافه والنغمةُ تمتدّ.
 * وهذا هو شرطُ «البقاء داخل الفضاء نفسه» — ولو كانت صفحةً في الموجّه
 * لأُعيد تركيبُ اللوحة وبدأ المشهد من الصفر.
 *
 * والتقسيمُ ثلاثُ طبقات:
 *
 *   InputManager  →  حالةُ التنقّل  →  الكاروسيل
 *
 * المفاتيحُ لا تعرف شكلَ البطاقات، والبطاقاتُ لا تسمع المفاتيح.
 */

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Loader2, Power, RotateCcw, type LucideIcon } from "lucide-react";

import { apiClient } from "../../core/api/client";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import type { User } from "../../core/types";
import { MOTION } from "../../motion/system";
import { authExit, blackoutAt, homeEntrance, useHomeMounted } from "../../motion/home-entrance";
import { toggleFullscreen } from "../../lib/app-window";
import { requestPower } from "../../core/system/power";
import { playAmbient, sfx, stopAmbient } from "../../lib/sound";
import { uiSound } from "../../lib/ui-sound";
import { Avatar } from "../shared/Avatar";
import { Clock } from "./Clock";
import { ControllerHints } from "./ControllerHints";
import { PowerButton } from "./PowerButton";
import { UserCarousel } from "./UserCarousel";
import type { Profile, Slot, Stage } from "./types";

/**
 * قياسُ الصورة بحسب العرض — درجاتٌ لا تناسبٌ خطّي.
 *
 * الضربُ في عاملٍ ثابت يُخرج على 4K صوراً بقطر ثلاثمئة بكسلٍ منطقيّ
 * تبتلع الشاشة، وعلى 1280 صوراً لا تُقرأ. والدرجاتُ تحفظ التناسبَ
 * البصريّ في كلّ مقاسٍ من المقاسات الأربعة المطلوبة.
 */
const avatarFor = (width: number) =>
  width >= 2400 ? 132 : width >= 1700 ? 116 : width >= 1400 ? 104 : 92;

export function UserSelectionScreen({
  onAuthenticated,
  onLeaving,
}: {
  onAuthenticated: () => void;
  /**
   * يُنادى لحظةَ نجاح المصادقة — قبل الانتقال بأكثر من ثانية.
   *
   * الشاشةُ لا تملك البيئة (يملكها من ركّبها)، فلا تستطيع إخفاتها
   * بنفسها. وهذا هو الخيط الذي تشدّه: «لقد انتهيتُ، اطفئ الفضاء».
   */
  onLeaving?: () => void;
}) {
  const setAuth = useAuthStore((s) => s.setAuth);
  const schoolName = useSchool("school.name_ar");

  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stage, setStage] = useState<Stage>("loading");
  const [index, setIndex] = useState(0);
  const [onPower, setOnPower] = useState(false);

  const [target, setTarget] = useState<Profile | null>(null);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmingExit, setConfirmingExit] = useState(false);

  const [avatarSize, setAvatarSize] = useState(() => avatarFor(window.innerWidth));
  const passwordRef = useRef<HTMLInputElement>(null);


  /* الخانات: «إضافة» أوّلاً كما في المرجع، ثمّ الحسابات */
  const slots = useMemo<Slot[]>(
    () => [{ kind: "add" }, ...profiles.map((profile) => ({ kind: "user" as const, profile }))],
    [profiles],
  );

  // --------------------------------------------------
  // البيانات
  // --------------------------------------------------

  useEffect(() => {
    let alive = true;

    apiClient
      .get("/auth/profiles")
      .then(({ data }) => {
        if (!alive) return;

        const list = (data?.data?.profiles ?? []) as Profile[];

        setProfiles(list);
        /* التركيزُ على أوّل حسابٍ لا على «إضافة» — إن وُجد حساب */
        setIndex(list.length > 0 ? 1 : 0);
        setStage("choosing");
      })
      .catch(() => {
        /*
         * تعذّرت القراءة — الشاشةُ تبقى صالحةً بخانة «إضافة» وحدها،
         * ومنها يُكتب اسمُ المستخدم وكلمتُه. فانقطاعُ الخادم لا يترك
         * المستخدم أمام شاشةٍ لا مخرجَ منها.
         */
        if (alive) setStage("choosing");
      });

    return () => {
      alive = false;
    };
  }, []);

  /**
   * نغمةُ اختيار المستخدم — تبدأ إن لم تكن تعمل.
   *
   * في مسار الإقلاع تكون شاشةُ الإقلاع قد شغّلتها منذ جملة التحذير،
   * و`playAmbient` يُهمل الطلبَ المكرّر — فلا تنقطع ولا تُستأنف من
   * أوّلها. وفي مسار الخروج من الحساب لا أحدَ شغّلها، فكانت الشاشةُ
   * تُفتح على صمت. والسطرُ الواحد يغطّي الحالتين.
   */
  useEffect(() => {
    playAmbient("select", 1200);
  }, []);

  useEffect(() => {
    const onResize = () => setAvatarSize(avatarFor(window.innerWidth));

    window.addEventListener("resize", onResize);

    return () => window.removeEventListener("resize", onResize);
  }, []);

  // --------------------------------------------------
  // المدخلات — طبقةٌ مستقلّة عن الرسم
  // --------------------------------------------------

  /**
   * النقرُ ينقل التركيز، والنقرةُ الثانية تفعّل.
   *
   * جرّبتُ نقلَه بالمرور فكان أسوأ: `onPointerEnter` ينطلق حين يظهر
   * عنصرٌ **تحت مؤشّرٍ ساكن** لا حين يدخله المستخدم، فكان التركيزُ
   * الابتدائيّ يُسرَق لحظةَ رسم الصفّ إن صادف المؤشّرُ إحدى البطاقات.
   * ومع ذلك يبقى الأصلُ أنّ المرور ليس قصداً — والقصدُ نقرة.
   *
   * والخطوتان (نقلٌ ثمّ تفعيل) هما سلوكُ الكاروسيل نفسِه بالسهم: تصل
   * إلى البطاقة ثمّ تؤكّد. فالفأرةُ تتبع المنطق نفسَه ولا تفتح لنفسها
   * طريقاً ثانياً يقفز فوق خطوة.
   */
  const pick = (at: number) => {
    if (at !== index) {
      setOnPower(false);
      uiSound("navigate");
      setIndex(at);
      return;
    }

    activate(at);
  };

  const activate = (at: number) => {
    const slot = slots[at];
    if (!slot) return;

    uiSound("confirm");
    setError(null);
    setPassword("");
    setUsername("");
    setTarget(slot.kind === "user" ? slot.profile : null);
    setStage("password");
  };

  useEffect(() => {
    if (stage === "loading" || stage === "leaving") return;

    const onKey = (event: KeyboardEvent) => {
      if (stage === "password") {
        if (event.key === "Escape") {
          event.preventDefault();
          uiSound("back");
          setStage("choosing");
          setTarget(null);
        }
        return;
      }

      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        event.preventDefault();

        /*
         * الاتّجاهُ منطقيٌّ لا بصريّ: الصفُّ يُرسم `dir="ltr"` ليطابق
         * المرجع، فاليمينُ هو التالي في الترتيب دائماً.
         */
        const step = event.key === "ArrowRight" ? 1 : -1;

        setOnPower(false);
        setIndex((current) => {
          const next = Math.min(slots.length - 1, Math.max(0, current + step));

          if (next !== current) uiSound("navigate");

          return next;
        });
        return;
      }

      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        uiSound("focus");
        setOnPower(event.key === "ArrowDown");
        return;
      }

      if (event.key === "F11") {
        event.preventDefault();
        void toggleFullscreen();
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();

        if (onPower) {
          uiSound("confirm");
          setConfirmingExit(true);
          return;
        }

        activate(index);
      }
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, index, onPower, slots.length]);

  useEffect(() => {
    if (stage === "password") passwordRef.current?.focus();
  }, [stage, target]);

  // --------------------------------------------------
  // الدخول
  // --------------------------------------------------

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (busy) return;

    setBusy(true);
    setError(null);

    try {
      const { data } = await apiClient.post("/auth/login", {
        ...(target ? { userId: target.id } : { username: username.trim() }),
        password,
      });

      const accessToken = data.data.accessToken as string;
      setAuth(data.data.user as User, accessToken);

      /* الصلاحيات لا تأتي مع الدخول — الخادم يرسلها من `/auth/me` وحده */
      const me = await apiClient.get("/auth/me");
      setAuth(me.data.data.user as User, accessToken);

      await useSchoolStore.getState().load(true);

      /**
       * تسلسلُ الخروج — **صار طرفاً في جدولٍ واحد، لا مشهداً مستقلّاً**.
       *
       * ما كان: الشاشةُ تُنهي مشهدَها كاملاً ثمّ تسلّم بعد 1350ms، فتبدأ
       * الرئيسيةُ إقلاعَها من الصفر (‏1240ms أخرى). مشهدان متعاقبان
       * بينهما إطارٌ لا يملكه أحد — تُدمَّر فيه لوحةُ البيئة قبل أن
       * تُرسم الرئيسية. المجموع نحو 2.6 ثانية.
       *
       * ما صار: `homeEntrance.start("auth")` يفتح ساعةً واحدة تملك
       * الرحلةَ كلَّها (‏motion/home-entrance)، والرئيسيةُ تُركَّب **تحت**
       * هذه الشاشة عند 120ms بينما هي ما زالت تنسحب فوقها. لا مؤقّتَ
       * هنا: التسليمُ يُعلَن من الجدول ويُلتقط في الأثر أدناه.
       *
       * **والموسيقى تخفت ولا تُقطع — على امتداد حياة الشعار بالضبط.**
       *
       * كانت 1150ms، وهو رقمٌ اختير حين كان المشهدُ البصريّ أقصرَ منه.
       * وصار `blackoutAt`: النغمةُ تنسحب طوالَ ما يحضر الشعارُ فوق
       * الفضاء، وتبلغ الصمتَ في اللحظة التي يبدأ فيها الفضاءُ نفسُه
       * بالذهاب. فيغادر السمعُ والبصرُ معاً، ولا يُقطع صوتٌ ليبدأ آخر —
       * وهذه هي النافذةُ التي بُنيت هذه اللحظةُ لتفتحها.
       *
       * ولا تُطفأ البيئةُ هنا: `onLeaving` يخفتها ولا يصفّرها (§4)،
       * فتبقى حيّةً تحت الشعار إلى أن تذهب معه.
       */
      sfx("enter", 0.92);
      setStage("leaving");
      onLeaving?.();
      stopAmbient(blackoutAt);

      homeEntrance.start("auth");
    } catch (err: unknown) {
      sfx("error", 0.95);

      const response = (err as { response?: { data?: { message?: string } } }).response;

      setError(response?.data?.message ?? "تعذّر الاتصال بالخادم");
      setBusy(false);
      passwordRef.current?.focus();
    }
  };

  const leaving = stage === "leaving";
  const choosing = stage === "choosing";

  /**
   * التسليم — يُعلنه الجدولُ ولا يجدوله هذا المكوّن.
   *
   * `onAuthenticated` يركّب الرئيسية (تبديلُ شجرةٍ في `App`، أو انتقالُ
   * مسارٍ في `SignInPage`). ومَن يقرّر لحظتَه هو `handoff.mount` في
   * جدول الدخول، لا مؤقّتٌ مكتوبٌ هنا — وإلّا عاد الرقمُ نفسُه مكتوباً
   * في موضعين يجب أن يتطابقا يدوياً.
   *
   * والمزلاجُ ضروري: `onAuthenticated` يصل مغلَّفاً بدالّةٍ سهمية في
   * `SignInPage`، فهويّتُه تتبدّل كلَّ عرض. بلا المزلاج كان الأثرُ
   * يُعاد تشغيلُه فيُستدعى `navigate` مراراً.
   */
  const homeMounted = useHomeMounted();
  const handedOff = useRef(false);

  useEffect(() => {
    if (!homeMounted || handedOff.current) return;
    handedOff.current = true;
    onAuthenticated();
  }, [homeMounted, onAuthenticated]);

  return (
    /*
      الانسحابُ بأربع قنواتٍ لا بالشفافية وحدها (§5).

      كان `opacity: 1 → 0` على 550ms — أي **غياب** لا حركة، ولا شيء فيه
      يقول أين ذهب ما غاب. والقنواتُ الثلاث المضافة صغيرةٌ إلى حدّ أنّ
      المستخدم يحسّها ولا يراها: انكماشٌ 1.5%، وهبوطٌ أربعةُ بكسلات،
      وتمويهٌ 4px. مجتمعةً تقول «هذا السطحُ ابتعد وخرج من البؤرة».

      و`transformOrigin` عند المركز: الكاروسيلُ مركزُ الشاشة بصرياً،
      فالانكماشُ نحوه انسحابٌ إلى العمق. ولو تُرك إلى الحافّة لبدا
      انزلاقاً جانبياً.

      **ولماذا CSS لا `motion` في هذا الموضع وحده.**

      لأنّ هذه الحركة — وحدها في التطبيق — يجب أن تمضي بينما الخيطُ
      الرئيسيّ محجوب. تركيبُ الرئيسية خلف هذه الشاشة يحجبه ~310ms مقيسةً
      على بناء الإنتاج، و`motion` يحسب إطاراته على الخيط نفسِه: قِستُ
      الأمر أوّلاً فوجدتُ الانسحابَ يتجمّد في منتصفه ثمّ يقفز إلى
      نهايته — أي أنّ أوّل ما يراه المستخدم بعد نجاح دخوله تقطيع.

      والشفافيةُ والتحويلُ والتمويه كلُّها قابلةٌ للتركيب، فانتقالُ CSS
      عليها ينتقل إلى خيط المُركِّب ويمضي بنفسه. فتبقى الحركةُ ناعمةً
      وإن توقّف الخيطُ الرئيسي تماماً — وهو بالضبط ما نحتاجه هنا.

      (وبقيّةُ الشاشة تبقى لـ`motion` كما كانت؛ لا لغةَ حركيةٌ ثانية
       تُفتح، بل استثناءٌ واحدٌ مبرَّرٌ بقياس.)
    */
    <div
      className="relative flex h-full flex-col"
      style={{
        transformOrigin: "50% 50%",
        opacity: leaving ? 0 : 1,
        transform: leaving ? `scale(${authExit.scale}) translateY(${authExit.y}px)` : "none",
        filter: leaving ? `blur(${authExit.blur}px)` : "none",
        transition: leaving
          ? `opacity ${authExit.duration}s cubic-bezier(${authExit.ease.join(",")}),` +
            ` transform ${authExit.duration}s cubic-bezier(${authExit.ease.join(",")}),` +
            ` filter ${authExit.duration}s cubic-bezier(${authExit.ease.join(",")})`
          : undefined,
        /* ترقيةٌ مسبقة: الطبقةُ تُرفع إلى المُركِّب قبل أن يُحجَب الخيط. */
        willChange: leaving ? "opacity, transform, filter" : undefined,
      }}
    >
      {/* ===== الساعة ===== */}
      {/*
        `dir="ltr"` صراحةً: «النهاية» في مستندٍ عربيّ هي اليسار، فكانت
        الساعة تظهر أعلى اليسار. والموضعُ هنا فيزيائيٌّ لا منطقيّ —
        ركنُ حالةِ النظام في واجهات الأجهزة أعلى اليمين أيّاً كانت لغةُ
        الواجهة، كما في شريط ويندوز نفسِه.
      */}
      <div dir="ltr" className="flex items-center justify-end px-10 pt-8">
        <Clock />
      </div>

      {/* ===== الترويسة والكاروسيل ===== */}
      <div className="flex flex-1 flex-col items-center justify-center gap-16">
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: MOTION.easing.enter, delay: 0.15 }}
          className="flex flex-col items-center gap-4"
        >
          {/*
            الخطُّ خفيفٌ لا عريض. العناوينُ الثقيلة لغةُ المواقع، وواجهةُ
            الجهاز تعتمد الحجمَ والفراغ لا سماكةَ الحرف.
          */}
          {/*
            العنوانُ يتراجع خطوةً: من `text-white/90` إلى `/72`، ومن
            `tracking-wide` إلى تباعدٍ أوسع. الهرمُ في هذه الشاشة ليس
            «العنوان أوّلاً» — العنوانُ يقول أين أنت، والوجوهُ هي
            المقصودة. فإن نازعها في السطوع صارت الشاشةُ صفحةَ عنوان.
          */}
          <h1
            className="text-center text-[34px] font-extralight leading-tight text-white/72"
            style={{ letterSpacing: "0.045em" }}
          >
            {schoolName}
          </h1>
          <p
            className="text-center text-[13px] font-light text-white/32"
            style={{ letterSpacing: "0.06em" }}
          >
            مَن يستعمل هذا الجهاز؟
          </p>
        </motion.div>

        {/*
          لا شعارَ بين العنوان والصفّ.

          كان هنا شعارُ المؤسسة (وقبله رمزُ ذراع تحكّم)، فزاحم الوجوهَ
          على النظرة الأولى: عنصرٌ ملوّنٌ في وسط الشاشة يسبق ما جاء
          المستخدمُ لأجله. والفراغُ في موضعه أنفعُ منه — هو الذي يفصل
          الترويسةَ عن الصفّ فيجعل الصفَّ مركزَ الثقل.

          وهويةُ المؤسسة حاضرةٌ في العنوان نفسِه، والبرنامجُ يُعرَّف في
          شاشة الإقلاع. فلا موضعَ ثالثاً يحتاج تسمية.
        */}
        <AnimatePresence mode="wait">
          {choosing ? (
            <motion.div
              key="carousel"
              initial={{ opacity: 0, y: 26 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: 0.75, ease: MOTION.easing.enter, delay: 0.55 }}
              className="w-full"
            >
              <UserCarousel
                slots={slots}
                index={index}
                avatarSize={avatarSize}
                addLabel="حساب آخر"
                onPick={pick}
              />
            </motion.div>
          ) : stage === "password" ? (
            <motion.form
              key="password"
              onSubmit={submit}
              initial={{ opacity: 0, y: 22 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -14 }}
              transition={{ duration: MOTION.duration.slow, ease: MOTION.easing.enter }}
              className="flex w-full max-w-80 flex-col items-center gap-5"
            >
              {target ? (
                <>
                  <Avatar
                    src={target.avatar}
                    name={`${target.firstName} ${target.lastName}`}
                    gender={target.gender}
                    size={avatarSize}
                    ring="rgba(255,255,255,0.55)"
                  />
                  <span className="text-lg font-light tracking-wide text-white/90">
                    {target.firstName} {target.lastName}
                  </span>
                </>
              ) : (
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                  autoComplete="username"
                  className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-center text-sm font-light text-white outline-none transition placeholder:text-white/25 focus:border-white/35"
                />
              )}

              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="كلمة المرور"
                autoComplete="current-password"
                className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-center text-sm font-light text-white outline-none transition placeholder:text-white/25 focus:border-white/35"
              />

              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="text-center text-xs font-light text-rose-300/80"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={busy}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/8 py-3 text-sm font-light tracking-wide text-white transition hover:bg-white/12 disabled:opacity-40"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                دخول
              </button>
            </motion.form>
          ) : null}
        </AnimatePresence>
      </div>

      {/* ===== زرّ الطاقة والتلميحات ===== */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: MOTION.easing.enter, delay: 0.95 }}
        className="px-10 pb-10"
      >
        {/*
          الطاقةُ يميناً والتلميحاتُ يساراً — والركنان فيزيائيان لا
          منطقيان، ولذلك `dir="ltr"` صراحةً.

          كان الزرُّ في وسط الأسفل، فوقع تحت زرّ «دخول» مباشرةً في مرحلة
          كلمة المرور — زرّان متجاوران رأسياً أحدُهما يُدخلك والآخر
          يُغلق التطبيق. وقربُ ما لا رجعةَ فيه من الفعل الشائع خطأٌ في
          التخطيط قبل أن يكون خطأً في الشكل: ركنُ الشاشة هو موضعُ ما
          يُقصد ولا يُصادَف.
        */}
        <div dir="ltr" className="flex items-end justify-between">
          <ControllerHints
            hints={
              choosing
                ? [
                    { key: "←→", label: "تنقّل" },
                    { key: "Enter", label: "اختيار" },
                  ]
                : [
                    { key: "Enter", label: "دخول" },
                    { key: "Esc", label: "رجوع" },
                  ]
            }
          />

          <PowerButton
            focused={onPower && choosing}
            title="خيارات النظام"
            onActivate={() => setConfirmingExit(true)}
          />
        </div>
      </motion.div>

      {/*
        **قائمةُ الطاقة.**

        فعلان لا رجعةَ في أيّهما، فلا يقع أحدُهما بضغطةٍ واحدةٍ على زرٍّ
        قد تصله بالسهم وأنت تتنقّل. والنافذةُ بلا زخارف فلا زرَّ إغلاقَ
        من ويندوز — ولذلك **يبقى «الإغلاق» هنا** وإن صارت الأيقونةُ
        تسمّي الإعادة: حذفُه كان سيسدّ المخرجَ الوحيد ويترك `Alt+F4`.

        وترتيبُهما بالتكرار لا بالخطورة: الإعادةُ تُطلب كثيراً فتصدّر،
        والإغلاقُ مرّةً في اليوم فيلي.
      */}
      <AnimatePresence>
        {confirmingExit && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: MOTION.duration.fast }}
            className="absolute inset-0 grid place-items-center bg-black/55 backdrop-blur-sm"
          >
            <div className="flex w-full max-w-64 flex-col gap-3 rounded-2xl border border-white/10 bg-[#080c14]/92 p-3">
              <p className="pt-1.5 text-center text-xs font-light tracking-wide text-white/45">
                خيارات النظام
              </p>

              <div className="flex flex-col gap-1.5">
                <PowerChoice
                  icon={RotateCcw}
                  label="إعادة التشغيل"
                  primary
                  onClick={() => {
                    uiSound("confirm");
                    requestPower("restart");
                  }}
                />

                <PowerChoice
                  icon={Power}
                  label="إيقاف التشغيل"
                  onClick={() => {
                    uiSound("confirm");
                    requestPower("off");
                  }}
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  uiSound("back");
                  setConfirmingExit(false);
                }}
                className="rounded-xl py-2 text-[11px] font-light text-white/40 transition hover:bg-white/6 hover:text-white/75"
              >
                تراجع
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * سطرٌ في قائمة النظام — أيقونةٌ وكلمة.
 *
 * ولا سطرَ شارحٌ تحته: «إعادة التشغيل» و«إيقاف التشغيل» كلمتان يعرفهما
 * كلُّ من استعمل حاسوباً، وشرحُهما يُطيل النافذةَ ويُبطئ قراراً مدّتُه
 * ثانية. والشرحُ يجب أن يُبذل حيث يُحتاج — وهنا لا يُحتاج.
 */
function PowerChoice({
  icon: Icon,
  label,
  primary = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-right text-[13px] font-light transition ${
        primary
          ? "bg-white/10 text-white hover:bg-white/16"
          : "bg-white/4 text-white/75 hover:bg-white/10 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      {label}
    </button>
  );
}
