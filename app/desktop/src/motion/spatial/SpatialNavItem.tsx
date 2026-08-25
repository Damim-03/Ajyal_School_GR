import { motion, useReducedMotion, useTransform, type MotionValue } from "motion/react";
import type { ReactNode } from "react";
import { springs, geometry, depth, reduced, neighbor } from "./tokens";
import type { TileMetrics } from "./useTileMetrics";
import {
  tileSurface, SWEEP, SHEEN_PARALLAX, HALO_PARALLAX, ICON_MATERIAL,
  BASE_MATERIAL, SURFACE_LIGHT, SURFACE_LIFT, INNER_EDGE,
  SHADOW_REST, SHADOW_LIFT, AMBIENT_HALO, REFLECTION,
} from "./material";
import { LAYER } from "../layers";
import { focusEnergy, energyResponse, ringDistance, shortestDelta } from "../energy";
import { useMotionSpeed, scaleTransition, useRushing } from "../orchestrator";
import { useCameraLayer, CAMERA_RANGE } from "../camera";

/**
 * بلاطة واحدة في شريط التنقّل المكاني — جسمٌ مادّي لا زرّ.
 *
 * أربعة مبادئ تحكم هذا الملف:
 *
 * ① **الحاوية تتغيّر هندسياً، لا بـ`transform: scale`.** عرضٌ وارتفاعٌ
 *    فعليّان في التخطيط تحرّكهما `layout` عبر FLIP. ولأن الحجم يغيّر
 *    التخطيط حقاً، تتزحزح البلاطات المجاورة من تلقاء نفسها — المساحة
 *    التي تحرّرها المنكمشة هي التي تستهلكها المتمدّدة. لا إزاحات يدوية
 *    ولا احتمال تراكب.
 *
 * ② **كل استجابة بصرية مشتقّة من شدّة واحدة متّصلة** يملكها material.ts.
 *    لا `selected ? كذا : كذا` لأي خاصّية مادّية — ولذلك تستجيب البلاطة
 *    التي تمرّ الطاقة فوقها بسطحها وظلّها وانعكاسها، لا بشفافيتها وحدها.
 *
 * ③ **لا شيء يظهر ولا شيء يختفي.** كل الطبقات موجودة دائماً، وشفافيتها
 *    هي التي تُستوفى. عنصرٌ يُركَّب عند التركيز يومض مهما نعُمت حركته.
 *
 * ④ **الرسم ساكن والتركيب متحرّك.** الظلال والتدرّجات مكتوبة مرّة، ولا
 *    يتحرّك منها إلا الشفافية والتحويل — وكلاهما يعمل على المعالج الرسومي
 *    بلا إعادة رسم.
 *
 * الكتابة كلّها عبر MotionValue في `style`، أي خارج شجرة React: سفر
 * الطاقة عبر تسع بلاطات لا يكلّف إعادة عرض واحدة.
 */
export interface SpatialNavItemProps {
  /**
   * الحالة المؤكَّدة: هذه البلاطة هي سياق الشاشة الآن.
   * تحكم **الهندسة والسلوك** فقط (الحجم، النقر، الدلالة) — لا المادّة.
   */
  selected: boolean;
  /** موضع هذه البلاطة في الصفّ. */
  index: number;
  /** عدد البلاطات — تُقاس به المسافة على حلقة. */
  count: number;
  /**
   * موضع طاقة التركيز على الصفّ — عدد **كسري** ينزلق بين البلاطات.
   * منه تُشتقّ شدّة هذه البلاطة، فتستجيب للطاقة المارّة لا للوصول فقط.
   */
  field: MotionValue<number>;
  /** يتغيّر عند كل وصول — يُعيد تشغيل الانعكاس المسافر. */
  arrivalKey?: string | number;
  /** مقاسات الشريط بالبكسل — الحجم مقودٌ بالطاقة فلا يقبل سلاسل CSS. */
  metrics: TileMetrics;
  onSelect: () => void;
  onActivate: () => void;
  /** استكشاف بالمؤشّر — **ليس** تركيزاً. يُبلَّغ ولا يحرّك التنقّل. */
  onHover?: (hovering: boolean) => void;
  /**
   * إشارة الاتجاه الفيزيائي لدفع الجيران: ‎+1 حين يكون تزايد الفهرس
   * يميناً على الشاشة، و‎-1 حين يكون يساراً (العربية).
   *
   * تُمرَّر ولا تُقرأ هنا: قراءتها في كل بلاطة تعني مراقب تحوّلات لكل
   * عنصر في الصفّ، تسعةً لمعلومةٍ واحدة يملكها الأب أصلاً.
   */
  pushSign?: number;
  label: string;
  children: ReactNode;
  badge?: ReactNode;
  /** تدرّج القسم — يُوضع فوق المادّة الأساس وتُستوفى شفافيته. */
  background: { selected: string; idle: string };
  className?: string;
}

