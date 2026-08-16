import { LAYER } from "../../motion/layers";
import { useEffect, useRef, useState } from "react";
import { AmbientBackground } from "../../components/ambient/AmbientBackground";
import { sfx, playAmbient } from "../../lib/sound";
import { useSchool } from "../../core/stores/school.store";

const LOGO_MS = 6000; // الشعار وحده على الأسود (تلاشٍ داخل/خارج)
const NOTICE_MS = 5000; // جملة التحذير الصحّي
const SOUND_DELAY_MS = 2000; // الصوت يبدأ بعد ظهور الجملة بثانيتين

/**
 * شاشة بدء التشغيل بثلاث مراحل (نمط PS5):
 * 1) شعار SKK Pos وحده على أسود — 6 ثوانٍ بتلاشٍ داخل ثم خارج.
 * 2) جملة تحذير الصحّة والسلامة (الصوت يبدأ بعد ظهورها بثانيتين).
 * 3) كشف سلس للخلفية + «اضغط Enter» — ولا يُدخَل التطبيق إلا بضغط Enter.
 */
export function BootScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"logo" | "notice" | "press">("logo");

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
        sfx("enter", 0.55);
        onDone();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, onDone]);

  const revealed = phase === "press";
  // حالة البيئة تتبع مرحلة الإقلاع (بلا إعادة تركيب المكوّن)
  const ambientState = revealed ? "connecting" : "idle";

  return (
    <div className="fixed inset-0 select-none overflow-hidden bg-black text-white"
         style={{ zIndex: LAYER.boot }}>
      {/* البيئة المتحرّكة — تُركَّب مرّة واحدة وتبقى حيّة عبر كل مراحل الإقلاع
          (لا تُعاد تهيئتها عند تغيّر المرحلة). المراحل السوداء تعلوها ثم تنكشف. */}
      <AmbientBackground
        state={ambientState}
        particleFlowEnabled
        enableParallax
        quality="high"
      />

      {/* ستار أسود يغطّي البيئة أثناء المرحلتين الأوليين ثم ينقشع بنعومة
          (بدل إزالة غطاء معتم فجأة عند تبديل المرحلة). */}
      <div
        className="absolute inset-0 bg-black"
        style={{
          opacity: revealed ? 0 : 1,
          transition: "opacity 2000ms cubic-bezier(0.22,1,0.36,1)",
        }}
      />

      {/* ===== المرحلة 1: الشعار وحده على أسود ===== */}
      {phase === "logo" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex items-baseline gap-2.5" style={{ animation: `skk-logo-cycle ${LOGO_MS}ms ease-in-out both` }}>
            <span className="text-8xl font-black tracking-tight">{shortName}</span>
            <span className="text-8xl font-black" style={{ color: brand }}>
              {shortSuffix}
            </span>
          </div>
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

      {/* ===== المرحلة 3: اضغط Enter (فوق الخلفية المنكشفة) ===== */}
      {revealed && (
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
