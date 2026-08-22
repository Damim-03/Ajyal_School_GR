import { LAYER } from "../../motion/layers";
import nexschoolLogo from "../../assets/nexschool/nexschool.png";
import { useEffect, useRef, useState } from "react";
import { CinematicEnvironment } from "../../components/environment/CinematicEnvironment";
import { UserSelectionScreen } from "../../components/user-selection/UserSelectionScreen";
import { sfx, playAmbient } from "../../lib/sound";
import { useSchool } from "../../core/stores/school.store";
import { curve, environment, useHomeRevealed } from "../../motion/home-entrance";

const LOGO_MS = 6000; // الشعار وحده على الأسود (تلاشٍ داخل/خارج)
const NOTICE_MS = 5000; // جملة التحذير الصحّي
const SOUND_DELAY_MS = 2000; // الصوت يبدأ بعد ظهور الجملة بثانيتين

/**
 * شاشة بدء التشغيل بأربع مراحل (نمط PS5):
 * 1) شعار NexSchool وحده على أسود — 6 ثوانٍ بتلاشٍ داخل ثم خارج.
 * 2) جملة تحذير الصحّة والسلامة (الصوت يبدأ بعد ظهورها بثانيتين).
 * 3) كشف سلس للخلفية + «اضغط Enter».
 * 4) اختيار المستخدم — فوق البيئة نفسها بلا إعادة تركيب.
 */
