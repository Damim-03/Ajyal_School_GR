/**
 * التهيئةُ الأولى — المنسّق.
 *
 * ومسؤوليتُه ثلاثةٌ لا رابعَ لها:
 *   ① يسأل الخادمَ عن الحالة عند التركيب، ويعيد المحاولةَ إن سقط.
 *   ② يختار الشاشةَ من `phase` — **ولا يقرّر أيَّها**، فالقرارُ في
 *     الخادم والمتجرُ مرآتُه.
 *   ③ يُسلّم إلى التطبيق حين تكتمل، بانسحابٍ لا بتفكيكٍ مفاجئ (§54).
 *
 * **ولا شيءَ من منطق الخطوات هنا.** كلُّ شاشةٍ تعرف ما تُرسل وما
 * تتحقّق منه، وهذا الملفُّ لا يعرف أنّ في الشاشة الثامنة طابعةً ولا
 * في العاشرة كلمةَ مرور. وهو ما يجعل إضافةَ خطوةٍ ملفّاً جديداً
 * وسطراً في `SCREENS` — لا تعديلاً في قلبِ التجربة.
 *
 * وخريطةُ `SCREENS` مفهرسةٌ بنوع الخطوة كلِّه (`Record<FirstBootStep,…>`)،
 * فخطوةٌ تُضاف في الخادم ولا تُكتب لها شاشةٌ يرفضها المصرِّف — بدل أن
 * تُكتشف بشاشةٍ فارغةٍ في التركيب.
 */

import { useEffect, useState, type ComponentType } from "react";

import "./first-boot.css";

import { CinematicEnvironment } from "../../components/environment/CinematicEnvironment";
import { AcademicYearScreen } from "./components/AcademicYearScreen";
import { AdministratorScreen } from "./components/AdministratorScreen";
import { BootScreen } from "./components/BootScreen";
import { BootTransition } from "./components/BootTransition";
import { DevicesScreen } from "./components/DevicesScreen";
import { DisplayScreen } from "./components/DisplayScreen";
import { InstitutionScreen } from "./components/InstitutionScreen";
import { LanguageScreen } from "./components/LanguageScreen";
import { NetworkScreen } from "./components/NetworkScreen";
import { PerformanceScreen } from "./components/PerformanceScreen";
import { PrivacyScreen } from "./components/PrivacyScreen";
import { ReadyScreen } from "./components/ReadyScreen";
import { RecoveryScreen } from "./components/RecoveryScreen";
import { RegionScreen } from "./components/RegionScreen";
import { TermsScreen } from "./components/TermsScreen";
import { UpdateScreen } from "./components/UpdateScreen";
import { VerificationScreen } from "./components/VerificationScreen";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { useStepError, useT } from "./hooks/useFirstBootState";
import { useFirstBootStore } from "./store/firstBoot.store";
import { useSchoolStore } from "../../core/stores/school.store";
import type { FirstBootStep } from "./types/firstBoot.types";

type ScreenProps = { error: string | null };

/**
 * شبكةُ أمانِ التسليم — أطولُ من `nx-leave` (520ms) بهامشٍ واسع.
 *
 * والانسحابُ يقوده `animationend` لا مؤقّت (§7)، لكنّ الحدثَ **قد لا
 * يصل أصلاً**: صفحةٌ لا تُركَّب إطاراتُها لا تُقدِّم حركاتِها، فإن
 * صُغِّرت النافذةُ أو غُيِّب التبويبُ في اللحظة نفسِها بقيت الحركةُ
 * «تعمل» ولا تنتهي. وقد وقع هذا في الفحص الآليّ حرفياً: الحركةُ
 * `running` بعد ثانيةٍ ونصف، والطبقةُ فوق التطبيق لا تزول.
 *
 * وأثرُه لو تُرك: مستخدمٌ ضغط «ادخل إلى NexSchool» ثمّ صغّر النافذة
 * يعود فيجد شاشةَ «أنت جاهز» مقفلةً فوق تطبيقٍ يعمل تحتها ولا يبلغه.
 *
 * فالمؤقّتُ ليس مصدرَ التوقيت — هو ضمانُ ألّا يُحبَس أحد.
 */
const LEAVE_FALLBACK_MS = 1200;

