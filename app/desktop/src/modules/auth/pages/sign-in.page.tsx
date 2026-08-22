/**
 * الدخول — شاشةُ اختيار المستخدم، لا نموذجُ اسمٍ وكلمة.
 *
 * حلّت محلّ `login.page` التي كانت تعرض حقلين في بطاقةٍ زجاجية. والسببُ
 * الذي منع شاشةَ الاختيار وقتها زال: `/auth/profiles` صار مساراً عامّاً
 * يُرجع اسمَ العرض والصورة بلا اسمِ دخول، فأمكن رسمُ البطاقات قبل أن
 * يُصادَق أحد.
 *
 * **وهي المكوّنان نفسُهما اللذان تستعملهما شاشةُ الإقلاع** — لا نسخةٌ
 * ثانية. الفارقُ الوحيد أنّ البيئة تُركَّب هنا مع الصفحة، بينما تُركَّب
 * هناك مرّةً وتبقى عبر مراحل الإقلاع. فمن خرج من حسابه يجد الفضاءَ
 * نفسَه الذي دخل منه، ومن أقلع الجهازَ يجده متّصلاً بلا انقطاع.
 *
 * ولا حاجة إلى نموذجٍ منفصل لمن ليس في القائمة: خانةُ «حساب آخر» في
 * الكاروسيل تفتح حقلَي الاسم والكلمة في الموضع نفسه.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { CinematicEnvironment } from "../../../components/environment/CinematicEnvironment";
import { UserSelectionScreen } from "../../../components/user-selection/UserSelectionScreen";
import { environment } from "../../../motion/home-entrance";
import { PATHS } from "../../../routes/paths";

export default function SignInPage() {
  const navigate = useNavigate();

  /* الفضاءُ يخفت ولا ينطفئ — كما في شاشة الإقلاع تماماً (§4) */
  const [envIntensity, setEnvIntensity] = useState(1);

  return (
    /*
      خلفيةٌ صلبةٌ تحت اللوحة — لا شفّافة.
      اللوحةُ تُرسم بـ`alpha: false` فلا تُظهر ما تحتها، لكنّ الإطارَ
      الأوّل قبل أوّل رسمٍ يكشف ما وراءها. ولونُ القاع نفسُه يجعل ذلك
      الإطارَ غيرَ مرئيّ.
    */
    <div className="fixed inset-0 select-none overflow-hidden bg-[#04060c] text-white">
      <CinematicEnvironment focusY={0.62} intensity={envIntensity} />

      <div className="relative h-full">
        <UserSelectionScreen
          onLeaving={() => setEnvIntensity(environment.intensity)}
          onAuthenticated={() => navigate(PATHS.home, { replace: true })}
        />
      </div>
    </div>
  );
}
