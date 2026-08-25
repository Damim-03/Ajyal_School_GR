import { useEffect } from "react";
import { animate, motion, useReducedMotion, useTransform, useMotionValue, type MotionValue } from "motion/react";
import { MOTION } from "../../motion/system";
import { expansion as ex } from "../../motion/spatial";
import { useCameraLayer, useIdle } from "../../motion/camera";

/**
 * AmbientEnvironment — الطبقات الجوّية الدائمة للمشهد.
 *
 * المبدأ (وهو جوهر الإحساس بأن التطبيق «مكان» لا «صفحات»): هذه الطبقات
 * تُركَّب مرّة واحدة ولا تُعاد أبداً عند تبدّل القسم. ما يتبدّل هو **لون**
 * الضوء لا دورته: الحلقات تواصل تنفّسها من حيث هي بينما تنزلق الألوان
 * نحو لون القسم الجديد.
 *
 * بنية كل طبقة على مستويين، وهذا ليس تزيّداً:
 *   الخارجي  → إزاحة الكاميرا (transform يكتبه motion)
 *   الداخلي  → دورة التنفّس  (transform تكتبه حركة CSS)
 * لو اجتمعا على عنصر واحد لتغلّبت حركة CSS على النمط السطري وأُلغي
 * التوازي تماماً — عطل صامت لا يظهر إلا بالفحص.
 *
 * المدد أعداد أوّلية (17s / 23s / 29s) فلا تلتقي دوراتها إلا بعد ساعات.
 */
/**
 * سعة اعتراف البيئة بالتركيز.
 *
 * 0.09 وليس أكثر. الفكرة أن يُدرَك الفرق ولا يُرى: عند 0.2 صار المشهد
 * يومض مع كل ضغطة سهم — وذلك «نبض»، وهو ممنوع صراحةً. وعند الصفر تصير
 * البيئة جداراً مطبوعاً لا تعرف أنّ شيئاً يجري أمامها.
 */
const ACK = 0.09;

/**
 * اعتراف البيئة **بالامتداد** (§8) — غير اعترافها بالتركيز.
 *
 * الفارق بينهما هو الفارق بين حدثين: التركيز ينتقل عشرات المرّات في
 * الدقيقة، والامتداد يقع مرّة ويغيّر حجم الصفحة نفسها. فلمّا كان الضوء
 * يقرأ التركيز وحده، كانت الصفحة تنمو والعالمُ خلفها لا يعلم — تمتدّ
 * الغرفة ولا يتغيّر ضوؤها.
 *
 * 0.12 فوق مستوى الراحة، وهو رقمٌ لا يُلاحَظ بالمقارنة المباشرة بين
 * لقطتين؛ يُدرَك فقط بوصفه «اتّسع المكان». وهذا هو المطلوب حرفياً:
 * استجابة تُشعَر ولا تُرى.
 */
const DEEPEN_SCALE = ex.world.light;

/**
 * شدّةُ الضوء المحيط أثناء بناء الشاشة.
 *
 * 0.42: يبقى الجوُّ **مرئياً وحيّاً** — لا يُطفأ ولا يُسطَّح — لكنّه يترك
 * الصدارةَ لما يُبنى فوقه. والفرقُ بينه وبين شدّته الكاملة هو بالضبط
 * الفرقُ بين خلفيةٍ **تسند** الواجهة وخلفيةٍ **تزاحمها**.
 */
const RESTRAINT = 0.42;

