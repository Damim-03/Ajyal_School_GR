/**
 * هاتفُ الاسترجاع — **اختياريٌّ بقرارٍ مكتوب، لا بإهمال** (§20/§63).
 *
 * و§20 يشترط أن يكون القرارُ صريحاً في التنفيذ لا عشوائياً. فهذا هو:
 *
 * لا يوجد في NexSchool إرسالُ رسائلَ قصيرة، ولا استرجاعُ كلمةِ مرورٍ
 * آليّ — كلمةُ مرورٍ ضاعت يُعيدها مديرٌ من «الإعدادات ← الحسابات».
 * فاشتراطُ رقمٍ لا يستعمله شيءٌ كان سيمنع المضيَّ لأجل حقلٍ لا أثرَ له.
 *
 * وهو يُحفظ مع ذلك لأنّ له معنىً واحداً حقيقياً: **جهةُ اتصال
 * المؤسسة** — من يُتّصل به حين يحتاج أحدٌ صاحبَ هذا التركيب.
 *
 * ولذلك زرّان: «متابعة» يحفظ ما كُتب، و«ليس الآن» يرسل فارغاً. وكلاهما
 * **يُتمّ الخطوة** — فليس هذا تخطّياً للتهيئة، إنّما إجابةٌ بأنّ الحقل
 * لا يعني هذه المؤسسة.
 */

import { useState } from "react";

import { Field, Stage } from "./Stage";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useFieldErrors, useT } from "../hooks/useFirstBootState";
import { submitRecovery } from "../services/firstBoot.service";

const PHONE_PATTERN = /^\+?[0-9\s-]{6,24}$/;

export function RecoveryScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const fieldErrors = useFieldErrors();
  const { submit, back, canGoBack, submitting } = useFirstBoot("RECOVERY");

  const [phone, setPhone] = useState(answers.recoveryPhone);

  const valid = phone.trim() === "" || PHONE_PATTERN.test(phone.trim());

  return (
    <Stage
      stepKey="RECOVERY"
      title={t.recovery.title}
      description={t.recovery.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={t.recovery.optional}
      secondary={{
        label: t.common.notNow,
        disabled: submitting,
        onClick: () => void submit(() => submitRecovery("")),
      }}
      primary={{
        label: t.common.continue,
        busy: submitting,
        disabled: !valid,
        onClick: () => void submit(() => submitRecovery(phone.trim())),
      }}
    >
      <div className="nx-fields" style={{ maxWidth: "22rem" }}>
        <Field
          label={t.recovery.phone}
          hint={t.recovery.hint}
          error={!valid ? t.errors.tryAgain : fieldErrors.phone}
        >
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            dir="ltr"
            inputMode="tel"
            placeholder="+213 ..."
            autoComplete="off"
          />
        </Field>
      </div>
    </Stage>
  );
}