export function SpatialNavItem({
  selected, index, count, field, arrivalKey, metrics,
  onSelect, onActivate, onHover, pushSign = 1,
  label, children, badge, background, className,
}: SpatialNavItemProps) {
  const still = useReducedMotion();
  const speed = useMotionSpeed();
  /** المستخدم يندفع عبر الصفّ — تُسقَط زخرفة الوصول لا استجابته. */
  const rushing = useRushing();
  /*
   * الكاميرا تُحرّك **الانعكاس وحده**، لا البلاطة.
   *
   * تنبيه موثَّق: تحريك الواجهة مع المؤشّر جُرّب سابقاً في هذا المشروع
   * وقِيس انجرافه (19px في الشريط) فأُزيل — الكاشير يحرّك فأرته طوال
   * اليوم، وواجهةٌ تتموّج تحته تشويشٌ لا عمق. لكنّ **الانعكاس** حالة
   * أخرى: السطح ثابت والضوء المنعكس عليه يتحرّك، وهذا الفرق بالذات هو
   * ما يقرأه الدماغ ضوءاً معلَّقاً بالعالم لا مرسوماً على الشاشة.
   */
  const cam = useCameraLayer("focus");
  /*
   * عمقٌ ثانٍ للكاميرا — **الهالة تنتمي إلى العالم لا إلى البلاطة**.
   *
   * الانعكاس يقرأ عمق الواجهة (الأقرب، فيزحف بوضوح)، والهالة تقرأ عمق
   * الخلفية (الأبعد، فتكاد لا تنجرف). وفرق السرعة بينهما — لا حركة أيّهما
   * على حدة — هو ما يولّد المسافة بين طبقة وأخرى داخل الجسم الواحد.
   */
  const camWorld = useCameraLayer("background");

  /** شدّة التركيز على هذه البلاطة الآن — أصل كل ما تحتها. */
  const i = useTransform(field, (p) => focusEnergy(ringDistance(index, p, count)));

  /*
   * الهندسة مقودة بالشدّة مباشرةً — آخر خاصّية كانت ما زالت ثنائية.
   *
   * كان الحجم `selected ? كذا : كذا` ويتولّى FLIP جسر القيمتين. وكان لذلك
   * ثمنان:
   *
   *   • بصرياً: البلاطة التي تمرّ الطاقة فوقها تستجيب بسطحها وظلّها
   *     وانعكاسها ولا تستجيب **بحجمها** — نصفٌ متّصل ونصفٌ ينتظر مفتاحاً.
   *   • أدائياً: FLIP يقيس كل عنصر يحمل `layout` مرّتين في كل تنقّل. قِسته:
   *     240ms من حجب الخيط لكل تنقّل، أي أنّ إمساك السهم يُغرق الإطار.
   *     ومنها 122ms للرمز وحده — لأنّه لا يملأ أباه فيحتاج تصحيحاً.
   *
   * بقيادة الشدّة يزول السببان معاً: الحجم يصير متّصلاً كبقية المادّة،
   * والرمز يبقى بمقاسه الثابت فلا يحتاج تصحيحاً أصلاً. والجيران يعيدون
   * توزيع أنفسهم كما كانوا — الصفّ مرن وعرضه الكلّي ثابت.
   */
  /*
   * الحجم يتبع **مسافته عن الطاقة** لا شدّتها.
   *
   * الفرق ضروري: شدّة الطاقة تمتدّ ثلاث بلاطات (‏1 / 0.6 / 0.28) وهذا
   * صحيح للضوء والظلّ — أمّا الحجم فلا. قِستُ الأثر: الجيران صاروا
   * 62/60/55px بدل 48، فتحوّل الصفّ من «واحدة متمدّدة وثمانٍ مضغوطة» إلى
   * تدرّجٍ ليّن — وهو غير الشكل المضبوط بالقياس في الفصول السابقة.
   *
   * الانحدار هنا خطّي على **بلاطة واحدة**: عند البلاطة 1، وصفر عند
   * البلاطة المجاورة فما بعد. وأثناء السفر تتقاسم البلاطتان المتجاورتان
   * الزيادة (0.5 و0.5)، فمجموع عرض الصفّ ثابت دائماً — لا الجيران يقفزون
   * ولا الفجوات تتزحزح.
   */
  const grow = useTransform(field, (p) =>
    Math.max(0, 1 - ringDistance(index, p, count)),
  );
  const px = useTransform(grow, (g) => metrics.compact + (metrics.focused - metrics.compact) * g);
  const radius = useTransform(px, (w) => w * geometry.radiusRatio);

  /*
   * الإزاحة المرنة — الجيران يفسحون للثقل.
   *
   * تُشتقّ من **الحقل نفسه** لا من حالة مستقلّة، فتسافر معه: البلاطة التي
   * تغادرها الطاقة تسترخي عائدةً إلى موضعها بينما تُدفَع القادمةُ جيرانُها.
   * لا مفتاح ولا حدث — إزاحةٌ متّصلة دالّةٌ في بُعدٍ كسريّ.
   *
   * الإزاحة **موقّعة** بأقصر مسار على الحلقة: من الطرف إلى الطرف خطوة
   * واحدة، فلا ينقلب اتجاه الدفع عند الالتفاف.
   */
  const push = useTransform(field, (p) => {
    if (still) return 0;
    const d = shortestDelta(p, index, count);
    const a = Math.abs(d);
    if (a < 0.0001 || a >= neighbor.reach) return 0;
    /* الذروة عند الجار المباشر، ثم انحسار خطّي إلى المدى. */
    const shape = a <= 1 ? a : Math.max(0, (neighbor.reach - a) / (neighbor.reach - 1));
    return Math.sign(d) * pushSign * neighbor.push * shape;
  });

  /* الوزن البصري العامّ: شفافية وسطوع وضبابية ووضوح الشارة. */
  const opacity = useTransform(i, (v) => energyResponse(v).opacity);
  /*
   * مرشّح لونيّ محض — بلا التفاف.
   *
   * كان هنا `blur()` إلى جانب السطوع. وإسقاطه يحوّل هذا المرشّح من تمريرة
   * تحتاج نسيجاً وسيطاً ونواةَ التفافٍ لكل بلاطة، إلى مصفوفة لونية تُطبَّق
   * أثناء التركيب. الفارق كلّه على الثماني غير المركَّزة، وهي التي تتغيّر
   * قيمتها طوال التنقّل.
   *
   * وانضمّ إليه `saturate` — وهو من الفصيلة نفسِها: يُدمج مع السطوع في
   * **مصفوفةٍ واحدة**، فالقناتان بكلفة قناة. وهو يعطي للصفّ عمقاً لا
   * تعطيه الشفافيةُ وحدها: البعيدُ يخفت لونُه كما يخفت في الهواء.
   */
  const filter = useTransform(i, (v) => {
    const r = energyResponse(v);
    return `brightness(${r.brightness}) saturate(${r.saturation})`;
  });
  const badgeOpacity = useTransform(i, (v) => energyResponse(v).badge);

  /* المادّة — تسعة مخارج من مدخل واحد، كلّها شفافيات وتحويلات. */
  const tint = useTransform(i, (v) => tileSurface(v).tint);
  const edge = useTransform(i, (v) => tileSurface(v).edge);
  const shadowLift = useTransform(i, (v) => tileSurface(v).shadowLift);
  const innerLight = useTransform(i, (v) => tileSurface(v).innerLight);
  const lift = useTransform(i, (v) => tileSurface(v).lift);
  const reflection = useTransform(i, (v) => tileSurface(v).reflection);
  const halo = useTransform(i, (v) => tileSurface(v).halo);
  const haloScale = useTransform(i, (v) => tileSurface(v).haloScale);
  const iconScale = useTransform(i, (v) => tileSurface(v).iconScale);
  const iconLift = useTransform(i, (v) => tileSurface(v).iconLift);

  /* موضع الانعكاس = استجابة الشدّة + انجراف الكاميرا. */
  const sheenX = useTransform(
    [i, cam.x] as const,
    /* إزاحة الكاميرا بالبكسل؛ تُعيَّر على مداها قبل أن تصير نسبة. */
    ([iv, cx]: number[]) =>
      `${tileSurface(iv).sheen + (cx / CAMERA_RANGE) * SHEEN_PARALLAX}%`,
  );

  /** انجراف الهالة مع العالم — بالبكسل، وبعمق الخلفية لا الواجهة. */
  const haloX = useTransform(camWorld.x, (v) => v * HALO_PARALLAX);
  const haloY = useTransform(camWorld.y, (v) => v * HALO_PARALLAX);

  /** انتقال الهندسة وحدها — الباقي مقود بالحقل مباشرةً. */
  const morph = scaleTransition(still ? reduced.transition : springs.tile, speed);

  return (
    <motion.button
      type="button"
      onClick={() => (selected ? onActivate() : onSelect())}
      /*
        التحويم ≠ التركيز. المؤشّر يمرّ فوق بلاطات كثيرة في طريقه إلى
        واحدة؛ لو حرّك التركيز لتبدّل العالم عشر مرّات في ثانية.
        الفضول يُبلَّغ، والنيّة تُطلب بالنقر.
      */
      onPointerEnter={onHover ? () => onHover(true) : undefined}
      onPointerLeave={onHover ? () => onHover(false) : undefined}
      title={label}
      /*
       * **الدلالةُ لا يحملها الإطار** (§36).
       *
       * الإطارُ زخرفيٌّ (`aria-hidden` و`pointer-events: none`) ولا يقع
       * داخل البلاطة أصلاً، فلا شيء في شجرة الوصول يقول أيُّ قسمٍ هو
       * الحالي. و`aria-current` يقوله صراحةً لقارئ الشاشة بلا اعتمادٍ
       * على ما يُرى.
       *
       * و`aria-label` لا `title` وحده: التلميحُ لا يُقرأ في كلّ الحالات،
       * والاسمُ هنا هو المحتوى الوحيد (الرمز مجرَّد).
       */
      aria-label={label}
      aria-current={selected ? "true" : undefined}
      data-spatial-item={selected ? "selected" : "idle"}
      className={`relative block shrink-0 outline-none ${className ?? ""}`}
      /*
       * الحجم والاستدارة قيمتان عدديتان مقودتان بالحقل — لا سلاسل CSS.
       * (تمرير `calc(clamp(...))` إلى `animate` كان يجعل العنصر بعرض صفر:
       *  عطلٌ وقعتُ فيه، ومنه جاء استعمال FLIP أصلاً.)
       */
      style={{
        width: px,
        height: px,
        borderRadius: radius,
        opacity,
        filter,
        /* الإزاحة المرنة — تحويل محض، لا تمسّ التخطيط ولا قياس المرساة. */
        x: push,
      }}
      /* الفضول: ارتفاع طفيف جداً، ولا يُطبَّق على المركَّزة (لها حالتها). */
      whileHover={still || selected ? undefined : { scale: depth.hoverScale }}
      /* الضغط: انضغاط صغير ثم رِجعة تؤكّد أنّ الجسم عاد بنفسه. */
      whileTap={{ scale: depth.pressScale }}
      /*
        التحويم والضغط كانا بلا انتقال معلن، فيسقطان على نابض motion
        الافتراضي — أي **مكوّن يخترع فيزياءه الخاصّة**، وهو ما تمنعه لغة
        الحركة الموحّدة. الآن يشتركان مع كل أزرار التطبيق في نابض الإفلات
        نفسه، فيرتدّان بالقدر نفسه ويستقرّان في الزمن نفسه.

        (لا يمسّ هذا قيَم `style` أعلاه: تلك تُقاد بـMotionValue مباشرةً
         ولا تمرّ بانتقال.)
      */
      transition={springs.press}
    >
      {/*
        ⑦ الهالة البيئية — تخصّ العالم لا البلاطة.
        نصف قطر كبير وشفافية شديدة الانخفاض؛ إن لُوحظت كضوء فهي قوية
        زيادة. بلا `filter: blur` — التدرّج الشعاعي ضبابيٌّ بطبيعته،
        والمرشّح كان تمريرة رسم إضافية على تسع بلاطات بلا مقابل.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          inset: "-34%",
          zIndex: LAYER.beneath,
          background: AMBIENT_HALO,
          opacity: halo,
          scale: haloScale,
          /* تنجرف مع العالم بينما تثبت البلاطة فوقها — فتحجب منها موضعاً
             مختلفاً كلّما تحرّك المشهد. */
          x: haloX,
          y: haloY,
        }}
      />

      {/*
        ⑤⑥ الظلّان.
        ساكنان تماماً ويتقاطعان بالشفافية: ظلّ الراحة دائم تحته، وظلّ
        الارتفاع يعلوه مع الطاقة. هكذا يتغيّر الظلّ بلا إعادة رسمه — وهو
        أغلى ما يُرسَم، وكان يُبنى من جديد كل إطار.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", boxShadow: SHADOW_REST }}
        transition={morph}
      />
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", boxShadow: SHADOW_LIFT, opacity: shadowLift }}
        transition={morph}
      />

      {/*
        ① المادّة الأساس — تدرّج ناعم لا لون مسطّح.
        `layout` عليها ضروري: بدونه يشوّهها تحويل FLIP الخاص بالأب فتبدو
        الاستدارة ممطوطة أثناء التمدّد.
      */}
      <motion.span
        className="absolute inset-0"
        style={{ borderRadius: "inherit", background: BASE_MATERIAL }}
        transition={morph}
      />

      {/*
        تدرّج القسم فوقها، تُستوفى شفافيته.
        طبقتان لا تبديلُ سلسلة: التدرّج واللون المسطّح لا يستوفي أحدهما
        إلى الآخر، فتبديلهما قفزةٌ مهما نعُم الانتقال حولها.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", background: background.selected, opacity: tint }}
        transition={morph}
      />

      {/*
        ② استجابة السطح للضوء: الحافّة العليا أفتح والسفلى أغمق.
        هذا وحده ما يحوّل السطح من مستطيل ملوّن إلى مادّة لها حجم — بلا أي
        وهج مضاف. وهو حاضر عند الراحة أيضاً (0.35) فالبلاطة الهادئة جسمٌ
        لا مساحة.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", background: SURFACE_LIGHT, opacity: innerLight }}
        transition={morph}
      />

      {/*
        ③ إضاءة السطح — الأثر الأقوى.
        القياس على المرجع: سطح البلاطة الهادئة عند 30 والمركَّزة عند 66،
        أي أنّ **السطح نفسه يُضاء** لا أنّ ضوءاً ينتشر حوله.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", background: SURFACE_LIFT, opacity: lift }}
        transition={morph}
      />

      {/*
        ④ ضوء الحافّة الداخلي — يصف سُمكاً، لا يرسم حدّاً.
        كان هنا حدٌّ أبيض حقيقي (`border: 1px solid`)، وهو ما يُرفض: الحدّ
        يُقرأ خطاً حول شكل، لا حافّةً تلتقط ضوءاً.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ borderRadius: "inherit", boxShadow: INNER_EDGE, opacity: edge }}
        transition={morph}
      />

      {/*
        ⑧ الانعكاس الدائم — موضعه يتبع الشدّة **وانجراف الكاميرا**.
        السطح ثابت والضوء عليه يتحرّك؛ هذا الفارق هو ما يُقرأ انعكاساً.
      */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
        style={{ borderRadius: "inherit", opacity: reflection }}
      >
        <motion.span
          className="absolute"
          style={{ inset: "-40%", background: REFLECTION, x: sheenX }}
        />

        {/*
          ⑨ الانعكاس المسافر — **حدث** يقع مرّة عند وصول الطاقة.
          يبدأ قرب حافّة، يعبر السطح، تخفت شدّته، يزول. بدونه يقف الانعكاس
          عند حافّته ما دامت البلاطة مركَّزة، وسكونُه يفضح أنّه طبقة موضوعة
          لا ضوء منعكس.
        */}
        {/*
          الانعكاس المسافر **حدث وصول**، فلا يُطلَق إلا حين يقع وصولٌ فعلي.

          كان مفتاحه `arrivalKey` وحده، أي أنّه يُعاد تركيبه عند كل خطوة.
          وفي الضغط المتتابع السريع يعني ذلك رحلةً تبدأ ثمّ تُقتل قبل أن
          تُرى، ستّ مرّات في الثانية — وهي حرفياً «إعادة تشغيل الحركة أثناء
          التنقّل السريع»، أحد معايير الرفض المعلنة.

          فيُسقَط أثناء الاندفاع ويُطلَق مرّةً واحدة عند الاستقرار الأخير:
          تُسقَط الزخرفة، ولا تُمسّ الاستجابة (المادّة والحجم والظلّ تواصل
          اشتقاقها من الحقل بلا انقطاع).
        */}
        {selected && !still && !rushing && (
          <motion.span
            key={arrivalKey}
            className="absolute"
            style={{ inset: "-40%", background: REFLECTION }}
            initial={{ x: SWEEP.from, opacity: 0 }}
            animate={{ x: SWEEP.to, opacity: [...SWEEP.opacity] }}
            transition={scaleTransition({ duration: SWEEP.duration, ease: [...SWEEP.ease] }, speed)}
          />
        )}
      </motion.span>

      {/*
        الرمز مفصول عن الحاوية: هي تتمدّد 42%، وهو يكبر 6% ويرتفع 1.5px —
        ومنحناه أبطأ، فيُقرأ تابعاً لا مرافقاً. `layout` عليه يلغي تشوّه
        الأب ويمنع أي قفزة عند تغيّر الأبعاد.
      */}
      {/*
        الرمز بلا `layout` — ولم يعد يحتاجه.
        كان الأب يتمدّد بتحويل FLIP فيسحب الرمز معه 42%، فيلزم تصحيحٌ كلفتُه
        المقيسة 122ms لكل تنقّل. والآن الأب يتمدّد **بتخطيطه الحقيقي**،
        والرمز ابنٌ مطلق الموضع بمقاس ثابت — فيبقى في مركزه بلا أن يمسّه
        شيء. يكبر 6% ويرتفع 1.5px بمنحناه البطيء وحده.
      */}
      <motion.span
        className="absolute inset-0 m-auto grid place-items-center"
        style={{
          width: metrics.icon,
          height: metrics.icon,
          scale: iconScale,
          y: iconLift,
          /* ظلّ تماسٍ ساكن: يُرسم مرّة ثم تُحوَّل الطبقة، فلا يكلّف إطاراً. */
          filter: ICON_MATERIAL,
        }}
        transition={scaleTransition(still ? reduced.transition : springs.icon, speed)}
      >
        {children}
      </motion.span>

      {/*
        الشارات فوق البلاطات الهادئة تصنع ضجيجاً بصرياً حين تتساوى كلّها
        في الوضوح. تخبو مع البعد أسرع من البلاطة نفسها، فيبقى ما حول
        التركيز مقروءاً ويهدأ ما بَعُد.
      */}
      {badge && (
        <motion.span
          className="pointer-events-none absolute inset-0"
          style={{ opacity: badgeOpacity }}
        >
          {badge}
        </motion.span>
      )}
    </motion.button>
  );
}
