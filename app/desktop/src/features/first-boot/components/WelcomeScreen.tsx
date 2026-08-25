/**
 * الترحيب — شاشةُ تقديمٍ لا شاشةُ إعداد (§8).
 *
 * ولا تحمل خياراً واحداً بقصد. وهذا أوّلُ ما يقوله التصميمُ للمستخدم:
 * **خطوةٌ واحدةٌ في كلّ مرّة**. ولو وُضعت فيها اللغةُ والمنطقةُ معاً
 * — وهو ما تفعله أكثرُ المُثبِّتات — لكانت الرسالةُ الأولى «هذه
 * استمارةٌ طويلة»، وهي الرسالةُ التي تُبنى هذه التجربةُ كلُّها ضدّها.
 *
 * وهي المرحلةُ الوحيدةُ التي لا تُسجَّل في الخادم: ليس فيها قرارٌ
 * يُحفظ، وحالةٌ تُكتب لضغطةٍ على «لنبدأ» حالةٌ بلا معنى.
 */

import nexschoolLogo from "../../../assets/nexschool/nexschool.png";
import { useT } from "../hooks/useFirstBootState";
import { useFirstBootStore } from "../store/firstBoot.store";

export function WelcomeScreen() {
  const t = useT();
  const begin = useFirstBootStore((store) => store.beginSetup);

  return (
    <div className="nx-center">
      <img
        className="nx-mark nx-rise-1"
        src={nexschoolLogo}
        alt="NexSchool"
        draggable={false}
      />

      <h1 className="nx-title nx-rise-2" tabIndex={-1}>
        {t.welcome.title}
      </h1>

      <div className="nx-rise-3">
        <p className="nx-lead">{t.welcome.lead}</p>
        <p className="nx-hint" style={{ marginTop: 8 }}>
          {t.welcome.body}
        </p>
      </div>

      <button
        type="button"
        className="nx-btn nx-btn--primary nx-rise-4"
        onClick={begin}
        /*
         * التركيزُ التلقائيّ هنا وحدَه في التهيئة كلِّها.
         *
         * فالشاشةُ بلا حقولٍ ولا خيارات، والفعلُ الوحيدُ فيها هذا —
         * فمن ضغط Enter مضى بلا أن يمسّ فأرة. وفي الشاشات التالية
         * يذهب التركيزُ إلى العنوان لا إلى الزرّ (§45): تركيزٌ على
         * «متابعة» في شاشةٍ فيها خياراتٌ يعني أنّ Enter يتخطّاها.
         */
        autoFocus
      >
        {t.welcome.action}
      </button>
    </div>
  );
}
