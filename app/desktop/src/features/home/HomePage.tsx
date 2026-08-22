import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../core/hooks/use-auth";
import { useSchool } from "../../core/stores/school.store";
import { sfx, playAmbient, stopAmbient, preloadAmbient, SFX_DURATION_MS } from "../../lib/sound";
import { notify } from "../../components/notifications/notify";
import { uiSound } from "../../lib/ui-sound";
import { AnimatePresence, motion, useTransform } from "motion/react";
import { AmbientEnvironment } from "../../components/ambient/AmbientEnvironment";
import {
  SpatialNavRow, SpatialNavItem, FocusIndicator, AnimatedContextLabel,
  background as bgBase, choreography as chor, springs, useTileMetrics, expansion as ex,
} from "../../motion/spatial";
import { MOTION } from "../../motion/system";
import { useCameraLayer, useCameraZoom, useCameraNudge } from "../../motion/camera";
import { clearPageMemory } from "../../motion/page-memory";
import { LAYER } from "../../motion/layers";
import { useLayoutDirection, arrowToStep, wheelToStep } from "../../motion/direction";
import {
  useMotionStore, useMotionPhase, useFocusState, motionDispatch,
  useMotionSpeed, scaleTransition, useRushing, type InteractionSource,
} from "../../motion/orchestrator";
import { HomeTopBar } from "./topbar/HomeTopBar";
import { ContextStats } from "./ContextStats";
import { ContextPanel } from "./ContextPanel";
import { MODULES, WALLPAPERS, type Module } from "./modules";
import { useEnergyField, ringDistance, focusEnergy } from "../../motion/energy";
import { boot } from "../../motion/spatial/boot";
import {
  homeEntrance, useEntranceStages, useEntranceStill,
  content as entranceContent, curve as entranceCurve,
  shell as entranceShell, tileEntrance,
} from "../../motion/home-entrance";

/* اسم المركز لم يعد ثابتاً — يُقرأ من هوية المدرسة (core/stores/school.store) */

const pad = (n: number) => String(n).padStart(2, "0");
const fmtTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;
const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat("ar-u-nu-latn", { weekday: "long", day: "numeric", month: "long" }).format(d).replace("،", "");

/*
 * هندسة الصفّ وحركته انتقلت كاملةً إلى motion/spatial/tokens.ts.
 * كل رقم هناك مقيس إطاراً بإطار من تسجيل مرجعي (30fps، مطابقة قوالب
 * متعدّدة المقاييس): نسبة المركَّز 1.563، الفجوة 0.081 من البلاطة،
 * والبلاطة 5.51vw. عدّل الحركة من هناك لا من هنا.
 */

// المقدّمة الكاملة تُعرض مرّة واحدة بعد تسجيل الدخول؛ العودة من الأقسام تدخل مباشرة
// باستقرار لطيف بدل إعادة المقدّمة ونغمة التحميل في كل مرّة.
let homeIntroPlayed = false;