export function BootScreen({ onDone }: { onDone: () => void }) {
  /*
   * أربعُ مراحل في مكوّنٍ واحد — واختيارُ المستخدم منها لا صفحةٌ في
   * الموجّه. والسببُ واحد: `CinematicEnvironment` يُركَّب هنا مرّةً،
   * فبقاؤه مركَّباً عبر المراحل يعني أنّ الغبار يواصل انجرافه والنغمة
   * تمتدّ بلا انقطاع. ولو كانت صفحةً في الموجّه لأُعيد تركيبُ اللوحة
   * وبدأ المشهد من الصفر — وهو نقيضُ «البقاء داخل الفضاء نفسه».
   */
  const [phase, setPhase] = useState<"logo" | "notice" | "press" | "users">("logo");

  /**
   * شدّةُ الفضاء — **تخفت عند نجاح الدخول ولا تنطفئ** (§4).
   *
   * كانت تُصفَّر، فتموت الأقراصُ والغبارُ والضبابُ قبل التسليم بثلث
   * ثانية: يرى المستخدمُ الفضاءَ ينطفئ ثمّ يرى فضاءً آخرَ يُشعَل. وهذا
   * نقيضُ ما يجب أن تكونه هذه اللحظة — هو لم يغادر المكان، إنّما أُضيء
   * له ما فيه.
   *
   * 0.82: خفوتٌ محسوسٌ يقول «شيءٌ ما يتبدّل»، والجسيماتُ تواصل انجرافها
   * إلى آخر إطارٍ تُرسم فيه.
   */
  const [envIntensity, setEnvIntensity] = useState(1);

  /**
   * التسليم — الرئيسيةُ **رُسمت**، لا مجرّد رُكّبت.
   *
   * والفرقُ بين الأمرين هو كلُّ الفرق بين تسليمٍ نظيفٍ وآخرَ يكشف
   * مشهداً نصفَ مبنيّ. تركيبُ الرئيسية يحجب الخيطَ ~310ms؛ ولو بدأ
   * الانسحابُ عنده لمضى على المُركِّب — وهو لا ينتظر الخيطَ المحجوب —
   * فانكشفت من خلفه رئيسيةٌ لم تُرسم بعد.
   *
   * فالإشارةُ هي `revealed`: يرفعها المنسّقُ حين تُعلن الرئيسيةُ
   * جاهزيّتها في أوّل إطارٍ بعد رسمها. وعندها تتوقّف شاشةُ الإقلاع عن
   * كونها الشاشة: تصير طبقةً منسحبةً فوق أخرى حيّة. فتُرفع عنها ثلاثةُ
   * أشياء دفعةً واحدة — سوادُ قاعها (وإلّا حجبت ما تحتها)، والتقاطُها
   * للمؤشّر (وإلّا ابتلعت أوّل نقرةٍ في الرئيسية §23)، وتماسكُها
   * البصريّ (تتلاشى).
   */
  const departing = useHomeRevealed();

  /*
   * الإقلاع يسبق الدخول، وقراءة الهوية تحتاج مصادقة — فتُعرض هنا
   * افتراضياتُ المتجر أو آخر قيمةٍ عرفها هذا الجهاز. أوّل تشغيلٍ
   * في مدرسة جديدة يُظهر الافتراضي ثوانيَ ثم يصير باسمها بعد أوّل دخول.
   */
  const shortName = useSchool("school.short_name");
  const shortSuffix = useSchool("school.short_suffix");
  const schoolName = useSchool("school.name_ar");
  const nameEn = useSchool("school.name_en");
  const brand = useSchool("school.brand_color");

  const NOTICE = `${schoolName} — الاستعمال مقيَّد بالمخوَّلين.`;
  const soundStarted = useRef(false);

  // تسلسل المراحل: شعار → تحذير → اضغط Enter
  useEffect(() => {
    const toNotice = window.setTimeout(() => setPhase("notice"), LOGO_MS);
    const toPress = window.setTimeout(() => setPhase("press"), LOGO_MS + NOTICE_MS);
    return () => {
      window.clearTimeout(toNotice);
      window.clearTimeout(toPress);
    };
  }, []);

  // النغمة تبدأ بعد ظهور جملة التحذير بثانيتين — مؤقّت مستقلّ عن المراحل فلا تقطعه
  // مرحلة تالية. نغمة واحدة فقط («002. Select User») تستمرّ عبر شاشة انتظار Enter
  // ثم شاشة اختيار المستخدم بلا إعادة تشغيل (playAmbient يتجاهل الطلب المكرّر).
  useEffect(() => {
    const t = window.setTimeout(() => {
      if (soundStarted.current) return; // مرّة واحدة فقط
      soundStarted.current = true;
      playAmbient("select");
    }, LOGO_MS + SOUND_DELAY_MS);
    return () => window.clearTimeout(t);
  }, []);

  // لا دخول إلا بضغط Enter
  useEffect(() => {
    if (phase !== "press") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        sfx("enter", 0.92);
        setPhase("users");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase]);

  const revealed = phase === "press" || phase === "users";

  return (
    /*
      القاعُ الأسودُ مشروط، لا ثابت.

      كان `bg-black` صنفاً دائماً — وهو صحيحٌ ما دامت هذه الشاشةُ هي
      الشاشة. لكنّها صارت تبقى مركَّبةً بعد التسليم لتنسحب فوق الرئيسية،
      وسوادٌ دائمٌ في قاعها كان سيحجب ما جاءت تكشفه: تتلاشى الطبقاتُ
      كلُّها فوق سوادٍ لا يتلاشى، فلا يظهر تحتها شيء.
    */
    <div className="fixed inset-0 select-none overflow-hidden text-white"
         style={{
           zIndex: LAYER.boot,
           backgroundColor: departing ? "transparent" : "#000",
           opacity: departing ? 0 : 1,
           /* البيئةُ تُغلق المشهد: تلحق آخرَ طبقةٍ منسحبة ولا تتخلّف عنها. */
           transition: `opacity ${environment.fade}ms cubic-bezier(${curve.ambient.join(",")})`,
           /* أوّلُ نقرةٍ بعد التسليم تخصّ الرئيسية لا هذه الطبقة (§23). */
           pointerEvents: departing ? "none" : "auto",
         }}>
      {/* البيئة السينمائية — تُركَّب مرّة واحدة وتبقى حيّة عبر كل مراحل الإقلاع
          (لا تُعاد تهيئتها عند تغيّر المرحلة). المراحل السوداء تعلوها ثم تنكشف.
          و`focusY` موضعُ مفتاح Enter — حوله يُضيء الغبارُ قليلاً. */}
      <CinematicEnvironment focusY={0.5} intensity={envIntensity} />

      {/* ستار أسود يغطّي البيئة أثناء المرحلتين الأوليين ثم ينقشع بنعومة
          (بدل إزالة غطاء معتم فجأة عند تبديل المرحلة). */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: revealed ? 0 : 1,
          transition: "opacity 2000ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* ===== المرحلة 1: شعار البرنامج وحده على أسود ===== */}
      {phase === "logo" && (
        <div className="absolute inset-0 flex items-center justify-center">
          {/*
            شعارُ **المنتَج** لا شعارُ المؤسسة — والتفريقُ مقصود.

            لحظةُ الإقلاع تقول «هذا هو البرنامج الذي يعمل»، كما تفعل
            الأجهزةُ حين تُشعَل. وهويةُ المدرسة تأتي بعدها: اسمُها في
            جملة التحذير، وشعارُها في شاشة اختيار المستخدم. فلو وُضع
            شعارُ المدرسة هنا لضاع الفرقُ بين الاثنين ولم يبقَ في
            الشاشة كلِّها ما يسمّي البرنامج.

            والقياسُ بـ`clamp` لا بقيمةٍ ثابتة: الشعارُ مربّعٌ يملأ
            ارتفاعَه، وقيمةٌ ثابتة تجعله لطخةً على 4K وبقعةً على 1280.
          */}
          <img
            src={nexschoolLogo}
            alt="NexSchool"
            draggable={false}
            className="select-none"
            style={{
              /*
               * والصورةُ أكبرُ من علامتها: حول العلامة هامشٌ شفّافٌ في
               * ملفّ PNG يأكل نحوَ الثلث من كلّ ضلع. فالارتفاعُ المكتوب
               * هنا ارتفاعُ **الصندوق** لا ما يُرى منه، ولذلك يبدو
               * الشعارُ أصغرَ ممّا يقوله الرقم بمقدارٍ محسوس.
               */
              height: "clamp(280px, 48vh, 600px)",
              width: "auto",
              animation: `skk-logo-cycle ${LOGO_MS}ms ease-in-out both`,
            }}
          />
        </div>
      )}

      {/* ===== المرحلة 2: تحذير الصحّة والسلامة ===== */}
      {phase === "notice" && (
        <div className="absolute inset-0 flex items-center justify-center px-8">
          <p
            dir="ltr"
            className="max-w-2xl text-center text-lg font-light leading-relaxed tracking-wide text-white/75"
            style={{ animation: `skk-notice-cycle ${NOTICE_MS}ms ease-in-out both` }}
          >
            {NOTICE}
          </p>
        </div>
      )}

      {/* ===== المرحلة 4: اختيار المستخدم ===== */}
      {phase === "users" && (
        <UserSelectionScreen
          onLeaving={() => setEnvIntensity(environment.intensity)}
          onAuthenticated={onDone}
        />
      )}

      {/* ===== المرحلة 3: اضغط Enter (فوق الخلفية المنكشفة) ===== */}
      {phase === "press" && (
        <div className="relative flex h-full flex-col items-center justify-center">
          {/* الجملة */}
          <p
            dir="ltr"
            className="absolute top-[22%] text-center text-2xl font-light tracking-wide text-white/90 drop-shadow-[0_2px_18px_rgba(0,0,0,0.8)]"
            style={{ animation: "skk-fade-up 1100ms ease-out both", animationDelay: "700ms" }}
          >
            Press Enter button on your keyboard.
          </p>

          {/* مفتاح Enter داخل حلقة نابضة */}
          <div className="relative grid place-items-center" style={{ animation: "skk-fade-up 1100ms cubic-bezier(0.22,1,0.36,1) both", animationDelay: "1000ms" }}>
            <span className="absolute h-40 w-40 rounded-full border border-white/40" style={{ animation: "skk-ring-pulse 2.6s ease-in-out infinite" }} />
            <span className="absolute h-40 w-40 rounded-full border border-white/20" />
            {/*
              توهّج ساكن بدل تنفّسٍ متحرّك: الحلقة حوله هي القائد البصري،
              والمفتاح يحضر بمادّته لا بحركته. (وظلٌّ متحرّك لانهائي أغلى
              ما يُرسَم في هذه الشاشة.)
            */}
            <span
              className="grid h-[74px] w-[104px] place-items-center rounded-xl border border-white/35 bg-white/10 text-3xl font-light backdrop-blur-md"
              style={{ boxShadow: "0 0 34px rgba(255,255,255,0.20)" }}
            >
              ↵
            </span>
            <span className="absolute -bottom-9 text-xs font-bold tracking-[0.3em] text-white/55">ENTER</span>
          </div>

          {/* هوية المحل أسفل */}
          <div className="absolute inset-x-0 bottom-10 flex flex-col items-center gap-1" style={{ animation: "skk-fade-up 1000ms ease-out both", animationDelay: "1300ms" }}>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-black">{shortName}</span>
              <span className="text-2xl font-black" style={{ color: brand }}>
                {shortSuffix}
              </span>
            </div>
            <div className="text-xs text-white/50">
              {schoolName}
              {nameEn && ` — ${nameEn}`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
