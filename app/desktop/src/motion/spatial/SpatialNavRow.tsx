import {
  useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode,
} from "react";
import {
  animate, motion, useMotionValue, useReducedMotion, useTransform,
} from "motion/react";

import { springs, geometry } from "./tokens";
import { railTravel } from "./rail-geometry";
import type { TileMetrics } from "./useTileMetrics";
import { FocusIndicator } from "./FocusIndicator";
import { useLayoutDirection } from "../direction";
import { LAYER } from "../layers";
import { railEntrance, type FocusFrameStage } from "../home-entrance";

/**
 * **العارض المكاني — إطارٌ ثابت وصفٌّ يمرّ تحته.**
 *
 * البنية، وهي كلُّ الموضوع:
 *
 *   NavigationViewport      (يقصّ، ونسبيّ، ويملك المرساة)
 *   ├── FocusFrame «اللوح»  ثابتٌ عند المرساة، تحت الصفّ
 *   ├── NavigationRail      `transform: translateX` وحده
 *   │   ├── NavigationItem
 *   │   └── …
 *   └── FocusFrame «الحافّة» ثابتٌ عند المرساة، فوق الصفّ
 *
 * الإطارُ **ليس ابناً لأيّ بلاطة**، ولا `layoutId` يحمله بينها. موضعُه
 * يُحسب من عرض العارض مرّةً، ولا يُكتب له انتقالٌ على الموضع أبداً.
 *
 * ## ما كان الخطأ
 *
 * ① الإطارُ كان يُركَّب داخل البلاطة المركَّزة وينتقل بـ`layoutId` — فهو
 *    المتحرّك، والصفُّ يساعده.
 *
 * ② الإزاحةُ كانت **مكبوحة**: `min(max(travel, 0), maxTravel)`. فعلى
 *    أوّل بلاطتين وآخر بلاطتين تُصفَّر الإزاحة ولا يتحرّك الصفُّ إطلاقاً،
 *    ويبقى الإطارُ وحده هو الذي يعبر. نموذجان متناقضان في شريطٍ واحد،
 *    والمستخدم يرى الثاني لأنّه الأظهر.
 *
 * ③ الهدفُ كان يُقاس من DOM (‏`offsetLeft`/`offsetWidth`) داخل
 *    `useLayoutEffect` — وعرضُ البلاطة **مقودٌ بـMotionValue**، أي أنّ
 *    `offsetWidth` يقرأ عرضاً في منتصف نابضٍ جارٍ. فالهدف يُلتقط من
 *    تخطيطٍ عابر ويخطئ بمقدار (‏focused − compact) في أسوأ الحالات.
 *    ومعه `ResizeObserver` على الصفّ نفسه — والصفُّ يتغيّر عرضُه في كل
 *    إطارٍ من الانتقال، فيُعاد الحسابُ وتُعاد عرضُ React ستّين مرّة في
 *    الثانية.
 *
 * ## ما صار
 *
 * الهدفُ **يُشتقّ هندسياً** لا يُقاس: عند الاستقرار كلُّ البلاطات
 * `compact` إلّا المركَّزة فهي `focused`، فمركزُ البلاطة رقم i من أوّل
 * الصفّ هو بالضبط:
 *
 *   center(i) = i · (compact + gap) + focused / 2
 *
 * ولا يُقرأ من DOM شيء. وأجملُ ما فيه أنّ **الاستيفاء الخطّي بين مركزين
 * متتاليين يطابق الهندسة الحقيقية تماماً** أثناء السفر: حين تكون الطاقة
 * في منتصف الطريق تتقاسم البلاطتان التمدّدَ (‏0.5 لكلٍّ منهما)، وحسابُ
 * مركز نقطة التركيز عندئذٍ يعطي القيمةَ نفسَها التي يعطيها استيفاءُ
 * الطرفين. فالصفُّ لا يتخلّف عن الإطار ولا يسبقه في أيّ لحظةٍ من الرحلة،
 * ولا يحتاج ذلك إلى مزامنةٍ ولا إلى قياس.
 *
 * وكلُّ ذلك على `MotionValue` — لا إعادةَ عرضٍ واحدة أثناء التنقّل.
 */