export function HomePage() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  /* هوية المدرسة — تُحمَّل مرّة في App وتُقرأ هنا */
  const schoolName = useSchool("school.name_ar");
  const shortName = useSchool("school.short_name");
  const shortSuffix = useSchool("school.short_suffix");
  const brandColor = useSchool("school.brand_color");
  const [now, setNow] = useState(() => new Date());
  /*
   * الحالة الحركية كلها من المنسّق (§11/§25).
   *
   * كانت هنا سبع حالات منفصلة — launching وchromeReady وbgReady وentered
   * وsettling وfocused وnavDir — كلٌّ منها يقرّر بنفسه متى يتحرّك. النتيجة
   * أنّه لم يكن هناك موضع واحد يعرف «ما الذي يجري الآن»، فلا وسيلة لمنع
   * تصادم ولا لرفض تنقّل في غير أوانه.
   *
   * الآن `phase` واحدة تشتقّ الجميع، والخمس المتبقية أدناه توقيتُ مقدّمةٍ
   * محضٌ (متى تظهر كل طبقة أول مرّة) لا حالةَ تفاعل.
   */
  const phase = useMotionPhase();
  const focus = useFocusState();
  const focused = focus.id;
  const navDir = focus.direction || 1;
  const launching = phase === "EXITING";
  /** مرحلة الاستكشاف: السياق مفتوح تحت البطل داخل الرئيسية. */
  const expanded = phase === "PREVIEW_ACTIVE";
  const speed = useMotionSpeed();
  /** المستخدم يندفع عبر الصفّ — تُسقَط الزخرفة لا الاستجابة (§36/§44). */
  const rushing = useRushing();
  const dir = useLayoutDirection();
  // المقدّمة الكاملة لأول دخول فقط؛ العودة من قسم تدخل جاهزة مع استقرار لطيف
  // قيمة تُحسب مرّة عند التركيب ولا تتغيّر — useState لا useRef، فقراءة ref
  // أثناء العرض ممنوعة (ومصدر تحذيرات react-hooks/refs سابقاً).
  const [isFirstIntro] = useState(() => !homeIntroPlayed);
  /*
   * مرحلة الاستيقاظ — **لم تعد ملكاً لهذه الشاشة**.
   *
   * كانت هنا: حالةٌ محلّية وسبعةُ مؤقّتاتٍ تتقدّم في جدول
   * motion/spatial/boot.ts. وعيبُها أنّ الرحلةَ تبدأ قبل هذه الشاشة
   * بكثير — عند نجاح المصادقة، في شاشةٍ أخرى — فكان نصفُ التسلسل هناك
   * ونصفُه هنا، ولا موضعَ يعرف الرحلةَ كاملة. النتيجةُ مشهدان متعاقبان
   * لا مشهدٌ واحد.
   *
   * الآن الجدولُ كلُّه في `motion/home-entrance`، وهذه الشاشة **قارئة**:
   * تُركَّب في منتصف الرحلة (‏120ms) فتجد العالمَ قد بدأ يستيقظ، وتتابع
   * من حيث بلغ. والأعلامُ بأسمائها التي كانت — لم يتبدّل إلّا مصدرُها،
   * فلا `SpatialNavItem` ولا `FocusIndicator` ولا حقلُ الطاقة يعلم شيئاً.
   */
  const { worldLit, bgReady, identityReady, assembled, focusArrived, edgeReady, entered, settled } =
    useEntranceStages();
  /** «تقليل الحركة» — يُقرأ من الجدول لا من `matchMedia` في كل مكوّن. */
  const still = useEntranceStill();
  const [settling, setSettling] = useState(!isFirstIntro); // عند العودة: تستقرّ الخلفية والمحتوى بنعومة
  /**
   * ⓪ لحظة المقاومة (§9).
   *
   * تقع بين التأكيد وبين بدء الامتداد. البطل ينضغط ويُدفع إلى الداخل، ولا
   * يُركَّب السياق أصلاً قبل انقضائها — فالترتيب الذي يُقرأ هو: ضغطة، ثمّ
   * جسمٌ قاوم، ثمّ صفحةٌ انفتحت. لا تُقاس بالإطارات ولا تُلاحَظ كتأخير؛
   * غيابها هو ما كان يُلاحَظ.
   */
  const [bracing, setBracing] = useState(false);
  /** الحالة الثالثة (§19/§20) — تُخزَّن في المنسّق ولا تُغذّي التنقّل. */
  /** الاستكشاف: أيّ بلاطة يتفحّصها المؤشّر الآن — اهتمام لا انتباه. */
  const hovered = useMotionStore((s) => s.hovered);
  /*
   * الكاميرا على الخلفية وحدها.
   *
   * طُبّقت أولاً على المحتوى والتنقّل أيضاً، فقاس التسجيل انجرافاً بمدى
   * 19px في شريط التنقّل و14px في العنوان مع حركة الفأرة. وقياس المرجع
   * أعطى **صفر** إزاحة للأيقونات على 22 إطاراً (دقة 0.999): واجهة
   * الكونسول ساكنة تماماً بين التنقّلات، وأصلاً لا مؤشّر فيها.
   *
   * والأهمّ عملياً: هذا نظام نقاط بيع؛ الكاشير يحرّك الفأرة طوال الوقت،
   * فواجهة تتموّج تحت كل حركة تتحوّل إلى تشويش لا عمق.
   *
   * العمق يبقى في الجوّ (الضوء والضباب في AmbientEnvironment) حيث لا
   * يقرأ المستخدم شيئاً ولا يستهدف زرّاً.
   */
  const camBg = useCameraLayer("background");
  const camZoom = useCameraZoom();
  const nudgeCamera = useCameraNudge();
  const stripRef = useRef<HTMLDivElement | null>(null);
  /** زرّ الدخول — Enter ينقل التركيز إليه بدل أن يفتح القسم مباشرة. */
  const enterRef = useRef<HTMLButtonElement | null>(null);
  /** مؤقّت المغادرة — يُلغى عند التفكيك فلا ينتقل التطبيق بعد مغادرة الشاشة. */
  const launchTimer = useRef(0);
  /** مؤقّت لحظة المقاومة — يُلغى عند الطيّ وعند التفكيك. */
  const braceTimer = useRef(0);

  const L = MODULES.length;
  const m = MODULES[focused] ?? MODULES[0];
  /*
   * موضع الطاقة على الصفّ — ينزلق بنابض بين البلاطات فتضيء ما يمرّ عليه
   * وهو في طريقه. يُنشأ هنا مرّةً ويُقرأ في كل بلاطة، فيبقى للصفّ كلّه
   * مصدر طاقة واحد لا تسع نسخ مستقلّة.
   */
  /*
   * ⑤ وصول الطاقة.
   *
   * قبل مرحلتها يكون هدف الحقل **خارج** الصفّ بمقدار boot.entryTravel،
   * فحين تحين تسافر إلى البلاطة المحدَّدة بنابض التنقّل نفسه — وتُضيء ما
   * تمرّ عليه في طريقها. لا مفتاح يُشعلها في مكانها.
   */
  /** مقاسات الشريط بالبكسل — تُحسب عند التركيب وتغيّر الحجم فقط. */
  const metrics = useTileMetrics();
  const energyField = useEnergyField(focusArrived ? focused : focused - boot.entryTravel, L);
  /*
   * اعتراف البيئة بالتركيز — شدّة البلاطة المستقرّ عليها الانتباه.
   *
   * تبلغ 1 عند الوصول، وتهبط إلى ~0.8 بينما تعبر الطاقة بين بلاطتين (فلا
   * تبلغ أيٌّ منهما الذروة)، ثم تعود. فتخفت إضاءة المشهد قليلاً أثناء
   * الرحلة وتستعيد وضوحها عند الاستقرار. استجابةٌ لا نبض: عند سكون
   * المستخدم تسكن تماماً.
   */
  const sceneResponse = useTransform(energyField, (p) => focusEnergy(ringDistance(focused, p, L)));
  /**
   * موضع استقرار البلاطة المركَّزة — يُبلّغه الصفّ، ويتّبعه العنوان تحته
   * فينبثق منها لا من حافّة الصفحة. حالة React لا MotionValue: تتغيّر
   * مرّةً لكل تنقّل لا كل إطار.
   */
  const [labelAnchor, setLabelAnchor] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  /*
   * الذاكرة المكانية لم تعد متغيّراً عاماً منفصلاً: المنسّق يحمل التركيز
   * ويبقى بعد تفكيك هذه الشاشة، فالعودة من قسم تجد الحالة كما تُركت (§72).
   * هنا فقط نُعلمه بعدد العناصر كي يلتفّ التنقّل عند الطرفين.
   */
  useEffect(() => { useMotionStore.getState().setCount(L); }, [L]);

  /*
   * «نحن في الرئيسية» يُعلَن **بلا شرط** عند كل تركيب.
   *
   * كان مشروطاً بـ`!isFirstIntro` — وهي علامة تخصّ المقدّمة والصوت لا
   * التنقّل. فمن دخل قسماً ثم أُعيد تحميل الصفحة رجع إلى رئيسيةٍ حالتُها
   * ما زالت «رحلة عودة جارية»، ولا شيء يُنهيها، فتُرفض كل الأسهم بصمت.
   * ربطُ حقيقةٍ مكانية بعلامةٍ صوتية هو الخطأ نفسه.
   */
  useEffect(() => { motionDispatch({ type: "MODULE_EXIT" }); }, []);

  /*
   * استعادة الاختيار عند العودة.
   *
   * في الطريق المعتاد لا شيء يفعله: الانتباه لم يتحرّك منذ أن غادرت، فتجده
   * حيث تركته. لكنّ طريقاً آخر كان يكسر ذلك — الدخول إلى قسم من رابط
   * مباشر أو من زرّ داخل شاشة أخرى: تصل إلى المخزون بينما انتباه الرئيسية
   * ما زال على المبيعات، فترجع لتجد نفسك واقفاً على قسم لم تزُره.
   *
   * فيُشتقّ الاختيار من **القسم الذي كنت فيه فعلاً** لا من آخر ضغطة سهم.
   * الرجوع يجب أن يُعيدك إلى حيث كنت، بأيّ طريق وصلتَ إليه.
   */
  useEffect(() => {
    const { previousModule, focus } = useMotionStore.getState();
    if (!previousModule) return;
    const i = MODULES.findIndex((x) => x.id === previousModule);
    if (i >= 0 && i !== focus.id) {
      motionDispatch({ type: "FOCUS_CHANGE", to: i, source: "restored" });
    }
  }, []);

  /**
   * الالتحاقُ بالرحلة — لا بدؤها من الصفر.
   *
   * ثلاثةُ طرقٍ تصل إلى هذه الشاشة، ولكلٍّ منها ملفُّه في الجدول:
   *
   *   • من المصادقة  — الساعةُ **تعمل منذ 120ms** وهذه الشاشةُ رُكّبت
   *     تحت الشاشة المنسحبة. فلا تُبدأ من جديد: البدءُ هنا كان سيُرجع
   *     المشهدَ إلى السواد بعد أن بدأ يستيقظ.
   *   • إعادةُ تحميل — لا رحلةَ سابقة، فالإقلاعُ باردٌ بجدول `boot.ts`
   *     كما كان تماماً.
   *   • عودةٌ من قسم — الغلافُ لم يغادر، فالجدولُ يكتمل فوراً.
   *
   * ولا تنظيفَ يوقف الساعة عند التفكيك عمداً: لو غادر المستخدمُ إلى
   * قسمٍ في منتصف الدخول، فإتمامُ الجدول إلى نهايته هو ما يضمن أنّ
   * الحالةَ المتروكة **صالحة** (§25) — أمّا قطعُها في منتصفها فيترك
   * خطوةً معلّقة تجدها العودةُ التالية كما هي.
   */
  useEffect(() => {
    /*
     * الشرطُ **الملفُّ وحده**، لا مرحلتُه.
     *
     * كان: «‏auth ولمّا تكتمل بعد». وقِستُه فوجدته يُشعل المقدّمةَ
     * مرّتين: على جهازٍ مخنوق (أو نافذةٍ في الخلفية) قد تتأخّر أوّلُ تقّةٍ
     * من الساعة حتى تتجاوز الجدولَ كلَّه، فيبلغ `complete` **قبل** أن
     * تُركَّب هذه الشاشة أصلاً. فتصل الرئيسيةُ فتجد المرحلةَ مكتملةً،
     * فتحكم أنّ لا رحلةَ جارية، فتبدأ إقلاعاً بارداً كاملاً — أي أنّ
     * المستخدم يرى المشهدَ يُبنى مرّةً ثانية بعد أن رآه.
     *
     * والملفُّ يقول ما هو صحيحٌ فعلاً: «هذا الوصولُ جاء من مصادقة».
     * ومن جاء منها فرحلتُه مملوكةٌ لها، اكتملت أم لم تكتمل — والعودةُ
     * من قسمٍ لاحقاً تجده مكتملاً فتُصيّر الحالةَ النهائية مباشرةً،
     * وهو عينُ ما يفعله ملفُّ العودة.
     */
    if (homeEntrance.get().profile !== "auth") {
      homeEntrance.start(isFirstIntro ? "cold" : "return");
    }

    /*
     * **إعلانُ الجاهزية — في أوّل إطارٍ بعد الرسم، لا في الأثر نفسِه.**
     *
     * الأثرُ يجري بعد التثبيت وقبل أن يرسم المتصفّحُ شيئاً؛ والثقيلُ في
     * هذه الشاشة (تسعُ بلاطاتٍ بطبقاتها، وطبقاتُ الخلفية، ولوحةُ الجوّ)
     * يقع في التخطيط والرسم اللذين يليانه — 310ms مقيسةً على بناء
     * الإنتاج. فإعلانُ الجاهزية هنا كان سيبدأ التجميعَ قبل أن توجد
     * صورةٌ تُجمَّع، فيُبتلع أوّلُ ثلثِ المشهد في الحجب.
     *
     * و`requestAnimationFrame` من داخل الأثر يقع بعد ذلك كلِّه: الخيطُ
     * فرغ، والشاشةُ التي فوقنا ما زالت معتمة، فمن هنا يبدأ الكشفُ
     * والتجميع معاً.
     */
    const id = requestAnimationFrame(() => homeEntrance.ready());
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* استقرارٌ قصير عند العودة من قسم — الخلفيةُ والمحتوى يهدآن. */
  useEffect(() => {
    if (isFirstIntro) return;
    const s = window.setTimeout(() => setSettling(false), 40);
    return () => window.clearTimeout(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /*
   * «الغلافُ جاهز» يُعلَن عند اكتمال الجدول لا عند مرحلةٍ بعينها.
   *
   * كان مربوطاً بمرحلة البطل (‏STAGE.hero) داخل حلقة المؤقّتات. وربطُه
   * بالاكتمال أصحّ: هذه هي اللحظةُ التي تصير فيها الشاشةُ تفاعليةً
   * طبيعية، وهي بالضبط ما يعنيه `SHELL_READY` للمنسّق.
   */
  useEffect(() => {
    if (settled) motionDispatch({ type: "SHELL_READY" });
  }, [settled]);

  // نغمة تحميل القائمة الرئيسية ثم تُكمل موسيقى «003. Home Menu» بلا فجوة:
  // الموسيقى مُحمّلة مسبقاً من شاشة الدخول، وتبدأ قبل نهاية النغمة بقليل فتتسلّمها
  // بتلاشٍ متداخل ناعم (لا صمت بينهما).
  useEffect(() => {
    preloadAmbient("home"); // احتياط إن لم تُجهَّز من الشاشة السابقة
    // عند العودة من قسم: استأنف الموسيقى بهدوء بلا إعادة نغمة التحميل
    if (!isFirstIntro) {
      playAmbient("home", 900);
      return;
    }
    sfx("homeLoad", 0.95, true);
    const OVERLAP = 550; // تداخل يمنع أي فراغ سمعي
    /*
      المدّة هنا هي الجزء المسموع فقط — وقد صار ذلك صحيحاً فعلاً.
      كان التعليقُ يقول ذلك و`sfx` لا يفعله: يُشغّل الملفَّ من أوّله بما
      فيه صمتُه. وملفُّ هذه النغمة يبدأ بعد **655ms** من صمتٍ رقميّ،
      فكانت الموسيقى تُستلَم متأخّرةً بقدره. الآن يُتخطّى الصمتُ عند
      التشغيل وتُحسب المدّةُ على ما يُسمع، فيقع التسليم في موضعه.

      والاحتياطيّ 2360 لا 1950: هو المدّةُ المسموعة المقيسة (3000 − 640)،
      ويُستعمل إن سُئل قبل أن يُفكّ الملفّ.
    */
    const delay = Math.max(0, (SFX_DURATION_MS.homeLoad ?? 2360) - OVERLAP);
    const t = window.setTimeout(() => playAmbient("home", 1100), delay);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * ترحيبُ الدخول — مرّةً واحدة، وبعد أن تهدأ نغمةُ التحميل.
   *
   * `isFirstIntro` هي الشرط: دخولٌ جديد لا عودةٌ من قسم. ولولاه لرحّب
   * بالمستخدم كلَّما رجع من شاشة الطلبة إلى الرئيسية — وترحيبٌ يتكرّر
   * عشر مرّاتٍ في الساعة يصير ضجيجاً لا استقبالاً.
   *
   * والتأخيرُ ليزاحم شيئاً: نغمةُ تحميل الرئيسية تشغل الثانيتين
   * الأوليين، فلو أُطلق الإشعارُ معها لتراكب صوتان في لحظةٍ واحدة
   * ولم يُسمع أيٌّ منهما. فيأتي بعدها، ومعه الشاشةُ قد استقرّت.
   */
  useEffect(() => {
    if (!isFirstIntro || !user) return;

    const name = `${user.firstName} ${user.lastName}`.trim();

    const timer = window.setTimeout(() => {
      notify.welcome(`مرحباً، ${name}`, user.role?.name ?? undefined);
    }, 2400);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * التنقّل صار **حدثاً دلالياً** لا تغيير حالة (§12).
   *
   * الفارق ليس شكلياً: المنسّق هو من يقرّر ما إذا كان هذا التنقّل مقبولاً
   * أصلاً (يُرفض أثناء المغادرة)، ويحسب الاتجاه والمسافة والسرعة، ويعيد
   * جدولة لحظة الاستقرار. المكوّن يقول ماذا فعل المستخدم فقط.
   *
   * التغذية الراجعة الفورية (صوت + دفعة كاميرا) تبقى هنا لأنها استجابة
   * للإدخال لا للحالة — أولوية الإدخال أعلى من كل شيء (§36).
   */
  const focusTo = useCallback(
    (target: number, source: InteractionSource) => {
      const { focus, phase: ph } = useMotionStore.getState();
      if (ph === "EXITING") return;
      const n = ((target % L) + L) % L;
      if (n === focus.id) return;
      /*
       * أوّلُ تنقّلٍ يطوي ما تبقّى من مشهد الدخول (§23).
       *
       * ليس إلغاءً للحركة: مَن ضغط سهماً فقد أعلن أنّه لا ينتظر المشهد،
       * ومواصلةُ عرضه بعدها تجعل الجهازَ يبدو بطيئاً مهما نعُمت الحركة.
       * والطيُّ يُنهي الجدولَ إلى حالته النهائية الصالحة، فلا تبقى بلاطةٌ
       * خفيّةٌ ولا تمويهٌ عالق. وقبل جاهزية الصفّ لا يفعل شيئاً — لا
       * بلاطةَ يُنتقل إليها أصلاً.
       */
      homeEntrance.interrupt();
      /*
        عبر الطبقة الدلالية لا بنداءٍ مباشر: المكوّن يقول «تنقّل» ولا يعرف
        أيّ ملفٍّ يُشغَّل ولا بأيّ شدّة — ويرث معها كبحَ التتابع السريع،
        فلا تتراكب النغمات حين يُمسك المستخدم السهم.
      */
      uiSound("navigate");
      nudgeCamera(n > focus.id ? 1 : -1); // المشهد يميل باتجاه التنقّل ثم يعود
      motionDispatch({ type: "FOCUS_CHANGE", to: n, source });
    },
    [L, nudgeCamera],
  );

  /**
   * خطوة واحدة. بلا أي كبح زمني: النوابض تُعيد توجيه نفسها من موضعها
   * وسرعتها الحاليّين، فالضغط المتتابع السريع يتدفّق خلال العناصر بدل
   * أن يُصطفّ في طابور أو يُهمَل (§15).
   */
  const step = useCallback(
    (d: number, source: InteractionSource) =>
      focusTo(useMotionStore.getState().focus.id + d, source),
    [focusTo],
  );

  /*
   * تصفير المقاومة عند الطيّ فقط — أمّا **بدؤها** فلا يجوز أن يقع هنا.
   *
   * أوّل تنفيذ جعل الأثر يشعلها عند `expanded`، وقِستُ النتيجة بمراقب
   * تحوّلات: لوحة السياق تُركَّب عند 54ms، وتُفكَّك عند 120ms، وتُركَّب
   * ثانيةً عند 205ms. السبب أنّ الأثر يجري **بعد** التصيير الذي صار فيه
   * المشهد ممتدّاً، فيمرّ إطارٌ كاملة اللوحةُ فيه ظاهرة قبل أن تعرف
   * المقاومة بنفسها.
   *
   * وهذا بالضبط ما يمنعه الفصل: وميضُ مكوّنٍ رُكِّب ثم أُزيل ثم أُعيد —
   * ومعه إعادةُ تشغيل طبقات الكشف كلّها ونقلُ التركيز مرّتين. فصارت
   * المقاومة تُضبط في معالج الحدث نفسه (أدناه)، فيولد التصيير الأول
   * ممتدّاً ومقاوِماً معاً.
   */
  useEffect(() => {
    if (expanded) return;
    window.clearTimeout(braceTimer.current);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBracing(false);
  }, [expanded]);

  /**
   * تأكيد المعاينة — **الإقرار الفوري** الذي كان ناقصاً (§9).
   *
   * كان `FOCUS_CONFIRM` يُرسَل عارياً: لا صوت، ولا وزن، ولا شيء يقول
   * «وصلتْ ضغطتك» قبل أن تبدأ الصفحة حركتها. والنظام يملك طبقةَ نيّات
   * صوتية كاملة (‏lib/ui-sound) لم تكن مستعملةً في أيّ موضع — فالمكوّن
   * يقول «تأكيد» ولا يعرف أيّ ملفٍّ يُشغَّل ولا بأيّ شدّة.
   *
   * الحارس هنا ليس تجميلاً: النقر على البلاطة المؤكَّدة أصلاً، أو ضغط
   * Enter داخل سياقٍ مفتوح، كان سيُطلق نغمة تأكيدٍ لحدثٍ يرفضه المنسّق —
   * أي صوتٌ بلا نتيجة، وهو أسوأ من الصمت.
   */
  const confirmContext = useCallback(() => {
    if (useMotionStore.getState().phase === "PREVIEW_ACTIVE") return;
    /* التأكيدُ أيضاً يطوي ما تبقّى من الدخول — لا سياقَ يُفتح فوق مشهدٍ يُبنى. */
    homeEntrance.interrupt();
    uiSound("confirm");
    /*
     * الترتيب هنا مقصود: تُضبط المقاومة **قبل** إرسال الحدث وفي المعالج
     * نفسه، فتُجمَّع التحديثتان في تصييرٍ واحد (‏React يجمع تحديثات المعالج
     * الواحد). النتيجة أنّ أوّل تصيير ممتدٍّ يحمل المقاومة معه، فلا تُركَّب
     * اللوحة في إطارٍ يتيم ثم تُفكَّك.
     *
     * وحتى لو لم يقع التجميع، فالأسوأ أن يسبق ضبطُ المقاومة الامتدادَ
     * بإطار — وذلك غير مرئي. العكس هو ما يومض.
     */
    window.clearTimeout(braceTimer.current);
    setBracing(true);
    braceTimer.current = window.setTimeout(() => setBracing(false), ex.brace.duration * 1000);
    motionDispatch({ type: "FOCUS_CONFIRM" });
  }, []);

  /**
   * الطيّ — ويُعيد التركيز إلى بوّابة القسم دائماً.
   *
   * التركيز كان يسقط إلى `body` في كل طريق طيٍّ عدا Escape، فتتوقّف
   * الأسهم عن العمل بلا سبب ظاهر ولا يعرف المستخدم أين هو. الاستعادة هنا
   * تجعلها خاصّية الطيّ نفسه لا خاصّيةَ أحد طرقه.
   */
  const collapseContext = useCallback(() => {
    if (useMotionStore.getState().phase !== "PREVIEW_ACTIVE") return;
    uiSound("back");
    motionDispatch({ type: "COLLAPSE" });
    enterRef.current?.focus();
  }, []);

  /**
   * البلاطة المؤكَّدة **مفتاحٌ ذو حالتين**: تفتح السياق وتغلقه.
   *
   * كان النقر عليها وهي مفتوحة لا يفعل شيئاً — يُرسَل التأكيد فيرفضه
   * المنسّق (الحالة `PREVIEW_ACTIVE` أصلاً)، فلا صوت ولا حركة ولا رسالة.
   * والمستخدم الذي فتح بالنقر يتوقّع أن يُغلق بالنقر نفسه؛ وحين لا يحدث
   * شيء يُقرأ الأمر عطلاً لا تصميماً.
   *
   * ولا يتغيّر معه سلوك المفاتيح: Enter يفتح ثم يصير ملكاً للعنصر
   * المركَّز داخل السياق، وEsc يطوي. هذا التبديل يخصّ المؤشّر وحده —
   * لأنّ النقر على الشيء نفسه مرّتين إيماءةُ «افتح/أغلق» بطبيعتها.
   */
  const toggleContext = useCallback(() => {
    if (useMotionStore.getState().phase === "PREVIEW_ACTIVE") collapseContext();
    else confirmContext();
  }, [confirmContext, collapseContext]);

  // دخول بنمط PS5: تختفي الأيقونات والواجهة → تتمدّد خلفية القسم لملء الشاشة → الانتقال
  const launch = useCallback(
    (to: string, moduleId: string) => {
      sfx("enter", 0.92); // صوت اختيار/إطلاق
      stopAmbient(800); // الموسيقى تتلاشى مع الدخول (كما عند فتح لعبة)
      homeIntroPlayed = true; // العودة لاحقاً تدخل مباشرة بلا إعادة المقدّمة
      motionDispatch({ type: "MODULE_ENTER", module: moduleId });

      /*
       * لا رحلة رمزٍ عند الدخول — أُزيلت بطلبٍ صريح.
       *
       * كان رمز القسم يطير من البلاطة إلى ترويسة مساحة العمل. والدخول
       * الآن يعتمد على ما يكفيه: انسحاب الواجهة، وتمدّد خلفية القسم،
       * والحجاب الذي ينمو من منطقة البطل — فيصل المستخدم إلى شاشةٍ تحمل
       * لون القسم ورمزه في ترويستها **مستقرَّين**، بلا جسمٍ يعبر الشاشة
       * ويستقرّ في الأعلى.
       */
      /*
       * المؤقّت يُلغى عند التفكيك (§53): كان يُطلق `navigate` بلا قيد،
       * فلو غادر المستخدم الشاشة بطريق آخر خلال 1.3s (رجوع المتصفّح مثلاً)
       * لقفز التطبيق إلى القسم بعدها بلا سبب ظاهر.
       */
      launchTimer.current = window.setTimeout(() => navigate(to), 1300);
    },
    [navigate],
  );
  const openModule = useCallback(
    (mod: Module) => { if (mod.to) launch(mod.to, mod.id); },
    [launch],
  );
  useEffect(() => () => {
    window.clearTimeout(launchTimer.current);
    window.clearTimeout(braceTimer.current);
  }, []);

  // لوحة المفاتيح — الاتجاه دلالي: `arrowToStep` يترجم السهم حسب اتجاه
  // المستند، فلا يُفترض في الشيفرة أن اليسار يعني «التالي» (§48/§49).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = arrowToStep(e.key, dir);
      if (s !== null) {
        e.preventDefault();
        /*
         * السهم الأفقي يعني «قسمٌ آخر» — فيطوي المفتوح ثم ينتقل.
         *
         * والتركيز يُسحب **قبل** الطيّ لا بعده: كان يبقى معلَّقاً على فرعٍ
         * داخل السياق، ثمّ يُفكَّك ذلك الفرع فيسقط التركيز إلى `body`. لا
         * شيء يُرى، لكنّ لوحة المفاتيح تصير بلا موضع — والمستخدم يتنقّل
         * بين الأقسام وهو لا يملك ما يضغط عليه Enter.
         */
        if (useMotionStore.getState().phase === "PREVIEW_ACTIVE") enterRef.current?.focus();
        step(s, "keyboard");
        return;
      }
      /*
       * النصف الثاني من الحلقة الرأسية: من البوّابة إلى الفروع.
       *
       * لوحة السياق تملك الأسهم الرأسية داخلها، لكنّ البوّابة تقع **خارج**
       * شجرتها — فحين يرتدّ التركيز إليها ينقطع الطريق نزولاً. يُعالَج هنا
       * لأنّ هذا المستمع هو الوحيد الذي يرى الطرفين.
       */
      if (
        e.key === "ArrowDown" &&
        useMotionStore.getState().phase === "PREVIEW_ACTIVE" &&
        document.activeElement === enterRef.current
      ) {
        const first = document.querySelector<HTMLElement>("[data-ctx-focus]:not([disabled])");
        if (first) {
          e.preventDefault();
          first.focus({ preventScroll: true });
          return;
        }
      }
      /*
       * Enter لا يدخل القسم — **يفتحه للاستكشاف**. هذه هي المرحلة التي
       * كانت ناقصة: بين «رأيتُ الاسم» و«دخلتُ»، مرحلةُ «فهمتُ ما بداخله».
       *
       * وبعد أن ينفتح السياق يصير Enter **ملكاً للعنصر المركَّز** لا
       * للشاشة. هذا الحدّ كان غائباً، وثمنه أكبر ممّا يبدو: المستمع هنا
       * يلتقط الحدث وهو يصعد من الزرّ، و`preventDefault` يلغي فعل المتصفّح
       * الافتراضي — أي أنّ Enter كان **يعطّل كل زرّ داخل السياق المفتوح**،
       * وكذلك زرّ «ابدأ الآن» نفسه. ولذلك كان سطر الإرشاد يقول «‏Enter ثم
       * مسافة للدخول»: نصيحةٌ تلتفّ حول عطل بدل أن تصفَ سلوكاً مقصوداً.
       */
      if (e.key === "Enter") {
        if (useMotionStore.getState().phase === "PREVIEW_ACTIVE") return;
        e.preventDefault();
        confirmContext();
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        collapseContext();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, dir, confirmContext, collapseContext]);

  // عجلة الفأرة فوق الشريط → تنقّل سلس
  useEffect(() => {
    const el = stripRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const delta = Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 6) return;
      e.preventDefault();
      step(wheelToStep(delta), "wheel");
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  return (
    <div className="relative h-screen select-none overflow-hidden bg-[#04060c] text-white">
      {/* طبقات الخلفية داخل غلاف يتمدّد عند الدخول (كتوسّع فنّ اللعبة في PS5) */}
      <div
        className="absolute inset-0"
        style={{
          // الدخول: تمدّد كامل · العودة: تبدأ مكبّرة قليلاً ثم تستقرّ (عكس حركة الدخول)
          /*
           * ① انسحاب الكاميرا: المشهد يبدأ أقرب قليلاً ثم يستقرّ في موضعه.
           * هذا ما يمنح الإحساس بأن للعالم عمقاً كان موجوداً قبل أن ننظر.
           */
          /*
            **لا انكماش عند التوسّع** — أُزيل.

            كان المشهد يتراجع إلى `scale(0.98)` بنيّة «الكاميرا تنسحب لتسع
            ما ظهر». والعيب أنّ هذه الطبقة **ملء الشاشة**: أيّ مقياس تحت
            الواحد يكشف ما تحتها عند الأطراف — أي إطارٌ داكن (‏#04060c)
            يظهر حول الشاشة كلّها بعرض ~13px، فتبدو الصورة وقد نقصت عن
            حدودها. وهذا ما لا يُغتفر في طبقةٍ يفترض أنّها تملأ العالم.

            ولم يعد له داعٍ أصلاً: اعتراف البيئة بالامتداد صار يقع في
            **اتّساع الضوء المحيط** (‏1 ← 1.05 في AmbientEnvironment)، وهو
            غير مكبوح ولا يكشف حافّة. كان الانكماش تكراراً لرسالةٍ مؤدّاة
            بوسيلة أفضل — وثمنه إطارٌ مرئي.

            وما بقي من مقاييس كلّه **فوق** الواحد (الإطلاق والاستقرار
            والدولي)، فلا تنكشف حافّة في أيّ حال.
          */
          transform: launching
            ? "scale(1.32)"
            : settling
              ? "scale(1.10)"
              : !worldLit
                ? `scale(${boot.dolly})`
                : "scale(1)",
          /*
           * زمنان لا زمن واحد.
           *
           * كان الانسحاب المصاحب للامتداد يستعير مدّة دولي الإقلاع
           * (‏1100ms) — أي أنّ الصفحة تنتهي من الامتداد (‏460ms) ويستقرّ
           * محتواها كلّه (‏740ms) والعالمُ ما زال يتراجع خلفهما. والقاعدة
           * المعلنة في جدول الكشف أنّ **البيئة تُغلق المشهد**: تلحق آخر
           * طبقة ولا تتخلّف عنها بنصف ثانية.
           *
           * `entered` يفصل الحالتين: قبله نحن في الإقلاع وللدولي مدّته،
           * وبعده كلّ تغيّر في المشهد سببه الامتداد أو العودة.
           */
          transition: launching
            ? "transform 1300ms cubic-bezier(0.4,0,0.2,1)"
            : `transform ${entered ? ex.world.duration * 1000 : entranceShell.dollyMs}ms cubic-bezier(0.22,1,0.36,1)`,
          willChange: "transform",
        }}
      >
      {/* ===== طبقات الخلفية المحيطة (Ambient) — تلاشٍ متبادل ===== */}
      {MODULES.map((mod, i) => {
        const active = i === focused;
        /*
         * **فنّ القسم يُركَّب للمرئيّ وسابقِه فقط.**
         *
         * كانت الصور التسع كلّها مركَّبةً دائماً، وثمانٍ منها عند شفافية
         * صفر — أي أنّ المتصفّح يفكّ ضغط تسع صور ملء الشاشة ويحتفظ بها في
         * ذاكرة التركيب، **بلا أن يُرى منها شيء**. على جهاز نقاط بيع
         * بذاكرة رسومية متواضعة هذا وحده يلتهم ما يكفي لإبطاء كل شيء.
         *
         * والتلاشي المتبادل يحتاج اثنتين لا تسعاً: الداخلة والخارجة.
         * وأثناء الاندفاع تُفكَّك الخارجة مبكراً — وهو ما نريده أصلاً
         * (تُسقَط الزخرفة لا الاستجابة).
         */
        const showArt = active || i === focus.previousId;
        const wall = mod.wall ? WALLPAPERS[mod.wall] : undefined;
        return (
        <motion.div
          key={mod.id}
          className="absolute inset-0"
          /*
           * الخلفية طبقة سينمائية: تبدأ بعد 60ms من بدء التنقّل وتستمرّ
           * 620ms — أي أنّ البلاطة تصل وتستقرّ والخلفيتان ما زالتا
           * متراكبتين. وهي لا تتلاشى فقط: الخارجة تتمدّد قليلاً وتنزاح
           * باتجاه التنقّل، والداخلة تهبط من تكبير طفيف وتنزاح عكسه.
           */
          animate={{
            opacity: bgReady && active ? 1 : 0,
            scale: active ? 1 : bgBase.exitScale,
            x: active ? 0 : navDir * bgBase.shift,
          }}
          initial={false}
          transition={{
            duration: bgBase.duration,
            delay: active ? bgBase.delayIn : 0,
            ease: [0.22, 1, 0.36, 1],
          }}
          /*
           * الترقية للمعالج الرسومي للطبقة النشطة وحدها.
           * كانت `willChange` ثابتة داخل خريطة الأقسام، أي **تسع** طبقات
           * ملء الشاشة مرفوعة دائماً — ضغط ذاكرة بلا مقابل على بطاقة
           * مدمجة، وهو بالضبط ما تحذّر منه المواصفة. الطبقات الثماني
           * المخفية لا تتحرّك أصلاً فلا تستحقّ الترقية.
           */
          style={{ willChange: active ? "opacity, transform" : "auto" }}
        >
          {/* لون أساس (يظهر خلف الصورة ويملأ الأطراف) */}
          <div className="absolute inset-0" style={{ background: `linear-gradient(125deg, ${mod.from} 0%, ${mod.via} 46%, ${mod.end} 100%)` }} />

          {!showArt ? null : wall ? (
            /* خلفية القسم الحقيقية (كفنّ اللعبة في PS5) + تكبير Ken Burns بطيء */
            /* غلاف الكاميرا خارجاً، وKen Burns داخلاً: لو اجتمعا على عنصر
               واحد لتغلّبت حركة CSS على transform الكاميرا وأُلغي التوازي. */
            <motion.div className="absolute inset-0" style={{ x: camBg.x, y: camBg.y, scale: camZoom }}>
              <img
                src={wall}
                alt=""
                aria-hidden
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
                /*
                  تكبير Ken Burns **لا يبدأ قبل أن ينتهي الاستيقاظ**.

                  كان يبدأ لحظةَ صار القسم نشطاً: حركةُ تكبيرٍ لانهائية على
                  صورة 2560×1440 ملءَ الشاشة، تعمل بينما الكاميرا تتقارب
                  والبلاطات تُجمَّع والطاقة تصل. أي **عنصران كبيران يتحرّكان
                  في اللحظة نفسها** — وهو ما ينهى عنه مرجع الحركة صراحةً
                  («No two large elements should animate simultaneously»).

                  والثمن مقيس: 37٪ من إطارات المرحلة 0–700ms متأخّرة على
                  بناء الإنتاج، وهي أسوأ مراحل المقدّمة كلّها.

                  والتأجيل مجّاني بصرياً: الدورة 26 ثانية، فأوّل ثانيتين منها
                  إزاحةٌ دون بكسل واحد. نؤجّلها إلى ما بعد ولادة البطل فنكسب
                  الإطارات ولا نخسر شيئاً يُرى.
                */
                style={{
                  animation:
                    active && !launching && entered
                      ? "skk-bg-zoom 26s ease-in-out infinite alternate"
                      : undefined,
                }}
              />
            </motion.div>
          ) : (
            <>
              {/* بلا صورة: توهّجان ناعمان + فنّ الأيقونة (المظهر السابق) */}
              <div className="absolute rounded-full" style={{ width: "48vw", height: "48vw", left: "-8%", top: "-6%", background: `radial-gradient(circle at 42% 42%, ${mod.glow}, transparent 60%)`, filter: "blur(46px)", animation: active ? "skk-float 14s ease-in-out infinite" : undefined }} />
              <div className="absolute rounded-full" style={{ width: "36vw", height: "36vw", right: "6%", bottom: "4%", background: `radial-gradient(circle at 50% 50%, ${mod.accent}26, transparent 62%)`, filter: "blur(56px)", animation: active ? "skk-float 11s ease-in-out infinite" : undefined }} />
              <mod.icon
                aria-hidden
                strokeWidth={1}
                className="absolute left-[4%] top-1/2 h-[28vw] w-[28vw] max-h-95 max-w-95"
                style={{
                  color: mod.accent,
                  transform: "translateY(-50%)",
                  opacity: launching && active ? 0.4 : 0.08,
                  transition: "opacity 1100ms ease-out",
                  animation: active && !launching ? "skk-drift 18s ease-in-out infinite" : undefined,
                }}
              />
            </>
          )}
        </motion.div>
        );
      })}
      {/*
        الحجب السينمائي: يقرأ النصّ فوق الصور دائماً، ويشتدّ قليلاً أثناء
        الانتقال ثم يعود. أثناء تبدّل الخلفيتين تتراكب صورتان وتزداد
        التفاصيل، فلولا هذا الاشتداد لزاحمت الصورةُ العنوانَ والشريط.
      */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgba(4,6,12,0.97) 2%, rgba(4,6,12,0.55) 30%, rgba(4,6,12,0.12) 62%, transparent 82%)," +
            "linear-gradient(to left, rgba(4,6,12,0.85) 0%, rgba(4,6,12,0.35) 32%, transparent 62%)",
        }}
        animate={{ opacity: launching ? 0 : 1 }}
        transition={{ duration: 0.9, ease: "easeOut" }}
      />
      {/* طبقة تعتيم إضافية تُستوفى مع التنقّل وحده (تشتدّ ثم تهدأ) */}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(4,6,12,0.55), rgba(4,6,12,0.15) 55%, transparent 80%)" }}
        initial={false}
        animate={{ opacity: launching ? 0 : 1 }}
        key={"veil" + focused}
        transition={{ duration: bgBase.duration, ease: [0.22, 1, 0.36, 1] }}
      />
      {/* البيئة الدائمة: تُركَّب مرّة واحدة خارج خريطة الأقسام فلا تُعاد
          دورتها مع كل تنقّل — ما يتبدّل هو لونها لا حركتها. */}
      {/*
        ① الجوّ يستيقظ. كان مرئياً منذ الإطار الأول، فيبدأ المشهد مضاءً
        ثم تُضاف إليه الخلفية — أي عكس الترتيب المطلوب. الآن الضوء المحيط
        أوّل ما يظهر، وببطء (‏720ms) فتُقرأ اللحظة استيقاظاً لا كشفاً.
      */}
      <motion.div
        className="absolute inset-0"
        initial={isFirstIntro ? { opacity: 0 } : false}
        animate={{ opacity: worldLit ? 1 : 0 }}
        transition={{ duration: entranceShell.world, ease: entranceCurve.ambient }}
      >
        <AmbientEnvironment accent={m.accent} glow={m.glow} response={sceneResponse} deepened={expanded} />
      </motion.div>
      </div>

      {/* ===== المحتوى — يختفي أولاً عند الدخول (الأيقونات العلوية والتفاصيل) ===== */}
      <div
        className="relative flex h-full flex-col"
        style={{
          zIndex: LAYER.content,
          opacity: launching || settling ? 0 : 1,
          transform: launching ? "translateY(-14px)" : "none",
          transition: launching
            ? "opacity 450ms ease-out, transform 600ms cubic-bezier(0.4,0,0.2,1)"
            : "opacity 700ms ease-out",
          pointerEvents: launching ? "none" : "auto",
        }}
      >
        {/* شريط علوي */}
        {/* الشريط العلوي معلومات ثانوية: يبقى أهدأ من المحتوى ويستعيد
            وضوحه الكامل عند المرور عليه فقط. */}
        {/* ③ هويّة النظام: الساعة والمستخدم والمؤشّرات — قبل التنقّل. */}
        <motion.header
          /*
            الشفافية يملكها `motion` وحده.
            كان معها `transition-opacity duration-300` و`hover:!opacity-100`
            من Tailwind — أي نظامان يكتبان الخاصّية نفسها. وهذا بالضبط ما
            حذّرت منه القاعدة العامّة: انتقالُ CSS يستوفي من القيمة
            المحسوبة الأولى (1) بينما يكتب motion قيمه السطرية، فتظهر
            وميضةُ إطارٍ واحد قبل أن تهدأ. الآن التحويم أيضاً من motion.
          */
          /*
            الغلافُ للحركة وحدها — التخطيطُ داخل `HomeTopBar`.
            كان يحمل `flex` و`gap` و`px-9` أيضاً، فلمّا انتقل التخطيط
            إلى المكوّن صار الحشوُ مكتوباً مرّتين (‏px-9 هنا وهناك)
            فانزاح الشريطُ عن حافّته ضعفَ ما ينبغي.
          */
          className="pt-4"
          initial={isFirstIntro ? { opacity: 0, y: -10 } : false}
          animate={{ opacity: identityReady ? chor.chromeIdleOpacity : 0, y: identityReady ? 0 : -10 }}
          whileHover={identityReady ? { opacity: 1 } : undefined}
          transition={{ duration: entranceShell.identity, ease: entranceCurve.enter }}
          style={{ opacity: chor.chromeIdleOpacity }}
        >
          <HomeTopBar
            user={user ?? null}
            schoolName={schoolName}
            shortName={shortName}
            shortSuffix={shortSuffix}
            brandColor={brandColor}
            time={fmtTime(now)}
            date={fmtDate(now)}
            onSettings={() => focusTo(MODULES.findIndex((x) => x.id === "settings"), "programmatic")}
            onLogout={() => {
              sfx("logout", 0.85);
              /*
                ولا تُوقَف الموسيقى.
                شاشةُ الاختيار تطلب نغمتَها عند تركيبها، و`playAmbient`
                يُخفت السابقةَ ويُدخل التالية بتلاشٍ متداخل — فالانتقالُ
                تسليمٌ لا انقطاع، ذهاباً إلى الرئيسية وعودةً منها.
              */
              homeIntroPlayed = false; // الدخول القادم يستحقّ المقدّمة الكاملة
              homeEntrance.reset(); // ولا يرث جدولَ دخولٍ اكتمل في الجلسة الماضية
              motionDispatch({ type: "RESET" }); // جلسة جديدة لا ترث موضع السابقة
              clearPageMemory(); // ولا ترث تمرير الجلسة السابقة ولا بحثها
              logout();
            }}
          />
        </motion.header>

        {/* ===== شريط التنقّل المكاني: هندسة تتمدّد + صفّ ينزلق + إطار واحد ===== */}
        <div className="mt-7">
          {/* دخول الصفّ ككتلة واحدة — مقيَّد عمداً، بلا استعراض لكل أيقونة */}
          {/*
            ④ الشريط **يُجمَّع** ولا يُعرَض.
            كان يدخل ككتلة واحدة بتلاشٍ — وهو ما ترفضه هذه المرحلة صراحةً.
            الآن لكل بلاطة دخولها، والتتابع من المركَّزة نحو الأطراف: الصفّ
            بنيةٌ لها مركز، والمركز هو الوجهة التي سيقف عندها المستخدم.
          */}
          {/*
            الصفّ **يشارك** في الامتداد (§10).

            كان يقف ساكناً تماماً بينما تنفتح الصفحة تحته — فيُقرأ طبقةً
            مستقلّة لا جزءاً من الجسم الذي يتحوّل. يرتفع 6px مع البطل:
            حركةٌ واحدة تسري في المنطقة العليا كلّها بينما يُخلق الفضاء
            أسفلها، فتُقرأ الصفحةُ ممتدّةً لا مضافاً إليها.

            الإزاحة تحويلٌ محض: لا تمسّ `offsetLeft` الذي يقيس منه الصفّ
            مرساته، فلا تنحرف محاذاة العنوان والبطل عن البلاطة.
          */}
          {/*
            ④ الصفّ **بنيةٌ تُبنى**، لا تسع قطع تُركَّب متجاورة.

            كل بلاطة كانت ترتفع وحدها بينما الحاوية ساكنة، فيغيب ما يجمعها.
            الآن للصفّ حركةٌ جامعة (‏10px ترتفع كجسم واحد) وللأعضاء تتابعهم
            داخلها — وهذا بالضبط معنى «الشريط يتصرّف كجسم واحد»: لا الحركة
            الجامعة وحدها (فتصير كتلةً تُعرَض)، ولا التتابع وحده (فتصير
            قِطعاً متفرّقة).
          */}
          <motion.div
            ref={stripRef}
            initial={isFirstIntro ? { y: entranceShell.rise } : false}
            animate={{ y: assembled ? (expanded ? ex.row.y : 0) : entranceShell.rise }}
            transition={
              entered
                ? { duration: ex.row.duration, ease: MOTION.easing.enter }
                : { duration: entranceShell.riseDuration, ease: entranceCurve.enter }
            }
          >
            <SpatialNavRow
              activeIndex={focused}
              itemCount={L}
              rtl
              /*
                حشوٌ غير متماثل: فسحةٌ فوق الصفّ، والتصاقٌ تحته.

                كان `py-8` يترك 32px أسفل البلاطات، فيهبط اسم القسم بعيداً
                عنها (قِسته: 36px من قاع البلاطة) ويُقرأ سطراً مستقلّاً
                يطفو في الفراغ لا **اسماً لهذا الجسم**. وفي المرجع يلتصق
                الاسم ببلاطته حتى لا يحتاج المستخدم أن يربط بينهما.

                12px أسفل: تكفي لحلقة التركيز (تمتدّ ~4px خارج البلاطة)
                ولتكبير التحويم، ولا تزيد.
              */
              /*
                الحشو السفلي يخدم **موضع الاسم وحده**.

                حلقة التركيز لم تعد تعتمد عليه: الصفّ صار يقصّ بهامشٍ
                (`overflow-clip-margin`) فتمتدّ الحلقة وتوهّجُها خارج صندوق
                الحشو بلا قصّ. فبقي هذا الرقم حرّاً لغرضٍ واحد — قرب الاسم
                من بلاطته — ولا يُقصّ شيءٌ حين يُشدّ.
              */
              className="px-10 pt-8 pb-1"
              gap={metrics.gap}
              onAnchor={setLabelAnchor}
            >
              {MODULES.map((mod, i) => {
                const isCenter = i === focused;
                /*
                  دخولُ البلاطة — يُشتقّ في `motion/home-entrance/variants`.

                  أربعُ قنواتٍ متزامنة (شفافية، إزاحة، مقياس، تمويه)
                  تقرّرها ثلاثةُ مصادر (مرحلةُ الجدول، ومسافةُ البلاطة عن
                  المركَّزة، وتفضيلُ تقليل الحركة). كتابتُها هنا كانت
                  ستُخرج تعبيراً شرطياً من أربعة مستويات في تسعة أسطر
                  متشابهة — ثم يصير أوّلُ ضبطٍ للإيقاع تعديلاً فيها كلّها.

                  و`restOpacity` هي الوصلةُ بين شأنين مختلفين يتقاسمان
                  الشفافية: الدخولُ يملكها حتى يكتمل، ثمّ يملكها خفوتُ
                  الجيران عند الامتداد. تمريرُها إلى المشتقّ يمنع أن
                  يكتب النظامان القيمةَ نفسها من موضعين.
                */
                const enter = tileEntrance({
                  index: i,
                  focused,
                  count: L,
                  assembled,
                  done: settled,
                  restOpacity: expanded && !isCenter ? ex.row.dim : 1,
                  still,
                });
                return (
                  <motion.span
                    key={mod.id}
                    className="relative shrink-0"
                    style={{ zIndex: isCenter ? LAYER.navItemFocused : LAYER.navItem, ...enter.style }}
                    data-hovered={hovered === i ? "" : undefined}
                    /* التتابع بالمسافة عن المركَّزة — لا بترتيب القراءة. */
                    /*
                      البلاطة **تصل**، لا تظهر.

                      كانت تدخل بالشفافية والإزاحة وحدهما، فتُقرأ كطبقةٍ
                      كُشف عنها. المرجع يصف دخول العناصر الثانوية بمقياس
                      ‏0.95→1.0 — والقدر ضئيل عمداً: على بلاطة 48px هو
                      ‏2.4px، لا يُلاحَظ كتكبير بل يُحسّ خفّةً وقدوماً.

                      وهو تحويل محض كالإزاحة، فلا يكلّف تخطيطاً ولا رسماً.
                    */
                    initial={isFirstIntro ? enter.initial : false}
                    /*
                      عند الامتداد تخفت الجيران وحدهم وتبقى المركَّزة عند 1.
                      هذا هو الفرق بين «الصفّ تراجع» و«الصفّ انطفأ»: البلاطة
                      المؤكَّدة أصلُ كلّ ما انفتح، فخفتُها كان سيقطع نسبَ
                      البطل والسياق إليها في اللحظة التي يجب أن تتأكّد فيها.
                    */
                    animate={enter.animate}
                    /*
                      بعد اكتمال الدخول يتبدّل مالك هذا الانتقال: التتابع
                      المتدرّج يخصّ **تجميع** الصفّ مرّةً واحدة، أمّا خفوته
                      واستعادته فيتبعان إيقاع الامتداد. لولا الفصل لورث
                      الخفوتُ تأخيراتِ الدخول فتلاحقت البلاطات كأنّها
                      تُجمَّع من جديد في كلّ فتح.
                    */
                    transition={
                      settled
                        ? { duration: ex.row.duration, ease: MOTION.easing.enter }
                        : enter.transition
                    }
                  >
                    <SpatialNavItem
                      selected={isCenter && focusArrived}
                      index={i}
                      count={L}
                      field={energyField}
                      /* يُعيد تشغيل الانعكاس المسافر عند كل وصول. */
                      arrivalKey={focused}
                      metrics={metrics}
                      /*
                        تزايد الفهرس يسير يساراً في العربية، فدفع الجيران
                        بعيداً عن الثقل ينعكس معه. تُحسب مرّة هنا وتُمرَّر،
                        بدل أن تقرأ كلُّ بلاطة اتّجاه المستند بنفسها.
                      */
                      pushSign={dir === "rtl" ? -1 : 1}
                      onSelect={() => focusTo(i, "pointer")}
                      onHover={(h) => motionDispatch({ type: "EXPLORE", index: h ? i : null })}
                      /*
                        تفاعل من خطوتين: النقر على البلاطة **يعاين** ولا
                        يدخل. الدخول من زرّ الإجراء الأساسي وحده. كان
                        النقر على البلاطة المحدَّدة يفتح القسم مباشرةً،
                        فيتخطّى المعاينة كلياً.
                      */
                      /* النقر على المحدَّدة يؤكّدها فينفتح سياقها — لا يدخل. */
                      onActivate={toggleContext}
                      label={mod.label}
                      background={{
                        selected: `linear-gradient(140deg, ${mod.from}, ${mod.end})`,
                        idle: "rgba(255,255,255,0.1)",
                      }}
                      badge={
                        mod.soon ? (
                          <span className="absolute inset-e-1.5 top-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-bold text-white/70">
                            قريباً
                          </span>
                        ) : undefined
                      }
                    >
                      <mod.icon
                        aria-label={mod.label}
                        strokeWidth={1.5}
                        className="h-[62%] w-[62%]"
                        style={{ color: mod.accent }}
                      />
                    </SpatialNavItem>
                    {/* إطار التركيز الوحيد — ينتقل بين البلاطات لا يُرسم على كلٍّ منها */}
                    {/* الحافّة آخر ما يُعرَّف — بعد أن تستقرّ الطاقة. */}
                    {isCenter && edgeReady && (
                      <FocusIndicator size={metrics.focused} arrivalKey={focused} />
                    )}
                  </motion.span>
                );
              })}
            </SpatialNavRow>
          </motion.div>

          {/* اسم القسم — يخرج القديم ثم يدخل الجديد، مرتبطاً بالبلاطة المركَّزة */}
          {/*
            ⑤ الاسم يصل **مع الطاقة** لا قبلها.

            قِستُ الإقلاع فوجدت هذا السطر عند شفافية 1 في الإطار الأول —
            الترويسة صفر، والبلاطات التسع صفر، والبطل غير مركَّب أصلاً،
            و«المبيعات» مكتوبةٌ وحدها في السواد. أي أنّ أوّل ما يراه
            المستخدم في بيئةٍ يفترض أنّها نائمة هو **نصّ واجهة**.

            السبب أنّ المكوّن لم يكن مربوطاً بأي مرحلة: كل ما حوله يُقاد
            بجدول الإقلاع وهو خارجه. وربطُه بوصول الطاقة (لا بتجميع الصفّ)
            مقصود: الاسم يخصّ البلاطة التي استقرّ عليها الانتباه، فلا معنى
            له قبل أن يستقرّ.
          */}
          {/*
            يرتفع مع وصول الطاقة ولا يكتفي بالظهور.
            كان تلاشياً محضاً — والشفافية وحدها ليست حركة، هي غياب أو
            حضور. ستّة بكسلات تجعل الاسم يصعد **من** البلاطة التي وصلها
            الانتباه، فيُقرأ نتيجةً لها لا حدثاً مستقلّاً بجوارها.
          */}
          <motion.div
            initial={isFirstIntro ? { opacity: 0, y: 6 } : false}
            animate={{ opacity: focusArrived ? 1 : 0, y: focusArrived ? 0 : 6 }}
            transition={{ duration: entranceContent.duration, ease: entranceCurve.enter }}
          >
            {/*
              **بجانب البلاطة لا تحتها.**

              كان السطر يُحاذي حافّة البلاطة المركَّزة نفسها، فيقع تحتها
              مباشرةً. وفي المرجع يبدأ **حيث تنتهي البلاطة**: في الفراغ
              الواقع أسفل الأيقونات الأصغر، ويحاذي حافّة البلاطة التالية.

              والسبب بنيوي لا ذوقي: البلاطة المركَّزة أطول من جيرانها، فتحتها
              لا فراغ — أمّا بجانبها فمساحةٌ خالية بعرض الصفّ كلّه. وضعُ
              الاسم فيها يملأ ما هو فارغ ويترك البلاطة وحدها في عمودها.

              الإزاحة = عرض البلاطة المركَّزة + فجوة الصفّ، أي بالضبط موضع
              الحافّة الأولى للبلاطة التالية. ولا تُمرَّر إلى البطل: هو يبقى
              على محاذاته الأصلية تحت البلاطة.
            */}
            <AnimatedContextLabel
              id={focused}
              title={m.label}
              direction={navDir}
              anchor={labelAnchor + metrics.focused + metrics.gap}
              className="h-6 px-10 text-right"
            />
          </motion.div>
        </div>

        {/* ===== منطقة البطل بنمط PS5: عنوان كبير أسفل + زر «ابدأ الآن» + بطاقات ===== */}
        {/*
          العمود يصير قابلاً للتمرير عند الحاجة فقط — **وبلا شريط ظاهر**.

          شريط التمرير الأصلي في WebView2 عنصرٌ نظاميّ عريض رماديّ، يقفز إلى
          حافّة المشهد لحظة الانفتاح فيقصّه بخطٍّ صلب. ومهما دقّ ما تحته من
          حركة، ذلك الخطّ وحده يُرجع الواجهة عشرين سنة إلى الوراء.

          التمرير يبقى عاملاً (بالعجلة ولوحة المفاتيح)، والزينة تختفي. نفس
          النمط المستعمل في صفّ البطاقات منذ البداية.
        */}
        <div
          /*
            **الحاوية لا تتبدّل — المحتوى وحده ينمو.**

            كانت أصنافُ هذا العمود تنقلب في لحظة التأكيد: من `pb-8` بلا
            تمرير إلى `overflow-y-auto pb-16`. أي أنّ نوع الحاوية نفسه
            يتغيّر في الإطار الذي يبدأ فيه الامتداد — وهذا بالضبط ما يجعل
            اللحظة تُقرأ «عنصرٌ رُكِّب» لا «فضاءٌ اتّسع»: قفزةُ حشوٍ مقدارها
            32px تقع دفعةً واحدة تحت محتوًى يفترض أنّه ينساب.

            الآن العمود قابل للتمرير دائماً (وبلا شريط ظاهر دائماً)، وحشوه
            ثابت. ما كان يوفّره `pb-16` من متنفَّس انتقل إلى داخل لوحة
            السياق، فصار جزءاً من الارتفاع الذي يُستوفى من صفر بدل أن
            يُضاف قفزةً. لا شيء يتبدّل هنا عند الفتح إطلاقاً.
          */
          className="relative flex min-h-0 flex-1 flex-col px-10 pb-8 overflow-y-auto [-ms-overflow-style:none] scrollbar-none [&::-webkit-scrollbar]:hidden"
          /*
            الحافّة السفلى تذوب ولا تُقطع.

            كان المحتوى ينتهي بخطٍّ صلب عند حدّ الحاوية — صفٌّ من الأرقام
            مقصوصٌ في منتصف ارتفاعه. وهذا وحده يجعل المشهد يبدو مقتطعاً لا
            ممتدّاً، مهما نعُمت الحركة قبله.

            القناع يُذيب المحتوى نفسه فتظهر الخلفية من خلفه، فتُقرأ الحافّة
            «هناك المزيد» بلا سهم ولا زرّ — وهما ما رفضتَه صراحةً.

            يُطبَّق عند التوسّع فقط: في التصفّح لا شيء تحت الحافّة أصلاً،
            وتذويبُ ما لا يمتدّ يُفقد البطل حدّته بلا سبب.
          */
          style={
            expanded
              ? {
                  /*
                    الذوبان صار **شريطاً رفيعاً** لا خُمس العمود.

                    كان يبدأ من 82% — أي أنّ 18% من ارتفاع المحتوى تُستهلك
                    تلاشياً. على عمودٍ بارتفاع 285px يعني ذلك نحو 51px
                    تخفت فيها البطاقات، فيُقرأ المشهد **ناقصاً عند حدّه
                    السفلي** لا ممتدّاً — وهو ما لا نريده.

                    الغرض الأصلي يبقى قائماً: تليينُ القطع الصلب عند حافّة
                    الحاوية. ويكفيه 5% (~14px) — يزول معها الخطّ الحادّ ولا
                    يُقتطع محتوى.
                  */
                  maskImage: "linear-gradient(to bottom, #000 95%, transparent 100%)",
                  WebkitMaskImage: "linear-gradient(to bottom, #000 95%, transparent 100%)",
                }
              : undefined
          }
        >
          <div className="flex-1" />

          {/*
            منطقة البطل — **تتحوّل ولا تُستبدل**.

            كانت تحمل `key={"d" + focused}`، أي أنّ كل تنقّل يهدم الشجرة
            كلّها ويبنيها من جديد. ولذلك أثران:

              • بصرياً: كل ما فيها «يظهر من العدم» — وهو بالضبط ما يمنعه
                هذا الفصل. حركةُ دخولٍ لطيفة على عنصرٍ وُلد للتوّ تبقى
                ولادةً، لا تحوّلاً.
              • وظيفياً: زرّ الدخول يُفكَّك ويُعاد، فـ`enterRef` يشير إلى
                عقدة على وشك أن تموت. الضغط على Enter كان ينقل التركيز إلى
                زرٍّ يُستبدل بعده بجزء من الثانية.

            الآن الحاوية والزرّ يبقيان مركَّبَين، والمحتوى وحده ينتقل داخل
            `AnimatePresence` لكل طبقة. البطل جسمٌ واحد يتغيّر معناه.

            والجسر: لا تنسحب كبقية المحتوى عند المغادرة — تتقدّم نحو
            المستخدم (1 ← 1.06) بينما ينحسر ما حولها، ومنشؤها **عند
            البلاطة** لا عند حافّة الشاشة. فيقرأ الحجابُ المتمدّد بعدها
            كأنّه نما منها.
          */}
          {entered && (
          <motion.div
            className="mb-5 flex flex-col items-start text-right"
            /*
              البطل **يشارك** في التوسّع ولا يقف متفرّجاً.
              كان ساكناً تماماً بينما تمتدّ الصفحة تحته، فيُقرأ منفصلاً عمّا
              يجري. الآن يرتفع 12px وينكمش 2.5% — إعادةُ توازنٍ لا تنحيةً:
              يبقى مهيمناً (المواصفة تمنع إنقاص أهمّيته)، لكنّه يُفسح ويتحرّك
              مع الصفحة فيُقرأ جزءاً من الجسم الممتدّ.
            */
            /*
              ⑥ البطل **ينمو من البلاطة** ولا يظهر مستقلّاً عنها.

              قِستُ الإقلاع: كان يُركَّب عند شفافية 1 دفعةً واحدة — «ظهر»
              حرفياً، وهو ما تمنعه هذه المرحلة نصّاً. السبب أنّ الحاوية بلا
              `initial`، فيعتبرها motion واصلةً في حالتها النهائية.

              ومنشأ التحوّل (‏`transformOrigin: 100% 50%`) هو حافّة البداية
              في التخطيط العربي — أي العمود الذي تقف عليه البلاطة نفسها.
              فالنموّ من 0.965 مع صعود 12px يُقرأ امتداداً **من** ذلك
              العمود، لا ولادةً في مكانٍ مجاور.

              ويُقيَّد بالمقدّمة الأولى: العودة من قسم لا تُعيد الولادة —
              البطل كان هناك أصلاً.
            */
            /*
              ⑦ المحتوى يصل **بعد** أن يستقرّ الانتباه، وأبطأَ منه.

              كان يدخل بثلاث قنوات (شفافية ومقياس وإزاحة) بأرقامٍ مكتوبة
              هنا. أُضيفت الرابعة — التمويه — وصارت الأربعُ من الجدول:
              البطلُ كتلةٌ بصريةٌ أكبر من البلاطة، فحدّتُه تأتي متأخّرةً
              عنها قليلاً. وهذا هو تسلسلُ البؤرة نفسُه: تحدّ الوجهةُ
              أوّلاً، ثمّ ما تصفه.

              والإزاحةُ نزلت 12px ← 8: الصفُّ فوقه يهبط 12، ومساواتُهما
              كانت تجعل الكتلتين تتحرّكان بالقدر نفسه فتُقرآن طبقةً
              واحدة. الأصغرُ يتحرّك أكثر — تلك هي القاعدة التي تصنع العمق.
            */
            initial={
              isFirstIntro
                ? {
                    opacity: 0,
                    scale: still ? 1 : entranceContent.scale,
                    y: still ? 0 : entranceContent.y,
                  }
                : false
            }
            /*
              ولحظة المقاومة تسبق الرحلة كلّها: قبل أن يرتفع البطل يُدفع
              إلى الداخل قليلاً (‏y موجب صغير مع انضغاط 0.65%). جسمٌ يُقاوم
              ثم يستجيب — لا حالةٌ تُبدَّل بأخرى.
            */
            animate={{
              opacity: 1,
              scale: launching ? 1.06 : bracing ? ex.brace.scale : expanded ? 0.975 : 1,
              y: launching ? -6 : bracing ? ex.brace.y : expanded ? -12 : 0,
              marginInlineStart: labelAnchor,
              /*
               * **اللون المميّز هويّةٌ مستمرّة، لا خاصّيةُ عنصرٍ جديد.**
               *
               * كان يُكتب مباشرةً على السطر التعريفي — وهو عقدة تُولَد مع كل
               * تبدّل قسم. فالعقدة الجديدة تصل بلونها النهائي دفعةً واحدة،
               * والقديمة تخرج بلونها القديم: **تعاقبُ هويّتين** لا انتقالُ
               * هويّة واحدة. والبيئة كانت تستوفي اللون بالفعل (‏`tint` في
               * AmbientEnvironment)، فيسبقها البطل إلى لونه الجديد ويصل
               * الجوّ متأخّراً — تنافرٌ بين طرفَي الشيء نفسه.
               *
               * الآن يُستوفى `color` على **الحاوية الباقية** ويرثه السطر
               * التعريفي. فالوليد يقرأ اللون الجاري لحظةَ ولادته — أي يرثه
               * في منتصف رحلته بدل أن يبدأ هويّةً ثانية.
               *
               * (جُرّب متغيّر CSS أولاً فكتبه motion سلسلةَ `undefined`:
               *  المحرّك يحتاج قيمةً ابتدائية قابلة للتحليل ليستوفي، ولا
               *  يملكها لمتغيّرٍ لم يُعرَّف على العنصر. وخاصّية `color`
               *  قياسية، فالاستيفاء فيها مضمون — والوراثة تبلّغه للأبناء.)
               */
              color: m.accent,
            }}
            /*
              المحوران لا يستقرّان معاً (§15): الانضغاط ينتهي عند 440ms
              والارتفاع عند 520ms. الفارق 80ms لا يُرى حركةً منفصلة، لكنّ
              غيابه يُرى: نهايةٌ واحدة حادّة تفضح أنّ القيمتين تُقادان من
              مصدر واحد.
            */
            transition={{
              scale: {
                duration: launching ? 0.62 : bracing ? ex.brace.duration : ex.hero.duration,
                ease: [0.4, 0, 0.2, 1],
              },
              y: {
                duration: launching ? 0.62 : bracing ? ex.brace.duration : ex.hero.settle,
                ease: [0.4, 0, 0.2, 1],
              },
              /* ⑧ ثالثُ محورٍ بمدّةٍ ثالثة: الوجود يكتمل قبل الهندسة.
                 لا شيء في البطل يستقرّ مع شيء آخر فيه. */
              opacity: { duration: ex.hero.duration * 0.8, ease: MOTION.easing.enter },
              /* المحاذاة تتبع البلاطة بنابض الصفّ نفسه — عمودٌ واحد:
                 البلاطة، ثم اسمها، ثم بطلها. */
              marginInlineStart: springs.navigation,
              /* اللون يستوفي بإيقاع الجوّ نفسه، فيصل طرفا الهويّة معاً. */
              color: { duration: MOTION.duration.cinematic, ease: MOTION.easing.standard },
            }}
            /*
              منشأ التحوّل: **الزاوية الأقرب إلى البلاطة**، لا مركز البطل.
              في التخطيط العربي `100% 0%` هي أعلى اليمين — أي النقطة الواقعة
              مباشرةً تحت عمود البلاطة المركَّزة. فالنموّ والانضغاط يصدران
              من حيث يقف الأصل، لا من وسط جسمٍ قائمٍ بذاته.

              ولها أثر ثانٍ مقصود: عند التوسّع ينكمش البطل 2.5%، وبمنشأٍ
              علويّ يثبت العنوان في مكانه وينحسر ما تحته وحده — بدل أن
              ينزلق سطرا الهويّة معاً نحو المركز.
            */
            /*
              الوضوحُ من CSS لا من `motion` — والعلّةُ في `skk-sharpen`
              نفسِها: `motion` يحتفظ بآخر قيمةٍ حرّكها ويُعيد كتابتها،
              فما ملك `filter` مرّةً لا يتخلّى عنه. والحركةُ بلا
              `fill-mode` تنتهي فتُعيد الخاصّيةَ إلى العدم.
            */
            style={{
              transformOrigin: "100% 0%",
              ...(isFirstIntro && !still && !settled
                ? { animation: `skk-sharpen ${entranceContent.duration}s cubic-bezier(${entranceCurve.enter.join(",")})` }
                : null),
            }}
          >
            {/*
              ① الهويّة — ما هذا المكان.

              `initial` كان `false` مطلقاً، وهذا هو سبب انهيار المرحلة ⑦ في
              الإقلاع: الغلاف يُركَّب لحظةَ ولادة البطل، و`initial={false}`
              يُلغي حركةَ دخول أبنائه في أوّل تصيير — فيصل العنوان والوصف
              **دفعةً واحدة عند شفافية 1**. قِستُهما: كلاهما عند 1 في
              الإطار نفسه (‏1569ms)، بينما الجدول يقول 70ms ثم 130ms.
              التأخيرات كانت مكتوبةً ولا تُنفَّذ.

              وربطُه بالمقدّمة الأولى يحفظ السلوكين معاً: الكشف المتدرّج عند
              الإقلاع، وبلا إعادةِ عرضٍ عند العودة من قسم.
            */}
            <AnimatePresence mode="popLayout" initial={isFirstIntro}>
              <motion.div
                key={m.id}
                className="flex flex-col items-start"
                /*
                  **البطل يعترف باتّجاه التنقّل.**

                  موضع البطل ثابت على الشاشة، وليس ذلك خطأً: الصفّ ينزلق
                  ليُبقي البلاطة المركَّزة عند نقطة ارتساء واحدة، فلا
                  تتحرّك البلاطة ولا يتحرّك البطل المحاذي لها. قِسته —
                  يمين البطل عند 896 لكل الأقسام، مطابقاً يمين البلاطة.

                  لكنّ النتيجة أنّ التصفّح كان يبدو ساكناً في منطقة البطل:
                  النصّ يتبدّل صعوداً وهبوطاً بلا أيّ إحساس بجهة. واسمُ
                  القسم تحت الصفّ كان يعترف بالاتّجاه منذ البداية
                  (‏`x = direction × 6`) — فكان الطرفان يتكلّمان لغتين.

                  الآن يصل العنوان **من الجهة التي جئتَ منها** ويخرج
                  إليها: إزاحةٌ أفقية صغيرة تُعطي التصفّح جهةً بلا أن
                  تُزحزح العمود الذي يقف عليه.
                */
                initial={{ opacity: 0, y: chor.title.y, x: navDir * 10 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: -6, x: navDir * -10, transition: { duration: rushing ? 0 : 0.14, ease: MOTION.easing.exit } }}
                transition={scaleTransition({ duration: chor.title.duration, delay: chor.title.delay, ease: [0.22, 1, 0.36, 1] }, speed)}
              >
                {/*
                  بلا لونٍ خاص — **يرث** الهويّة الجارية من الحاوية الباقية.
                  العقدة تُستبدل مع كل قسم، واللون لا يُستبدل معها.
                */}
                <div className="text-sm font-black tracking-wide">
                  {m.tagline}
                </div>
                <motion.h1
                  /*
                    الحجم يتبع ارتفاع النافذة لا رقماً ثابتاً: على نافذة
                    بارتفاع 550px تسقط بطاقات الإجراءات تحت الحافّة. عند
                    64px من الارتفاع فأعلى يبقى المقاس المصمَّم كما هو،
                    وتحته ينكمش بدل أن يدفع ما بعده خارج المشهد.
                  */
                  /*
                    `text-white` صريحٌ لازم: الحاوية صارت تحمل لون الهويّة
                    وتورّثه، والعنوان ليس هويّةً لونية — هو الاسم، ووزنه
                    من حجمه وظلّه لا من لونه.
                  */
                  className="mt-1 font-black leading-[1.02] text-white"
                  style={{ fontSize: "clamp(34px, 6.1vh, 64px)" }}
                  /*
                    مادّة البطل تتطوّر مع الامتداد (§11).

                    كان الظلّ صنفاً ثابتاً من Tailwind: البطل يرتفع وينكمش
                    ويُعاد توازنه، وسطحه لا يعترف بشيء ممّا جرى. والآن يعمق
                    الظلّ ويهبط مركزه مع اتّساع الصفحة تحته — جسمٌ ارتفع عن
                    سطحٍ صار أبعد، لا نصٌّ غيّر لونه.

                    وملكيّة الخاصّية واحدة: نُزع الصنف من Tailwind بدل أن
                    يُترك يكتب `filter` بينما يكتبها motion سطرياً — وهو
                    تنازعٌ يُنتج وميضةَ إطارٍ عند أوّل تغيّر.
                  */
                  initial={false}
                  animate={{ filter: expanded ? ex.heroMaterial.deep : ex.heroMaterial.rest }}
                  transition={{ duration: ex.hero.settle, ease: MOTION.easing.enter }}
                >
                  {m.label}
                </motion.h1>
              </motion.div>
            </AnimatePresence>

            {/*
              ② الفعل — البوّابة.
              عنصرٌ **واحد يبقى**: يتغيّر مظهره وحالته ولا يُستبدل. البوّابة
              ثابتة والوجهة هي التي تتبدّل — ولهذا يبقى `enterRef` صالحاً.
            */}
            <motion.div
              className="mt-4 flex items-center gap-3"
              /*
                البوّابة **تنمو** من البطل ولا تظهر فيه.
                كانت تصل بالشفافية والإزاحة وحدهما — أي عنصرٌ رُكِّب في
                مكانه. الانتفاخ من 0.96 يجعلها تُقرأ امتداداً للجسم الذي
                يتوسّع فوقها، ومنشؤها منشؤه نفسه (الزاوية الأقرب للبلاطة).
              */
              initial={{ opacity: 0, y: chor.action.y, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              style={{ transformOrigin: "100% 50%" }}
              transition={scaleTransition({ duration: chor.action.duration, delay: chor.action.delay, ease: [0.22, 1, 0.36, 1] }, speed)}
            >
              <motion.button
                ref={enterRef}
                onClick={() => openModule(m)}
                disabled={!m.to}
                className="flex items-center gap-2.5 rounded-full px-10 py-3.5 text-lg font-black transition disabled:cursor-not-allowed"
                /*
                  الزرّ **لا يهيمن قبل الاستكشاف**.
                  قبل التوسّع هو دعوةٌ هادئة؛ وبعده — حين يكون المستخدم قد
                  رأى البطل والسياق — يكتسب وزنه الكامل. الالتزام يجب أن
                  يأتي بعد الفهم لا قبله.
                */
                animate={{
                  backgroundColor: !m.to
                    ? "rgba(255,255,255,0.10)"
                    : expanded ? "rgb(255,255,255)" : "rgba(255,255,255,0.86)",
                  color: m.to ? "rgb(15,23,42)" : "rgba(255,255,255,0.70)",
                  boxShadow: !m.to
                    ? "0 0 0 rgba(0,0,0,0)"
                    : expanded ? "0 14px 38px rgba(0,0,0,0.55)" : "0 6px 18px rgba(0,0,0,0.34)",
                  scale: m.to && expanded ? 1.015 : 1,
                }}
                transition={{ duration: ex.action.duration, delay: expanded ? ex.action.delay : 0, ease: MOTION.easing.standard }}
                style={{ border: m.to ? "1px solid transparent" : "1px solid rgba(255,255,255,0.25)" }}
                /* عمق الضغط من النظام لا رقماً مكتوباً هنا (كان 0.96). */
                whileTap={m.to ? { scale: MOTION.scale.press } : undefined}
              >
                <AnimatePresence mode="popLayout" initial={false}>
                  <motion.span
                    key={m.to ? "go" : "soon"}
                    className="flex items-center gap-2.5"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6, transition: { duration: 0.12 } }}
                    transition={{ duration: MOTION.duration.fast, ease: MOTION.easing.enter }}
                  >
                    {m.to ? <><span>▶</span> ابدأ الآن</> : "قريباً"}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
              {/*
                نصّ الإرشاد كان يصف عطلاً لا سلوكاً: «‏Enter ثم مسافة
                للدخول» — والمسافة كانت الحيلة الوحيدة الباقية لأنّ Enter
                معطَّل على الزرّ. وقد زال السبب، فيصف السطر الآن ما يفعله
                النظام فعلاً: Enter يستكشف، وEsc يرجع.
              */}
              <span className="hidden text-xs text-white/40 sm:inline">← → للتنقّل · Enter للاستكشاف · Esc للرجوع</span>
            </motion.div>

            {/* ③ التفاصيل — تنفتح من العنوان (ونفس علّة الغلاف أعلاه) */}
            <AnimatePresence mode="popLayout" initial={isFirstIntro}>
              <motion.p
                key={m.id}
                className="mt-4 max-w-xl text-[14px] leading-relaxed text-white/70"
                /* يتبع العنوان بجهته لا بمقداره: 6px مقابل 10 — فلا يصلان
                   معاً ولا ينزلقان ككتلة واحدة. */
                initial={{ opacity: 0, y: chor.desc.y, x: navDir * 6 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, x: navDir * -6, transition: { duration: rushing ? 0 : 0.12 } }}
                transition={scaleTransition({ duration: chor.desc.duration, delay: chor.desc.delay, ease: [0.22, 1, 0.36, 1] }, speed)}
              >
                {m.desc}
              </motion.p>
            </AnimatePresence>

            {/*
              ④ الحالة وحدها تبقى في البطل — سطرٌ واحد يجيب عن «هل هناك ما
              يستدعيني الآن؟». أمّا الأرقام والنشاط والفروع فانتقلت إلى
              منطقة السياق: المرحلة الثانية يجب أن تبقى **هادئة**، والتفصيل
              يأتي حين يطلبه المستخدم لا قبله.
            */}
            {/*
              سطر الحالة ينتقل إلى السياق عند انفتاحه ولا يُكرَّر.
              كان يظهر في الموضعين معاً — «923 منتج منتهي الصلاحية» مرّتين
              على شاشة واحدة. التكرار يُضعف الرسالة ويُشوّش التسلسل.
            */}
            {/*
              سطر الحالة **يُسلَّم ولا يُنتزَع**.

              كان شرطاً عارياً: يختفي من البطل في الإطار نفسه الذي يبدأ فيه
              التأكيد، ثم يظهر نظيرُه داخل السياق بعد 130ms. أي فجوةٌ يغيب
              فيها الجواب عن «هل هنا ما يستدعيني الآن؟» ثم يعود في مكان
              آخر — وهو **استبدالٌ** لا تسليم، ونقضٌ لـ«لا شيء يظهر ولا
              يختفي مستقلّاً».

              الآن ينسحب بتلاشٍ وإزاحةٍ صغيرة نحو الأعلى — أي **باتجاه
              السياق الذي يرث دوره** — بينما تمتدّ الصفحة تحته. فيُقرأ
              انتقالَ مسؤولية لا محوَ عنصر. ولا يُعطى دخولاً هنا: عودته عند
              الطيّ تتولّاها طبقات ContextStats الداخلية بتأخيرها المعروف.
            */}
            <AnimatePresence>
              {!expanded && (
                <motion.div
                  key="hero-status"
                  initial={false}
                  exit={{ opacity: 0, y: -5, transition: { duration: MOTION.duration.fast, ease: MOTION.easing.exit } }}
                >
                  <ContextStats moduleId={m.id} accent={m.accent} statusOnly />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
          )}

          {/*
            ⑤ منطقة السياق — تنمو من البطل داخل الرئيسية نفسها.

            هنا المرحلة التي كانت ناقصة. كان الطريق: تصفّح ← معاينة ← دخول.
            أي أنّ المستخدم لا يستطيع أن **يفهم** وجهةً قبل أن يلتزم بها.
            الآن بينهما مرحلةُ استكشاف: الرئيسية تمتدّ إلى أسفل فتكشف أرقام
            القسم ونشاطه وفروعه، والبطل باقٍ فوقها، والبلاطة ما زالت
            مركَّزة. لا انتقال ولا نافذة ولا طبقة فوق المشهد.

            محاذاتها تتبع البلاطة كما يتبعها البطل — العمود نفسه.
          */}
          <motion.div
            animate={{ marginInlineStart: labelAnchor }}
            initial={false}
            transition={springs.navigation}
          >
            {/*
              بلا `key` على القسم — وهذا مقصود بعد عطلٍ قِسته.

              كان `key={m.id}`، فصار تبدّلُ القسم وطيُّ السياق يقعان في
              التصيير نفسه: تبدأ اللوحة القديمة خروجها بمفتاحها القديم
              بينما تُركَّب الجديدة، فتتعايشان. والنتيجة لم تكن بصرية فقط —
              `[data-ctx-focus]` كان يجد **ستّة فروع بدل ثلاثة**، والنقر
              على أوّلها يأخذك إلى قسمٍ غادرتَه. (قِسته: وأنا في المخزون
              فتح لي المبيعات.)

              لوحة واحدة يتبدّل محتواها إذن، و`AnimatePresence` يتولّى
              الفتح والطيّ وحدهما. وتبدّلُ القسم أثناء التوسّع لا يقع أصلاً:
              السهم الأفقي يطوي قبل أن ينتقل.
            */}
            <AnimatePresence initial={false}>
              {/*
                `!bracing` هو ما يجعل المقاومة **سبباً** لا زينةً تجري
                بالتوازي: لا يُركَّب السياق ولا يبدأ ارتفاعه قبل أن ينتهي
                البطل من انضغاطه. فيُقرأ التسلسل: ضغطة ← جسمٌ قاوم ←
                صفحةٌ انفتحت. ولو تراكبا لعادت اللحظة إلى ما كانت عليه:
                نتيجةٌ تصل مع الإدخال بلا شيء بينهما.
              */}
              {expanded && !bracing && !launching && (
                <ContextPanel
                  mod={m}
                  onLaunch={(to) => launch(to, m.id)}
                  onCollapse={collapseContext}
                  /* السهم العلوي من أوّل فرع يعود إلى البوّابة، لا يصطدم بحائط. */
                  onExitTop={() => enterRef.current?.focus({ preventScroll: true })}
                />
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </div>

      {/* حجاب نهاية الدخول — يغطّي بلون القسم بعد اكتمال تمدّد الخلفية ثم يتمّ الانتقال */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          zIndex: LAYER.transition,
          /*
            مركز الحجاب عند منطقة البطل (يمين-أسفل في RTL) لا في وسط
            الشاشة: فيبدو أنّ القسم يتمدّد من المكان الذي كان يعاينه
            المستخدم، لا أنّ ستارة هبطت عليه.
          */
          background: `radial-gradient(circle at 78% 62%, ${m.from} 0%, ${m.via} 45%, ${m.end} 100%)`,
          opacity: launching ? 1 : 0,
          transform: launching ? "scale(1)" : "scale(1.06)",
          transition: "opacity 420ms ease-in, transform 620ms cubic-bezier(0.4,0,0.2,1)",
          transitionDelay: launching ? "880ms" : "0ms",
        }}
      />
    </div>
  );
}
