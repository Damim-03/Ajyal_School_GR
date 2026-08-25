/**
 * الخصوصية — **مفتاحٌ واحدٌ لأنّ الحقيقيَّ واحد** (§19/§29).
 *
 * التصميمُ الأصليُّ طلب ثلاثةَ مفاتيح: إحصاءاتٌ، وتقاريرُ أعطال،
 * وتشخيصٌ مجهول. وليس في NexSchool واحدٌ منها: لا اتصالَ يخرج من شبكة
 * المؤسسة أصلاً. فمفاتيحُ لإطفاء ما لا يعمل هي أسوأُ ما يُكتب في شاشةِ
 * خصوصية — تُوهم المستخدمَ أنّ ثمّة ما يُرسَل، وأنّ إطفاءَه إنجاز.
 *
 * فما يُعرض بدلَها **إقرارٌ بحقيقة**: سطران يقولان إنّ شيئاً لا يخرج.
 * وهما أنفعُ للمؤسسة من عشرة مفاتيح.
 *
 * والمفتاحُ الوحيدُ حقيقيٌّ تماماً: سِجلُّ أعطالٍ **في هذا الجهاز**،
 * يقيّده مستمعٌ على `window.onerror`، ويُمحى عند إطفائه.
 */

import { CloudOff, EyeOff, type LucideIcon } from "lucide-react";
import { useState } from "react";

import { Stage } from "./Stage";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useT } from "../hooks/useFirstBootState";
import { submitPrivacy } from "../services/firstBoot.service";
import {
  diagnosticsEnabled,
  setDiagnostics,
} from "../services/initialization.service";

export function PrivacyScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const { submit, back, canGoBack, submitting } = useFirstBoot("PRIVACY");

  const [enabled, setEnabled] = useState(
    answers.diagnostics || diagnosticsEnabled(),
  );

  const toggle = (value: boolean) => {
    setEnabled(value);
    /* يُطبَّق فوراً في الجهاز — والخادمُ يسجّل الاختيار عند «متابعة» */
    setDiagnostics(value);
  };

  return (
    <Stage
      stepKey="PRIVACY"
      title={t.privacy.title}
      description={t.privacy.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      primary={{
        label: t.common.continue,
        busy: submitting,
        onClick: () => void submit(() => submitPrivacy(enabled)),
      }}
    >
      <div className="nx-list">
        {/* إقراران — لا مفتاحَ لهما لأنّهما ليسا خياراً */}
        <Fact icon={EyeOff} label={t.privacy.noTelemetry} hint={t.privacy.noTelemetryHint} />
        <Fact icon={CloudOff} label={t.privacy.noCrash} hint={t.privacy.noCrashHint} />

        <div className="nx-row">
          <div className="nx-row__body">
            <span className="nx-row__label">{t.privacy.diagnostics}</span>
            <span
              className="nx-row__meta"
              style={{ whiteSpace: "normal", lineHeight: 1.55 }}
            >
              {t.privacy.diagnosticsHint}
            </span>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-label={t.privacy.diagnostics}
            className="nx-btn nx-toggle"
            style={{ flex: "none" }}
            onClick={() => toggle(!enabled)}
          >
            {enabled ? t.common.enabled : t.common.disabled}
          </button>
        </div>
      </div>
    </Stage>
  );
}

function Fact({
  label,
  hint,
  icon: Icon,
}: {
  label: string;
  hint: string;
  /** رمزٌ يقول **ما الذي لا يخرج** — والنفيُ يحتاج صورةً أكثرَ من الإثبات. */
  icon: LucideIcon;
}) {
  return (
    <div className="nx-row">
      <span className="nx-row__icon" aria-hidden="true">
        <Icon size={17} strokeWidth={1.7} />
      </span>

      <div className="nx-row__body">
        <span className="nx-row__label">{label}</span>
        <span
          className="nx-row__meta"
          style={{ whiteSpace: "normal", lineHeight: 1.55 }}
        >
          {hint}
        </span>
      </div>

      {/*
        وسمٌ لا مفتاح: هذه حقيقةٌ عن البرنامج لا إعدادٌ فيه. وشكلُ
        المفتاح — ولو معطَّلاً — كان سيقول إنّ ثمّة ما يُبدَّل.
      */}
      <span className="nx-tag nx-tag--ok" style={{ flex: "none" }}>
        ✓
      </span>
    </div>
  );
}