export function SpatialNavRow({
  activeIndex,
  metrics,
  rtl: rtlOverride,
  present = true,
  frameStage = "rim",
  arrivalKey,
  onAnchor,
  children,
  className,
}: {
  activeIndex: number;
  /** مقاسات الشريط — منها تُشتقّ الهندسة كلُّها بلا قياس DOM. */
  metrics: TileMetrics;
  /**
   * تجاوز اختياري. الافتراضي يُقرأ من اتجاه المستند فعلياً (§48/§35):
   * تثبيتُ `rtl` في نقطة الاستدعاء يجعل التنقّل ينعكس صامتاً يوم
   * تُفعَّل الفرنسية.
   */
  rtl?: boolean;
  /**
   * ② حضورُ الشريط — طبقةٌ واحدة، لا تسعُ عناصرَ تدخل بالدور.
   *
   * القيمةُ على **الصفّ نفسه** لا على أبنائه: هذا هو الفرق بين «شريطٌ
   * يحضر» و«أيقوناتٌ تظهر». والبلاطاتُ مقروءةٌ بنيةً قبله (‏0.7).
   */
  present?: boolean;
  /**
   * أين بلغ بناءُ الإطار — وهجٌ ثمّ زجاجٌ ثمّ حدّ (③④⑤ في جدول الدخول).
   *
   * حالةٌ متدرّجة لا عَلَمٌ ثنائي: العَلَمُ كان يُشعل الطبقات الثلاث في
   * لحظةٍ واحدة، فيُقرأ الإطارُ **يظهر** لا **يتشكّل**.
   */
  frameStage?: FocusFrameStage;
  /** يتغيّر عند كل وصول — وميضُ الحافّة. */
  arrivalKey?: string | number;
  /**
   * موضعُ حافّة الإطار من حافّة بداية القراءة (px).
   *
   * **وهو ثابتٌ الآن** — وهذا هو المكسب الثاني لتثبيت التركيز: كان
   * يتغيّر مع كل تنقّل، ومستهلكوه (اسمُ القسم، وعمودُ البطل، ولوحةُ
   * السياق) يستوفون إليه بـ`marginInlineStart` — أي **حركةُ تخطيطٍ**
   * على عمود المحتوى كلِّه في كل ضغطة سهم. صار عموداً واحداً لا يتزحزح،
   * والحركةُ كلُّها في الصفّ حيث ينبغي أن تكون.
   */
  onAnchor?: (x: number) => void;
  children: ReactNode;
  className?: string;
}) {
  const still = useReducedMotion();
  const dir = useLayoutDirection();
  const rtl = rtlOverride ?? dir === "rtl";

  const viewportRef = useRef<HTMLDivElement | null>(null);

  /**
   * عرضُ العارض — يُقاس عند التركيب وعند تغيّر حجم النافذة **فقط**.
   *
   * والمراقَبُ العارضُ وحده لا الصفّ: عرضُ الصفّ يتغيّر في كل إطارٍ من
   * الانتقال (البلاطات تتمدّد وتنكمش)، ومراقبتُه كانت تعني إعادةَ عرض
   * React مع كل إطار. أمّا العارضُ فلا يتغيّر إلّا بتغيّر النافذة.
   */
  const [vpWidth, setVpWidth] = useState(0);

  useLayoutEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const sync = () =>
      setVpWidth((prev) => {
        /*
         * **العرضُ الداخليّ وحده** — `clientWidth` ناقصَ الحشو.
         *
         * الأصلُ الذي تُقاس منه المرساة يجب أن يكون الأصلَ الذي يبدأ عنده
         * الصفُّ نفسُه، وإلّا انحرف الإطارُ عن البلاطة بمقدار الحشو. والصفُّ
         * ابنٌ عاديّ فيبدأ عند **صندوق المحتوى**، أمّا الطبقةُ المطلقة
         * فأصلُها صندوقُ الحشو — ولذلك تَرِث الطبقةُ حشوَ العارض أدناه،
         * فيتطابق الأصلان.
         */
        const cs = getComputedStyle(vp);
        const next =
          vp.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
        /* المقارنة قبل الضبط: تغييرُ الحجم يُطلق عشرات الأحداث المتطابقة. */
        return prev === next ? prev : next;
      });

    sync();

    const ro = new ResizeObserver(sync);
    ro.observe(vp);

    return () => ro.disconnect();
  }, []);

  /** مركزُ الإطار من حافّة بداية القراءة داخل صندوق المحتوى. */
  const anchor = vpWidth * geometry.focusAnchor;

  /** ② حضورُ الشريط — يُشتقّ من جدول الدخول ولا يُكتب هنا. */
  const rail = railEntrance(present, !!still);

  /**
   * موضعُ الصفّ — عددٌ كسريّ يقابل فهرس البلاطة الواقفة تحت الإطار.
   *
   * **ومسارُه خطّيٌّ لا حلقيّ**، بخلاف حقل الطاقة. والفرق مقصود: الطاقة
   * تقيس على حلقة (من آخر بلاطة إلى الأولى خطوةٌ واحدة) لأنّ ذلك يصف
   * **الجوار**، أمّا الصفُّ فجسمٌ ممتدٌّ له أوّلٌ وآخر — والالتفافُ فيه
   * رحلةٌ من طرفٍ إلى طرف، وهو ما يجب أن يُرى.
   */
  const railPos = useMotionValue(activeIndex);

  useEffect(() => {
    if (still) {
      railPos.set(activeIndex);
      return;
    }

    /*
     * **الزخم يُسلَّم يداً بيد** — كما في حقل الطاقة تماماً.
     *
     * `animate` يلتقط سرعةَ القيمة ضمنياً في الغالب، لكنّ ذلك يفترض أنّها
     * تغيّرت في الإطارين الأخيرين. وفي الضغط المتتابع السريع قد يقع
     * التوجيهُ في إطارٍ لم تُحدَّث فيه القيمة، فتُقرأ السرعةُ صفراً وتبدأ
     * الرحلةُ الجديدة من سكون — أي «إعادةُ تشغيل» في منتصف تدفّقٍ متّصل.
     *
     * وهذا أيضاً هو ما يجعل الحركة **قابلةً للمقاطعة** (§46/§48/§49): لا
     * طابورَ ولا وعود؛ هدفٌ واحدٌ يُعاد توجيهه من الموضع والسرعة
     * الحاليّين، ويُلغى السابقُ صراحةً في التنظيف.
     */
    const controls = animate(railPos, activeIndex, {
      ...springs.navigation,
      velocity: railPos.getVelocity(),
    });

    return () => controls.stop();
  }, [activeIndex, railPos, still]);

  /**
   * الإزاحة — **غير مكبوحة**.
   *
   * على البلاطة الأولى تصير سالبة، فيُدفع الصفُّ إلى الأمام ويبقى ما
   * قبلها فراغاً. وذلك هو السلوك المكاني الصحيح: لا شيءَ قبل الأولى،
   * فلا معنى لأن تُسحب إلى الحافّة ويُترك الإطارُ يذهب إليها.
   *
   * (وكبحُها هو ما كان يُنتج النموذجين المتناقضين — انظر ② أعلاه.)
   */
  const x = useTransform(railPos, (p) => {
    const travel = railTravel(p, metrics, anchor);
    return rtl ? travel : -travel;
  });

  /** حافّةُ البلاطة تحت الإطار — **ثابتة**، تُبلَّغ مرّةً لكلّ تغيّر مقاس. */
  const frameStart = anchor - metrics.focused / 2;
  /** كم يتجاوز الإطارُ البلاطةَ من كلّ جهة. */
  const frameOffset = metrics.focused * geometry.ringOffsetRatio;
  /** الصندوقُ الكامل للإطار. */
  const frameBox = metrics.focused + frameOffset * 2;

  useEffect(() => {
    if (vpWidth > 0) onAnchor?.(frameStart);
  }, [frameStart, vpWidth, onAnchor]);

  /**
   * صندوقُ الإطار — قيمُ تخطيطٍ ثابتة، لا شيءَ منها يُستوفى.
   *
   * `marginInlineStart` لا `left`: الموضعُ منطقيٌّ لا فيزيائيّ، فينعكس مع
   * اتّجاه المستند بلا رقمٍ يُكتب مرّتين (§35).
   */
  const frameShell = useMemo(
    () => ({
      width: frameBox,
      height: frameBox,
      marginInlineStart: anchor - frameBox / 2,
    }),
    [frameBox, anchor],
  );

  return (
    <div
      ref={viewportRef}
      /*
       * **قصٌّ بهامش، لا قصٌّ عند الحدّ.**
       *
       * `overflow: clip` مع `overflow-clip-margin` يُبقي القصَّ قائماً
       * لاحتواء الصفّ المنزلق، ويسمح للرسم بتجاوز الحدّ — فيأخذ توهّجُ
       * الإطار وظلُّه متنفَّسهما من الهامش لا من الحشو. و`clip` لا يُنشئ
       * حاوية تمرير كما يفعل `hidden`، فلا شريطَ تمريرٍ ولا تمريرٌ أفقيّ
       * للصفحة (§56/§38).
       *
       * و36px لا 24: توهّجُ اللوح يبلغ 26px (‏24 تمويهاً و2 انتشاراً)
       * وظلُّه 34px بإزاحةٍ 10 — أي 27px تحته. والهامشُ الأضيق كان يقصّ
       * طرفَ التوهّج قصّاً يُرى خطّاً.
       */
      className={`relative overflow-clip [overflow-clip-margin:36px] ${className ?? ""}`}
    >
      {/*
        ===== الإطار — اللوح (تحت الصفّ) =====

        `padding: inherit` هو ما يجعل هذه الطبقةَ المطلقة تشترك مع الصفّ في
        **صندوق المحتوى** نفسِه: أصلُها بلا ذلك صندوقُ الحشو، فينحرف الإطارُ
        عن البلاطة بمقدار الحشو أفقياً ورأسياً. و`items-center` يوسّطه على
        ارتفاع الصفّ الحقيقي.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center"
        style={{ padding: "inherit" }}
      >
        <div className="relative shrink-0" style={frameShell}>
          {/* ③ الوهج ثمّ ④ الزجاج — كلاهما تحت الصفّ. */}
          <FocusIndicator layer="glow" size={metrics.focused} stage={frameStage} />
          <FocusIndicator layer="plate" size={metrics.focused} stage={frameStage} />
        </div>
      </div>

      {/* ===== الصفّ ===== */}
      <motion.div
        /*
         * `justify-start` + `w-max`: الصفُّ يبدأ من حافّة القراءة ويمتدّ
         * بطبيعته، والإزاحةُ وحدها تحدّد ما يُرى منه. ولا `layout` عليه —
         * التخطيط لا يُحرَّك، `transform` فقط (§38).
         */
        className="flex w-max items-center justify-start"
        /*
         * حضورُ الشريط — قناةٌ واحدةٌ على طبقةٍ واحدة.
         *
         * `animate` لا `style`: القيمةُ تحتاج انتقالاً، و`x` أعلاه
         * MotionValue فلا يتنازعان (‏`motion` يجمع الاثنين على العنصر
         * نفسِه بلا تعارض — أحدهما هدفٌ يُستوفى والآخر قيمةٌ تُكتب).
         */
        initial={rail.initial}
        animate={rail.animate}
        transition={rail.transition}
        /*
         * **ارتفاعٌ ثابت — وهو شرطُ ثباتِ الإطار رأسياً.**
         *
         * ارتفاعُ الصفّ كان يُشتقّ من أطول بلاطةٍ فيه، وأطولُها يتغيّر
         * أثناء السفر: في منتصف الرحلة تتقاسم البلاطتان التمدّدَ فتصير كلٌّ
         * منهما `compact + Δ/2` — أي أنّ الصفَّ **ينكمش رأسياً ~22px ثمّ
         * يعود** في كلّ تنقّل. وذلك يزيح كلَّ ما تحته (اسم القسم، البطل،
         * السياق) إزاحةَ تخطيطٍ حقيقية، ويزيح الإطارَ الموسَّط معه — فيعود
         * الإطارُ إلى التحرّك من بابٍ خلفيّ.
         *
         * وبتثبيته على مقاس البلاطة المركَّزة يبقى صندوقُ المحتوى واحداً
         * مهما فعلت البلاطات داخله (§38).
         */
        style={{ gap: metrics.gap, height: metrics.focused, x }}
      >
        {children}
      </motion.div>

      {/* ===== الإطار — الحافّة (فوق الصفّ) ===== */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 flex items-center"
        style={{ padding: "inherit", zIndex: LAYER.navItemFocused + 1 }}
      >
        <div className="relative shrink-0" style={frameShell}>
          {/* ⑤ الحدُّ الأبيض — فوق الصفّ وحده، فلا يختفي تحت البلاطة. */}
          <FocusIndicator
            layer="rim"
            size={metrics.focused}
            stage={frameStage}
            arrivalKey={arrivalKey}
          />
        </div>
      </div>
    </div>
  );
}
