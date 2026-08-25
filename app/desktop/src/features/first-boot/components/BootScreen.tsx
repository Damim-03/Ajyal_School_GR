/**
 * الإقلاع — الشاشةُ التي تُعرض بينما يُسأل الخادمُ عن الحالة (§25).
 *
 * وهي شاشةُ **انتظارٍ صادقة**: لا تقول «جارٍ التحميل» بينما لا شيء
 * يُحمَّل، ولا تعرض شريطَ تقدّمٍ لطلبٍ واحدٍ لا يُعرف زمنُه. نبضةٌ
 * واحدةٌ وسطرٌ يقول ما يجري.
 *
 * ولها وجهٌ ثانٍ: **تعذّرُ بلوغ الخادم**. وهو أوّلُ ما يقع في تركيبٍ
 * جديدٍ نُصّب فيه سطحُ المكتب قبل أن يُشغَّل الخادم — فيجد المستخدمُ
 * ما يقوله له ماذا يفعل، لا شاشةً سوداءَ صامتة.
 */

import { useT } from "../hooks/useFirstBootState";
import { useFirstBootStore } from "../store/firstBoot.store";
import nexschoolLogo from "../../../assets/nexschool/nexschool.png";

export function BootScreen() {
  const t = useT();
  const bootError = useFirstBootStore((store) => store.bootError);
  const load = useFirstBootStore((store) => store.load);

  if (bootError) {
    return (
      <div className="nx-center">
        <div className="nx-rise-1">
          <img className="nx-mark" src={nexschoolLogo} alt="NexSchool" />
        </div>

        <h1 className="nx-title nx-rise-2" tabIndex={-1}>
          {t.booting.offline}
        </h1>

        <p className="nx-lead nx-rise-3">{t.booting.offlineHint}</p>

        <button
          type="button"
          className="nx-btn nx-btn--primary nx-rise-4"
          onClick={() => void load()}
        >
          {t.common.retry}
        </button>
      </div>
    );
  }

  return (
    <div className="nx-center">
      <img
        className="nx-mark nx-rise-1"
        src={nexschoolLogo}
        alt="NexSchool"
        draggable={false}
      />

      <p className="nx-hint nx-rise-3" role="status">
        <span className="nx-pulse" aria-hidden="true" /> {t.booting.checking}
      </p>
    </div>
  );
}