const SCREENS: Record<FirstBootStep, ComponentType<ScreenProps>> = {
  LANGUAGE: LanguageScreen,
  REGION: RegionScreen,
  NETWORK: NetworkScreen,
  DISPLAY: DisplayScreen,
  PERFORMANCE: PerformanceScreen,
  TERMS: TermsScreen,
  UPDATE: UpdateScreen,
  DEVICES: DevicesScreen,
  ADMINISTRATOR: AdministratorScreen,
  INSTITUTION: InstitutionScreen,
  ACADEMIC_YEAR: AcademicYearScreen,
  PRIVACY: PrivacyScreen,
  RECOVERY: RecoveryScreen,
  FINAL_VERIFICATION: VerificationScreen,
  /* «جاهز» تُعالَج خارج الخريطة: لها تسليمٌ لا إرسال */
  READY: () => null,
};

export function FirstBoot({
  onComplete,
  onGone,
}: {
  /** يُنادى بمعامل: هل أُتمّت التهيئةُ في هذه الجلسة أم كانت متمّةً سلفاً؟ */
  onComplete: (justCompleted: boolean) => void;
  /**
   * انقضى انسحابُ الطبقة — الآن تُفكَّك.
   *
   * ولا مؤقّتَ يقابل مدّةَ الحركة في مكانين: نهايةُ الحركة نفسُها هي
   * الإشارة (§7). فتعديلُ `nx-leave` في ملفّ الأنماط لا يترك رقماً
   * متخلّفاً في ملفّ آخر.
   */
  onGone?: () => void;
}) {
  const t = useT();
  const phase = useFirstBootStore((store) => store.phase);
  const load = useFirstBootStore((store) => store.load);
  const error = useStepError();

  /** الانسحاب — الطبقةُ تبقى فوق التطبيق حتى تنقضي حركتُها (§54) */
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * لونُ المؤسسة يصبغ التهيئة.
   *
   * ومتجرُ الهوية يُحمَّل هنا لا في `App`: قراءتُه تحتاج مصادقةً في
   * الأحوال العادية، لكنّ `/settings/school` مفتوحٌ للقراءة (كما في
   * `school.route.ts`) — فتُقرأ لتصبغ الشاشاتِ بلونِ من رُكّب له
   * البرنامج بدل الأزرق الافتراضيّ. وأوّلُ تركيبٍ يعرض الافتراضيَّ
   * ثمّ يصير باللون بعد خطوة «مؤسستك».
   */
  const brand = useSchoolStore((store) => store.settings["school.brand_color"]);

  useEffect(() => {
    void useSchoolStore.getState().load();
  }, []);

  /*
   * تركيبٌ مهيَّأٌ سلفاً ⇒ تسليمٌ صامتٌ بلا شاشة.
   *
   * وهذا هو الفرقُ بين `COMPLETED` و`READY`: الأولى تعني «كان مهيَّأً
   * قبل أن يُفتح التطبيقُ اليوم» — فعرضُ «أنت جاهز» عليها في كلّ إقلاعٍ
   * كان سيجعل شاشةَ التتويج روتيناً يومياً يُضغط عليه بلا نظر. والثانيةُ
   * تعني «أُتمّت الآن»، وهي وحدَها تستحقّ الوقوف (§53).
   */
  useEffect(() => {
    if (phase === "COMPLETED") onComplete(false);
  }, [phase, onComplete]);

  useEffect(() => {
    if (!leaving) return;

    const timer = window.setTimeout(() => onGone?.(), LEAVE_FALLBACK_MS);

    return () => window.clearTimeout(timer);
  }, [leaving, onGone]);

  const enter = () => {
    setLeaving(true);

    /*
     * التسليمُ يقع **مع** بدء الانسحاب لا بعده.
     *
     * فالتطبيقُ يُركَّب تحت هذه الطبقة بينما هي تتلاشى فوقه، ولا لحظةَ
     * تكون فيها الشاشةُ خاليةً من الاثنين. وهذه هي الفكرةُ نفسُها التي
     * تقوم عليها شاشةُ الإقلاع في `features/boot` — تراكبٌ لا تبديل.
     */
    onComplete(true);
  };

  const stepError = error ? t.errors[error] : null;

  const Screen =
    phase !== "BOOTING" && phase !== "WELCOME" && phase !== "COMPLETED"
      ? SCREENS[phase]
      : null;

  return (
    <div
      className={leaving ? "nx-boot nx-boot--leaving" : "nx-boot"}
      style={brand ? ({ "--nx-accent": brand } as React.CSSProperties) : undefined}
      /*
       * حاجزٌ للقارئ: ما تحت هذه الطبقة — إن رُكّب — ليس معروضاً.
       * ولا يُوضع إلّا أثناء العرض؛ فعند الانسحاب يصير المُعلَنُ ما
       * تحته.
       */
      aria-hidden={leaving ? "true" : undefined}
      onAnimationEnd={(event) => {
        /* حركةُ الجذر وحدها — لا حركاتُ ما بداخله وهي تتصاعد */
        if (leaving && event.target === event.currentTarget) onGone?.();
      }}
    >
      {/*
        البيئةُ السينمائية نفسُها التي تحت شاشة الدخول واختيار المستخدم.

        وكانت هنا ثلاثُ طبقاتِ CSS (‏تدرّجٌ ساكنٌ وآخرُ يتنفّس وحبيبة).
        وحُجّتُها أنّ هذه شاشاتٌ يُكتب فيها لدقائق، وخلفيةٌ متحرّكةٌ تحت
        نموذجٍ تشويش. لكنّ ذلك جعل التهيئةَ **تبدو من تطبيقٍ آخر**: يمرّ
        المستخدمُ منها إلى شاشة اختيار المستخدم فيتبدّل العالمُ تحته —
        وهو نقيضُ ما تقوم عليه هذه الرحلةُ كلُّها (البقاءُ في الفضاء
        نفسِه من أوّل شاشةٍ إلى آخرها).

        فصار المشهدُ واحداً من الإقلاع إلى الرئيسية. وثمنُ الحركةِ
        مدفوعٌ أصلاً: اللوحةُ تقف عند إخفاء النافذة، وتقرأ
        `prefersStillMotion` فتسكن مع «توفير الطاقة» وتفضيلِ النظام.
      */}
      {/*
        وتُفكَّك اللوحةُ فورَ بدء الانسحاب — لا بعد انقضائه.

        فما تحتها في تلك اللحظة شاشةُ الإقلاع، ولها **لوحتُها هي**.
        وإبقاؤهما معاً يعني مشهدين كاملين يُرسمان في الإطار نفسِه —
        ألفَي جسيمٍ بدل ألف — في اللحظة التي يُركَّب فيها الموجّهُ
        والشاشةُ كلُّها، أي أثقلِ لحظةٍ في عمر التطبيق.
        وفكُّها لا يُرى: القاعُ الأسودُ يفنى معها، فينكشف من تحته
        المشهدُ نفسُه لا فراغ.
      */}
      {!leaving && <CinematicEnvironment focusY={0.5} />}

      {/*
        وحجابٌ رقيقٌ فوقها — لا فوق شاشة الدخول.

        فتلك تحمل بطاقاتٍ قليلةً كبيرة، وهذه تحمل نصّاً صغيراً وحقولاً
        تُقرأ وتُملأ. والغبارُ المضيءُ يمرّ خلف السطر فيُتعب العين.
        وثمانيةٌ بالمئة من السواد تكفي: تُثبّت التباين ولا تُطفئ المشهد.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: "rgba(4,6,12,0.42)" }}
      />

      <BootTransition phase={phase}>
        {phase === "BOOTING" && <BootScreen />}

        {phase === "WELCOME" && <WelcomeScreen />}

        {Screen && <Screen error={stepError} />}

        {phase === "READY" && <ReadyScreen onEnter={enter} />}
      </BootTransition>

      {/*
        **ولا شريطَ «أهلاً بعودتك» هنا بعد اليوم.**

        كان طبقةً مطلقةً عند أسفل الشاشة، فيقع على زرّ «رجوع» وعلى سطر
        الإرشاد في الشاشات الخمس عشرة كلِّها. وانتقل إلى ترويسة `Stage`
        شارةً في التدفّق — حيث يقرؤها المستخدم مع عدّاد الخطوات، ولا
        تعلو شيئاً.
      */}
    </div>
  );
}
