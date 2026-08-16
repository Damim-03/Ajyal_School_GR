import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { moduleOf } from "../../features/home/modules";
import { LAYER } from "../../motion/layers";
import { MOTION } from "../../motion/system";
import { motionDispatch } from "../../motion/orchestrator";
import { useCameraLayer } from "../../motion/camera";

/**
 * جوّ القسم — الطبقة التي تجعل التطبيق **عالماً واحداً** لا سلسلة صفحات.
 *
 * المشكلة التي تحلّها، بالضبط:
 *
 *   كانت الرئيسية مشهداً كاملاً — خلفية القسم ولونه وضوءه — ثم يضغط
 *   المستخدم «ابدأ الآن» فيتمدّد ذلك كلّه ويُغطّى بحجاب… ثم يُرفع الحجاب
 *   عن سطحٍ رماديٍّ محايد لا صلة له بما كان. لحظةَ الوصول ينقطع الخيط:
 *   المكان الذي كنتَ تعاينه اختفى، وحلّ محلّه مستند آخر. وهذا حرفياً
 *   إحساس «تحمّلت صفحة»، وهو ما يمنعه هذا الفصل.
 *
 *   هذه الطبقة تُبقي المكان. تُركَّب مرّة واحدة فوق الراوتر — فلا تُفكَّك
 *   ولا تُعاد عبر التنقّل — وتقرأ القسم من المسار نفسه. فحين تصل إلى
 *   المخزون تجد زُرقته حاضرةً حول الشاشة: لم تفتح صفحةً، بل نزلتَ داخل
 *   الشيء الذي كنت تنظر إليه.
 *
 * لماذا صبغة لا مشهد: شاشات العمل **فاتحة** (‏#f1f5f9 وأسطح بيضاء ونصّ
 * داكن). نقلُ خلفية الرئيسية الداكنة إليها كان سيعني إعادة تصميمها —
 * وهذا ليس مطلوباً ولا مسموحاً. فينتقل **اللون** وحده: يتسرّب من
 * الأطراف ويترك سطح العمل كما هو. الغرفة تغيّرت، والطاولة لم تتغيّر.
 *
 * لماذا لا تظهر في الرئيسية: للرئيسية طبقاتها الخاصّة بتلاشٍ متبادل بين
 * تسعة أقسام؛ رسم جوٍّ ثانٍ فوقها ازدواجُ ملكية. فتصمت هنا وتتسلّم عند
 * المغادرة.
 */

/**
 * شدّة التسرّب.
 *
 * ضُبطت بالنظر إلى لقطة شاشة حقيقية لا بالتقدير: عند 0.5 مع ألوان بشفافية
 * 12% كان الأثر صفراً عملياً فوق سطح فاتح (‏#f1f5f9) — طبقةٌ موجودة في
 * DOM ولا تُرى بالعين، وهي أسوأ من غيابها لأنها تُوهم أنّ الأمر مُنجَز.
 *
 * وسقفها من الجهة الأخرى محكوم بالقراءة: هذه شاشات جداول وحقول، فما
 * يزاحم تباين النصّ مرفوض مهما كان جميلاً.
 */
const BLEED = 1;

export function ModuleAtmosphere() {
  const { pathname } = useLocation();
  const mod = moduleOf(pathname);
  /* الطبقة الأبعد، فأبطأ استجابةً للكاميرا — العمق من فرق السرعة. */
  const cam = useCameraLayer("background");

  /*
   * إعلان الوصول من مكان واحد. لو تُرك لكل شاشة عمل لوجب تعديل ستّ
   * شاشات، ولنُسي في السابعة. مغادرة القسم تُعلنها الرئيسية عند تركيبها.
   */
  useEffect(() => {
    if (mod) motionDispatch({ type: "WORKSPACE_READY", module: mod.id });
  }, [mod]);

  return (
    <AnimatePresence>
      {mod && (
        <motion.div
          key={mod.id}
          aria-hidden
          className="pointer-events-none fixed inset-0 overflow-hidden"
          /*
           * خلف محتوى الصفحة وفوق خلفية المستند. الصفحات هنا غير مموضعة،
           * فطبقةٌ مثبَّتة بترتيب موجب كانت سترتسم **فوق** نصّها.
           */
          style={{ zIndex: LAYER.world }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          /* الدخول أبطأ من الخروج: الوصول يستقرّ، والمغادرة تُخلي الطريق. */
          transition={{ duration: MOTION.duration.cinematic, ease: MOTION.easing.enter }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              opacity: BLEED,
              x: cam.x,
              y: cam.y,
              /*
               * ثلاثة تسرّبات لا واحد، ومواضعها مقصودة: الترويسة تحتلّ
               * أعلى الشاشة، فالتسرّب هناك مطموس لا يُرى. الأقوى منها
               * يقع **تحت** الترويسة مباشرةً حيث يبدأ سطح العمل، ثمّ
               * ينحسر نحو الأسفل فلا ينتهي اللون بحدٍّ مستقيم.
               */
              background:
                `radial-gradient(140% 46% at 82% 12%, ${mod.accent}3d, transparent 64%),` +
                `radial-gradient(95% 42% at 6% 88%, ${mod.from}2b, transparent 68%),` +
                `linear-gradient(to bottom, ${mod.accent}1a, transparent 42%)`,
            }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