export function AmbientEnvironment({
  /** لون القسم الحالي — يُستوفى بهدوء، والدورة لا تتأثّر. */
  accent,
  glow,
  /**
   * شدّة التركيز المستقرّ (0 → 1) — تُشتقّ من حقل الطاقة نفسه.
   *
   * لماذا هذه القيمة بالذات: حين يستقرّ الانتباه على بلاطة تكون شدّتها 1؛
   * وأثناء سفر الطاقة بين بلاطتين لا تبلغ أيٌّ منهما الذروة، فتهبط القيمة
   * إلى ~0.8 ثم تعود. أي أنّ البيئة **تخفت قليلاً أثناء الرحلة وتستعيد
   * وضوحها عند الوصول** — اعترافٌ بما يجري، لا نبضٌ دوري.
   *
   * الفرق جوهري: النبض إيقاعٌ ذاتي يعمل بلا سبب، وهذا **استجابة** لا تقع
   * إلا حين يتحرّك المستخدم. وعند سكونه تسكن تماماً.
   */
  response,
  /**
   * الصفحة ممتدّة الآن. ليست حالة تركيز — هي حجم المكان نفسه، ولذلك
   * تُمرَّر منفصلةً عن `response` ولها منحناها الخاصّ وزمنها الخاص.
   */
  deepened = false,
  /**
   * **الجوُّ مكبوحٌ الآن — الشاشةُ ما زالت تُبنى.**
   *
   * الضوءُ المحيط يبلغ شدّتَه كاملةً منذ أوّل إطار، فينافس التركيزَ في
   * اللحظة التي يجب أن يكون فيها التركيزُ وحده. والمشكلة ليست في وجوده
   * بل في **توقيته**: البيئةُ تصل قبل من جاءت لتخدمه.
   *
   * فتُكبح إلى `RESTRAINT` طوال الدخول، ثمّ ترتفع إلى شدّتها الطبيعية بعد
   * أن يستقرّ كلُّ شيء. والحياةُ لا تُمسّ — الحبيباتُ والضبابُ والنسيجُ
   * والدورةُ كلُّها تعمل، وإنّما يُخفَض ضوءان.
   */
  restrained = false,
}: {
  accent: string;
  glow: string;
  response?: MotionValue<number>;
  deepened?: boolean;
  restrained?: boolean;
}) {
  const still = useReducedMotion();
  /* أعماق مختلفة ⇒ سرعات مختلفة مع الكاميرا. الفرق هو ما يولّد المسافة. */
  const light = useCameraLayer("lighting");
  const fog = useCameraLayer("fog");
  const back = useCameraLayer("background");
  const idle = useIdle();

  /** انتقال لوني بطيء: أبطأ من الخلفية نفسها فيبقى آخر ما يستقرّ. */
  const tint = { duration: MOTION.duration.cinematic * 1.4, ease: MOTION.easing.standard };

  /*
   * اعتراف البيئة. يُطبَّق على الضوءين وحدهما — لا على الضباب ولا الحبيبات:
   * تلك نسيجٌ ثابت، وتحريكها يجعل المشهد كلّه يهتزّ.
   *
   * بلا مصدر (شاشة غير الرئيسية) تبقى القيمة 1 ثابتة، فلا فرق في السلوك.
   */
  const idleOne = useMotionValue(1);
  const ackSource = response ?? idleOne;

  /*
   * الامتداد يُقاد بـ`animate` صريحاً لا بانتقال CSS: القيمة تُضرب في
   * اعتراف التركيز، فلو كان لكلٍّ منهما مالكٌ مختلف (‏CSS للأول وMotionValue
   * للثاني) لتغلّب أحدهما على الآخر صامتاً — وهو العطل نفسه الموثَّق أسفل
   * هذا الملف حين وُضع الاعتراف على العنصر الذي يحمل حركة التنفّس.
   */
  const deepen = useMotionValue(0);
  useEffect(() => {
    if (still) { deepen.set(deepened ? 1 : 0); return; }
    const controls = animate(deepen, deepened ? 1 : 0, {
      duration: ex.world.duration,
      ease: MOTION.easing.enter,
    });
    return () => controls.stop();
  }, [deepened, deepen, still]);

  /**
   * كبحُ الدخول — قيمةٌ تصعد من `RESTRAINT` إلى 1 حين تستقرّ الشاشة.
   *
   * `animate` لا انتقالُ CSS: القيمةُ تُضرب في اعتراف التركيز، ولو كان
   * لكلٍّ منهما مالكٌ مختلف لتغلّب أحدهما على الآخر صامتاً — وهو العطلُ
   * الموثَّق أسفل هذا الملف.
   *
   * والصعودُ أبطأُ من الدخول نفسِه (‏0.9s): لو بلغ الضوءُ ذروتَه مع آخر
   * علامةٍ في الجدول لقُرئ **حدثاً** يقع عند النهاية. وهو ليس حدثاً —
   * هو المكانُ يستعيد أنفاسه بعد أن فرغ البناء.
   */
  const restraint = useMotionValue(restrained ? RESTRAINT : 1);
  useEffect(() => {
    const to = restrained ? RESTRAINT : 1;
    if (still) { restraint.set(to); return; }
    const controls = animate(restraint, to, { duration: 0.9, ease: MOTION.easing.standard });
    return () => controls.stop();
  }, [restrained, restraint, still]);

  const ack = useTransform(
    [ackSource, restraint] as const,
    ([v, r]: number[]) => (still ? r : (1 - ACK + ACK * v) * r),
  );

  /*
   * الاعتراف بالامتداد يركب **الاتّساع** لا الشفافية.
   *
   * أوّل تنفيذ ضرب `ack` في معامل الامتداد — ولا أثر له إطلاقاً. السبب
   * أنّ `ack` تساوي 1 بالضبط عند استقرار الانتباه على بلاطة (طاقتها 1،
   * فتُختصر المعادلة إلى 1)، و`opacity` مكبوحة في المدى [0,1] بحكم
   * المواصفة — فكل ما فوق الواحد يُقصّ صامتاً. طبقةٌ مشبَعة أصلاً لا
   * تصلح قناةً لإشارة جديدة.
   *
   * الاتّساع غير مكبوح، وهو أصدق دلالةً: الغرفة لم تزدد إضاءةً، بل صار
   * ضوؤها يغطّي مساحةً أكبر. 5% على هالةٍ مموّهة بـ60px تُدرَك سعةً ولا
   * تُرى حركة.
   *
   * ويُكتب على الغلاف الأوسط وحده: الخارجي تملكه الكاميرا، والداخلي تملكه
   * دورة التنفّس في CSS — وحركة CSS تتغلّب على النمط السطري، وهو العطل
   * الموثَّق أسفل هذا الملف.
   */
  const lightScale = useTransform(deepen, (d) => 1 + DEEPEN_SCALE * d);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/*
        ضوء محيط علوي — **ثلاثة مستويات لا اثنان**:
          الخارجي  → إزاحة الكاميرا (transform سطري)
          الأوسط   → اعتراف البيئة  (opacity سطري)
          الداخلي  → دورة التنفّس   (transform وopacity من حركة CSS)

        الفصل بين الأوسط والداخلي ليس تزيّداً: `skk-breathe-a` يكتب
        `opacity` في إطاراته، وحركةُ CSS **تتغلّب على النمط السطري**. حين
        وُضع الاعتراف على العنصر نفسه أُلغي بالكامل ولم يظهر له أثر — قِسته
        فوجدت القيمة تنجرف مع دورة التنفّس لا مع التركيز.
      */}
      <motion.div className="absolute" style={{ inset: 0, x: light.x, y: light.y }}>
        <motion.div
          className="absolute"
          style={{ width: "46vw", height: "46vw", left: "-10%", top: "-12%", opacity: ack, scale: lightScale }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              filter: "blur(60px)",
              animation: still ? undefined : "skk-breathe-a 17s ease-in-out infinite",
            }}
            animate={{ background: `radial-gradient(circle at 45% 45%, ${glow}, transparent 62%)` }}
            transition={tint}
          />
        </motion.div>
      </motion.div>

      {/* ضوء ثانٍ سفلي — دورة أطول فلا يتزامن مع الأول */}
      <motion.div className="absolute" style={{ inset: 0, x: back.x, y: back.y }}>
        <motion.div
          className="absolute"
          style={{ width: "34vw", height: "34vw", right: "4%", bottom: "-8%", opacity: ack, scale: lightScale }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              filter: "blur(70px)",
              animation: still ? undefined : "skk-breathe-b 29s ease-in-out infinite",
            }}
            animate={{ background: `radial-gradient(circle at 50% 50%, ${accent}1f, transparent 64%)` }}
            transition={tint}
          />
        </motion.div>
      </motion.div>

      {/* ضباب رقيق ينجرف أفقياً — عمق بلا تفاصيل تزاحم الواجهة */}
      <motion.div
        className="absolute"
        style={{ inset: 0, x: fog.x, y: fog.y }}
        /* يخفت قليلاً عند الخمول — البيئة تهدأ ولا تتوقّف */
        animate={{ opacity: idle ? 0.035 : 0.05 }}
        transition={{ duration: 2.4, ease: MOTION.easing.standard }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.5) 50%, transparent 80%)",
            animation: still ? undefined : "skk-haze 23s ease-in-out infinite",
          }}
        />
      </motion.div>

      {/* حبيبات وتعتيم أطراف — ثابتان تماماً، يكسران نعومة التدرّجات */}
      <div
        className="absolute inset-0 opacity-[0.045]"
        style={{ backgroundImage: "radial-gradient(#fff 1px, transparent 1px)", backgroundSize: "48px 48px" }}
      />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 45%, transparent 45%, rgba(2,4,10,0.55) 100%)" }}
      />
    </div>
  );
}
