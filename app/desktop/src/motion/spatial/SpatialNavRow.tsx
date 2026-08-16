import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { motion, useReducedMotion } from "motion/react";
import { springs, geometry, reduced } from "./tokens";
import { useLayoutDirection } from "../direction";
import { useMotionSpeed, scaleTransition } from "../orchestrator";

/**
 * شريط التنقّل المكاني: يحمل العناصر وينزلق أفقياً كي تستقرّ البلاطة
 * المركَّز عليها قرب «مرساة التركيز».
 *
 * الانزلاق مكبوح ضمن حدود المحتوى: لا يُسمح بأن يترك فراغاً عند أيّ طرف.
 * لذلك حين يكون الصفّ أضيق من حاويته (كما هي الحال مع عدد أقسام قليل على
 * نافذة عريضة) تكون الإزاحة صفراً — وهذا هو السلوك الصحيح، لا نقص فيه:
 * تحريكه عندئذٍ كان سيفتح فجوة مرئية عند إحدى الحافّتين.
 *
 * الحركة نابضية عبر motion، فهي قابلة للمقاطعة بطبيعتها: تغيير الهدف
 * أثناء الحركة يعيد توجيهها من موضعها وسرعتها الحاليّين بلا قفز ولا صفّ انتظار.
 */
export function SpatialNavRow({
  activeIndex,
  itemCount,
  rtl: rtlOverride,
  onAnchor,
  children,
  gap,
  className,
}: {
  activeIndex: number;
  itemCount: number;
  /**
   * تجاوز اختياري. الافتراضي يُقرأ من اتجاه المستند فعلياً (§48): تثبيت
   * `rtl` في نقطة الاستدعاء يجعل التنقّل ينعكس صامتاً يوم تُفعَّل الفرنسية.
   */
  rtl?: boolean;
  /**
   * موضع استقرار حافّة البلاطة المركَّزة، بالبكسل من حافّة بداية القراءة.
   *
   * يُبلَّغ ولا يُحسَب في الخارج: الصفّ هو المالك الوحيد لهذه الهندسة
   * (الانزلاق، المرساة، الكبح عند الطرفين). أي طرف آخر يعيد اشتقاقها
   * سينحرف عنها أوّل مرّة تتغيّر فيها قاعدة الكبح — ولن يُنبّه أحد.
   *
   * مستهلِكه الأول: العنوان تحت الشريط، كي ينبثق من البلاطة لا من حافّة
   * الصفحة.
   */
  onAnchor?: (x: number) => void;
  children: ReactNode;
  /** الفجوة بين البلاطتين بالبكسل. */
  gap: number;
  className?: string;
}) {
  const still = useReducedMotion();
  const speed = useMotionSpeed();
  const dir = useLayoutDirection();
  const rtl = rtlOverride ?? dir === "rtl";
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const rowRef = useRef<HTMLDivElement | null>(null);
  /** الإزاحة باتجاه القراءة (موجبة دائماً)؛ الإشارة تُطبَّق عند العرض. */
  const [travel, setTravel] = useState(0);
  /** نسخة قابلة للقراءة داخل الحساب بلا إعادة تشغيل الأثر. */
  const travelRef = useRef(0);

  // يُعاد الحساب عند تبدّل التركيز أو تغيّر المقاسات (تغيير حجم النافذة).
  useLayoutEffect(() => {
    const compute = () => {
      const vp = viewportRef.current;
      const row = rowRef.current;
      if (!vp || !row) return;
      const items = Array.from(row.children) as HTMLElement[];
      const active = items[activeIndex];
      if (!active || items.length === 0) return;

      /*
       * تُحسب الإزاحة من قيم التخطيط (offsetLeft/offsetWidth) لا من
       * getBoundingClientRect: الأخير يعكس التحويل الجاري، فيصير الحساب
       * تزايدياً ويتراكم خطؤه مع كل خطوة حتى ينفلت. القيم هنا مطلقة
       * ولا تتأثّر بأيّ حركة جارية، فإعادة الحساب في منتصف الانتقال
       * تعطي الهدف نفسه — وهذا شرط إعادة التوجيه السليم.
       */
      const first = items[0];
      const startEdge = rtl ? first.offsetLeft + first.offsetWidth : first.offsetLeft;
      const centreFromStart = (el: HTMLElement) => {
        const c = el.offsetLeft + el.offsetWidth / 2;
        return rtl ? startEdge - c : c - startEdge;
      };

      const anchor = vp.clientWidth * geometry.focusAnchor;
      /*
       * السقف: يكفي أن تبلغ آخر بلاطة المرساة، ولا خطوة بعدها.
       * والأرضية صفر: تبقى البلاطة الأولى ملتصقة بحافة البداية بدل أن
       * تنفتح فجوة قبلها. (هذا هو سلوك الحافّتين الصحيح.)
       */
      const maxTravel = Math.max(0, centreFromStart(items[items.length - 1]) - anchor);
      const next = Math.min(Math.max(centreFromStart(active) - anchor, 0), maxTravel);
      travelRef.current = next;
      setTravel(next);

      /*
       * حافّة البلاطة المركَّزة بعد الاستقرار: مركزها ناقصَ نصف عرضها،
       * ناقصَ ما سينزلقه الصفّ. تُحسب من مقادير التخطيط لا من
       * `getBoundingClientRect`، فهي موضع **الوصول** لا الموضع اللحظي
       * أثناء الانزلاق — وهذا ما يحتاجه من يتبعها كي لا يطاردها طوال
       * الرحلة ثم يلحق بها متأخّراً.
       */
      onAnchor?.(Math.max(0, centreFromStart(active) - active.offsetWidth / 2 - next));
    };

    compute();
    const ro = new ResizeObserver(compute);
    if (viewportRef.current) ro.observe(viewportRef.current);
    if (rowRef.current) ro.observe(rowRef.current);
    window.addEventListener("resize", compute);
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); };
  }, [activeIndex, itemCount, rtl, onAnchor]);

  return (
    <div
      ref={viewportRef}
      /*
       * **قصٌّ بهامش، لا قصٌّ عند الحدّ.**
       *
       * كان `overflow-hidden` يقصّ عند حدّ صندوق الحشو بالضبط، فصار الحشو
       * السفلي يخدم غرضين متنازعين: متنفَّس حلقة التركيز (تمتدّ 3.9px خارج
       * البلاطة وتحمل توهّجاً يبلغ 1.035) **و** موضع اسم القسم تحته. فكلّما
       * شُدَّ ليقترب الاسم، قُصَّت الحلقة — وهذا ما رآه المستخدم.
       *
       * `overflow: clip` مع `overflow-clip-margin` يفصل الغرضين: القصّ يبقى
       * قائماً لاحتواء الصفّ المنزلق، لكنّه يسمح للرسم بتجاوز الحدّ. فتأخذ
       * الحلقة متنفَّسها من الهامش لا من الحشو، ويعود الحشو ليخدم موضع
       * الاسم وحده.
       *
       * **٢٤px مقيسة لا مقدَّرة.** قدّرتُ الحاجة أوّلاً بـ5px (الإزاحة
       * الساكنة 3.9px زائدَ توهّج الوصول)، فأخطأت: أخذُ عيّنة كل 25ms طوال
       * رحلة انتقالٍ كاملة أظهر ذروةً عند **13.4px** — لأنّ الحلقة تنتقل
       * بـ`layoutId` بين مقاسين (‏68px ↔ 48px) فتتمدّد في منتصف الرحلة.
       * وذاك التجاوز هو ما كان يُقصّ. والباقي احتياطٌ لقفزةٍ أطول من خطوة.
       *
       * (‏`clip` لا يُنشئ حاوية تمرير كما يفعل `hidden` — فرقٌ إضافي في
       *  مصلحتنا: لا محاور تمرير مخفيّة تُنشأ بلا داعٍ.)
       */
      className={`relative overflow-clip [overflow-clip-margin:24px] ${className ?? ""}`}
    >
      <motion.div
        ref={rowRef}
        /*
         * **البلاطات متمركزة رأسياً، لا محاذاة من الأعلى.**
         *
         * كان `align-items` على قيمته الافتراضية (‏stretch)، فتتمدّد أغلفة
         * البلاطات إلى ارتفاع الصفّ ويجلس زرّ كلٍّ منها في **أعلى** غلافه.
         * والنتيجة أنّ البلاطة المركَّزة (‏68px) والصغيرة (‏48px) تشتركان في
         * الحافّة العليا، فيبقى تحت الصغيرة فراغٌ قدره 20px.
         *
         * وذلك الفراغ هو ما يجعل اسم القسم يبدو بعيداً: السطر يقع **بجانب**
         * المركَّزة أي تحت الصغيرات، فالفجوة التي تراها العين 24px لا 4px.
         *
         * والمرجع يمركزها: قياسُ لقطة الكونسول يعطي مركز البلاطة المركَّزة
         * 36 ومركز الصغيرة 37 — أي متطابقين. فالتمركز يقرّب قاع الصغيرة من
         * قاع الكبيرة ويسحب السطر إلى موضعه الصحيح.
         */
        className="flex w-max items-center justify-start"
        /* الإزاحة المحسوبة معروضة للفحص — الحركة نفسها يقودها النابض */
        data-travel={Math.round(travel)}
        style={{ gap }}
        animate={{ x: rtl ? travel : -travel }}
        transition={scaleTransition(still ? reduced.transition : springs.navigation, speed)}
      >
        {children}
      </motion.div>
    </div>
  );
}
