import { useCallback, useEffect, useRef, useState } from "react";

import { LAYER } from "../../motion/layers";
import nexschoolLogo from "../../assets/nexschool/nexschool.png";
import { UserSelectionScreen } from "../../components/user-selection/UserSelectionScreen";
import { sfx, playAmbient } from "../../lib/sound";
import { useSchool } from "../../core/stores/school.store";
import { curve, environment, useHomeRevealed } from "../../motion/home-entrance";
import { BootStage } from "./engine/BootStage";
import type { BootPhase } from "./engine/boot.config";

/**
 * **شاشةُ الإقلاع — مشهدٌ حقيقيٌّ على الوحدة الرسومية، لا تتابعُ مؤقّتات.**
 *
 * ما كان: أربعُ مراحلَ يقودها `setTimeout` (شعارٌ ستَّ ثوانٍ، ثمّ تحذيرٌ
 * خمساً، ثمّ «اضغط Enter»)، وخلفها مشهدٌ على `canvas 2d` يرسم ألفَ جسيمٍ
 * بالمعالج المركزيّ.
 *
 * وما صار: **جدولٌ واحدٌ حتميّ** يملك تسعَ ثوانٍ بثلاثةَ عشرَ طوراً
 * (`engine/BootTimeline`)، ومحرّكُ جسيماتٍ على WebGL2 يقرأ منه
 * (`engine/BootRenderer`). ولا `setTimeout` في الملفّ كلِّه.
 *
 * ## تقسيمُ المسؤولية
 *
 *   المحرّك (خارج React)  →  الجسيمات، الحقل، الوهج، الجوّ
 *   هذا الملفّ (React)     →  الشعار، الحجاب، هويّةُ المؤسسة، المصادقة
 *
 * والوصلُ بينهما خيطٌ واحد: `onPhase` يُنادى عند **تبدّل الطور** فقط —
 * ثلاثَ عشرةَ مرّةً في تسع ثوانٍ، لا ستّين مرّةً في الثانية.
 *
 * ## ولماذا لا تُفكَّك الطبقةُ بعد التسليم
 *
 * تبقى مركَّبةً فوق الرئيسية تنسحب (§6 في نظام الدخول): لو فُكّكت في
 * الإطار الذي تُركَّب فيه الرئيسيةُ تحتها لومض السوادُ بينهما. ولذلك
 * قاعُها **مشروط**: أسودُ ما دامت هي الشاشة، وشفّافٌ حين تصير طبقةً
 * منسحبة.
 */

/** الأطوارُ التي يُرى فيها الشعار. */
const LOGO_PHASES = new Set<BootPhase>(["BOOT_IDLE", "LOGO_REVEAL", "LOGO_HOLD"]);

/** أوّلُ طورٍ يُسمع فيه صوت — مع أوّل بذرة، لا قبلها. */
const SOUND_AT: BootPhase = "BLUE_SEED";

/** الأطوارُ التي تُعرض فيها هويّةُ المؤسسة — أثناء بناء الحقل. */
const NOTICE_PHASES = new Set<BootPhase>([
  "BLUE_FLOW",
  "GOLD_INTRODUCTION",
  "BLUE_GOLD_INTERACTION",
  "WARM_BLOOM",
]);

export function BootScreen({
  onDone,
  skipIntro = false,
}: {
  onDone: () => void;
  /**
   * تخطّي المشهد — ويُرفع بعد التهيئة الأولى مباشرةً.
   *
   * المستخدمُ خرج للتوّ من رحلةٍ انتهت بـ«أنت جاهز»، فأن يُعرض عليه
   * تسعُ ثوانٍ من الجسيمات ليختار الحسابَ الذي أنشأه قبل نصف دقيقة
   * نقضٌ للحظة التي بُنيت لأجلها تلك الشاشة. فيُقفز إلى الفضاء المستقرّ
   * ويُدخَل مباشرةً إلى اختيار المستخدم.
   */
  skipIntro?: boolean;
}) {
  /** الطورُ الجاري — يكتبه المحرّكُ عند تبدّله وحده. */
  const [phase, setPhase] = useState<BootPhase>(
    skipIntro ? "AUTHENTICATION_READY" : "BOOT_IDLE",
  );

  /** اختيارُ المستخدم مفتوح — بعد Enter، أو فوراً في مسار التخطّي. */
  const [choosing, setChoosing] = useState(skipIntro);

  /** المصادقةُ نجحت — الطبقةُ تنسحب. */
  const [leaving, setLeaving] = useState(false);

  const soundStarted = useRef(false);

  /*
   * الإقلاعُ يسبق الدخول، وقراءةُ الهوية تحتاج مصادقة — فتُعرض هنا
   * افتراضياتُ المتجر أو آخرُ قيمةٍ عرفها هذا الجهاز.
   */
  const shortName = useSchool("school.short_name");
  const shortSuffix = useSchool("school.short_suffix");
  const schoolName = useSchool("school.name_ar");
  const nameEn = useSchool("school.name_en");
  const brand = useSchool("school.brand_color");

  /**
   * التسليم — الرئيسيةُ **رُسمت**، لا مجرّد رُكّبت.
   *
   * والإشارةُ `revealed` يرفعها المنسّقُ حين تُعلن الرئيسيةُ جاهزيّتها
   * في أوّل إطارٍ بعد رسمها. وعندها تُرفع عن هذه الطبقة ثلاثةُ أشياء
   * دفعةً واحدة: سوادُ قاعها، والتقاطُها للمؤشّر، وتماسكُها البصريّ.
   */
  const departing = useHomeRevealed();

  /**
   * تبدّلُ الطور — الخيطُ الوحيد بين المحرّك وReact.
   *
   * وثابتُ الهويّة (`useCallback` بلا تبعيات متغيّرة): لو تبدّلت هويّتُه
   * في كلّ عرضٍ لأُعيد إنشاءُ السياق الرسوميّ — أربعةُ برامجَ تُترجم
   * وثلاثةُ أنسجةٍ ملءَ الشاشة تُخصَّص — لأنّ `BootStage` يقرؤه في
   * أثرٍ بلا تبعيات.
   */
  const onPhase = useCallback((next: BootPhase) => {
    setPhase(next);

    /*
     * النغمةُ تبدأ مع **أوّل بذرة** لا مع الشعار.
     *
     * فالصمتُ البصريّ (§7) يجب أن يكون صمتاً سمعياً أيضاً: نغمةٌ تعمل
     * فوق شاشةٍ سوداءَ صامتة تُقرأ خطأً في التشغيل. ومع أوّل نقطة ضوءٍ
     * يُقرأ الصوتُ **مصاحباً** لها.
     *
     * ونغمةٌ واحدة تمتدّ عبر المشهد كلِّه وعبر اختيار المستخدم بعده —
     * و`playAmbient` يُهمل الطلبَ المكرّر فلا تُستأنف من أوّلها.
     */
    if (next === SOUND_AT && !soundStarted.current) {
      soundStarted.current = true;
      playAmbient("select");
    }
  }, []);

  /*
   * مسارُ التخطّي: الفضاءُ مستقرٌّ والنغمةُ تبدأ فوراً — لا صمتَ يسبقها
   * لأنّه لا مشهدَ يسبقها.
   */
  useEffect(() => {
    if (!skipIntro || soundStarted.current) return;
    soundStarted.current = true;
    playAmbient("select");
  }, [skipIntro]);

  /* لا دخولَ إلا بضغط Enter — وهو سلوكٌ قائمٌ في المنتج، أُبقي كما هو. */
  useEffect(() => {
    if (choosing || phase !== "AUTHENTICATION_READY") return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      sfx("enter", 0.92);
      setChoosing(true);
    };

    window.addEventListener("keydown", onKey);

    return () => window.removeEventListener("keydown", onKey);
  }, [choosing, phase]);

  const showLogo = LOGO_PHASES.has(phase);
  const showNotice = NOTICE_PHASES.has(phase);
  const ready = phase === "AUTHENTICATION_READY";

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden text-white"
      style={{
        zIndex: LAYER.boot,
        /*
          القاعُ مشروطٌ لا ثابت: سوادٌ دائمٌ فيه كان سيحجب ما جاءت هذه
          الطبقةُ تكشفه — تتلاشى الطبقاتُ كلُّها فوق سوادٍ لا يتلاشى.
        */
        backgroundColor: departing ? "transparent" : "#04060c",
        opacity: departing ? 0 : 1,
        transition: `opacity ${environment.fade}ms cubic-bezier(${curve.ambient.join(",")})`,
        /* أوّلُ نقرةٍ بعد التسليم تخصّ الرئيسية لا هذه الطبقة (§23). */
        pointerEvents: departing ? "none" : "auto",
      }}
    >
      {/*
        ===== المحرّك =====

        يُركَّب مرّةً ويبقى عبر الأطوار كلِّها — بما فيها اختيارُ المستخدم
        فوقه. فالمصادقةُ ترث الجوَّ الذي نشأت فيه ولا تبدأ فضاءً آخر
        (§23/§24): الجسيماتُ تتبدّد ويبقى الغلافُ الأزرقُ حيّاً تحتها.

        و`leaving` يخفت اللوحةَ ولا يُفكّكها: التفكيكُ يُتلف السياق
        الرسوميّ في اللحظة التي تُبنى فيها الرئيسيةُ تحتها.
      */}
      <div
        className="absolute inset-0"
        style={{
          opacity: leaving ? environment.intensity : 1,
          transition: `opacity ${environment.fade}ms cubic-bezier(${curve.ambient.join(",")})`,
        }}
      >
        <BootStage settled={skipIntro} onPhase={onPhase} />
      </div>

      {/*
        ===== الحجابُ الأسود =====

        بين الشعار والبذرة الأولى (§7). ومن هنا يُرى الجسيمُ الأوّل:
        نقطةُ ضوءٍ في عتمةٍ تامّة، لا نقطةٌ تُضاف إلى مشهدٍ نصفِ مضاء.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[#04060c]"
        style={{
          opacity: showLogo || phase === "BLACK_TRANSITION" ? 1 : 0,
          transition: "opacity 900ms cubic-bezier(0.33,0,0.2,1)",
        }}
      />

      {/*
        ===== ① الشعار =====

        شعارُ **المنتَج** لا شعارُ المؤسسة: هذه اللحظة تقول «هذا هو
        البرنامج الذي يعمل»، وهويّةُ المدرسة تأتي بعدها.

        وظهورٌ ومقياسٌ فحسب — لا دوران، ولا ارتداد، ولا تشويه (§6).
        والمقياسُ من 1.02 لا 0.9: استقرارٌ لا قدوم.
      */}
      <div
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
        style={{
          opacity: showLogo ? 1 : 0,
          transform: showLogo ? "scale(1)" : "scale(1.02)",
          transition:
            "opacity 700ms cubic-bezier(0.33,0,0.2,1), transform 900ms cubic-bezier(0.16,1,0.3,1)",
        }}
      >
        <img
          src={nexschoolLogo}
          alt="NexSchool"
          draggable={false}
          className="select-none"
          /*
            الصورةُ أكبرُ من علامتها: حولها هامشٌ شفّافٌ يأكل نحوَ الثلث
            من كلّ ضلع، فالارتفاعُ المكتوب ارتفاعُ **الصندوق** لا ما يُرى.
          */
          style={{ height: "clamp(240px, 38vh, 480px)", width: "auto" }}
        />
      </div>

      {/*
        ===== ② هويّةُ المؤسسة =====

        سطرٌ واحدٌ هادئ أثناء بناء الحقل — لا شاشةٌ تحجزه خمسَ ثوانٍ.
        فالمشهدُ يعمل، والسطرُ يمرّ فوقه.
      */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-[14%] flex justify-center px-8"
        style={{
          opacity: showNotice ? 1 : 0,
          transition: "opacity 1100ms ease-out",
        }}
      >
        <p className="max-w-2xl text-center text-sm font-light leading-relaxed tracking-wide text-white/45">
          {schoolName} — الاستعمال مقيَّد بالمخوَّلين.
        </p>
      </div>

      {/* ===== ③ اختيارُ المستخدم ===== */}
      {choosing && (
        <UserSelectionScreen
          onLeaving={() => setLeaving(true)}
          onAuthenticated={onDone}
        />
      )}

      {/*
        ===== ④ بوّابةُ Enter =====

        تظهر حين يستقرّ المشهد. والكشفُ متدرّجٌ (§25): السطرُ، ثمّ
        المفتاح، ثمّ الهويّة — بفواصلَ قصيرة وبلا ارتداد.
      */}
      {!choosing && ready && (
        <div className="relative flex h-full flex-col items-center justify-center">
          <p
            dir="ltr"
            className="absolute top-[24%] text-center text-2xl font-light tracking-wide text-white/85 drop-shadow-[0_2px_18px_rgba(0,0,0,0.8)]"
            style={{ animation: "skk-fade-up 900ms ease-out both" }}
          >
            Press Enter button on your keyboard.
          </p>

          <div
            className="relative grid place-items-center"
            style={{ animation: "skk-fade-up 900ms cubic-bezier(0.22,1,0.36,1) both", animationDelay: "160ms" }}
          >
            <span
              className="absolute h-40 w-40 rounded-full border border-white/35"
              style={{ animation: "skk-ring-pulse 2.6s ease-in-out infinite" }}
            />
            <span className="absolute h-40 w-40 rounded-full border border-white/15" />
            <span
              className="grid h-[74px] w-[104px] place-items-center rounded-xl border border-white/30 bg-white/8 text-3xl font-light backdrop-blur-md"
              style={{ boxShadow: "0 0 34px rgba(255,255,255,0.18)" }}
            >
              ↵
            </span>
            <span className="absolute -bottom-9 text-xs font-bold tracking-[0.3em] text-white/50">
              ENTER
            </span>
          </div>

          <div
            className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-1"
            style={{ animation: "skk-fade-up 900ms ease-out both", animationDelay: "320ms" }}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{shortName}</span>
              <span className="text-2xl font-black" style={{ color: brand }}>
                {shortSuffix}
              </span>
            </div>
            <div className="text-xs text-white/45">
              {schoolName}
              {nameEn && ` — ${nameEn}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
