/**
 * التحقّق النهائي — **الشاشةُ التي لا تُصدّق نفسَها** (§21).
 *
 * كلُّ ما قبلها انتهى بنجاحٍ ظاهر: الشاشاتُ مضت، والحالةُ تقول إنّ
 * أربعَ عشرةَ خطوةً أُتمّت. ومع ذلك تسأل الخادمَ من جديد عن **الواقع**
 * لا عن الحالة: هل ثمّة مديرٌ نشط؟ هل السنةُ الجاريةُ واحدةٌ لا اثنتان؟
 * هل لدور المدير صلاحيةٌ واحدةٌ على الأقلّ؟
 *
 * والفرقُ ليس نظرياً: خطوةٌ نجحت ثمّ حُذف أثرُها من نافذةٍ أخرى، أو
 * قاعدةٌ استُعيدت من نسخةٍ أقدم، أو معاملةٌ سقطت بعد أن رُدّ «تمّ».
 * فالتحقّقُ هو الحدُّ الفاصلُ بين «قال المستخدمُ إنّه جاهز» و«النظامُ
 * جاهزٌ فعلاً».
 *
 * والإتمامُ يُعيد الفحصَ في الخادم مرّةً أخرى قبل أن يكتب `COMPLETED`.
 * فهذه الشاشةُ لا تملك قرارَ الإتمام — تعرضه وتطلبه فحسب.
 */

import { useEffect } from "react";

import { Stage } from "./Stage";
import { useT, useVerification } from "../hooks/useFirstBootState";
import { useFirstBootStore } from "../store/firstBoot.store";
import type { CheckKey } from "../types/firstBoot.types";

export function VerificationScreen({ error }: { error: string | null }) {
  const t = useT();
  const verification = useVerification();
  const submitting = useFirstBootStore((store) => store.submitting);
  const run = useFirstBootStore((store) => store.runVerification);
  const finish = useFirstBootStore((store) => store.finish);
  const back = useFirstBootStore((store) => store.back);

  /*
   * يبدأ الفحصُ من نفسه عند العرض.
   *
   * ولا زرَّ «ابدأ الفحص»: المستخدمُ وصل إلى آخر الطريق، وأن يُطلب
   * منه فعلٌ إضافيٌّ ليعرف هل يستطيع المضيَّ تأخيرٌ بلا معنى.
   */
  useEffect(() => {
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks = verification?.checks ?? [];
  const ok = verification?.ok ?? false;
  const running = submitting && !verification;

  const title = running
    ? t.verification.title
    : ok
      ? t.verification.okTitle
      : t.verification.failedTitle;

  const description = running
    ? t.verification.running
    : ok
      ? undefined
      : t.verification.failedLead;

  return (
    <Stage
      stepKey="FINAL_VERIFICATION"
      title={title}
      description={description}
      error={error}
      onBack={() => void back("FINAL_VERIFICATION")}
      secondary={
        running || ok
          ? undefined
          : { label: t.common.retry, onClick: () => void run() }
      }
      primary={{
        label: t.verification.action,
        busy: submitting && Boolean(verification),
        /*
         * الزرُّ مقفلٌ ما لم يمرّ كلُّ فحص.
         *
         * ولا «تجاوز» ولا «متابعة على أيّ حال»: الدخولُ إلى التطبيق
         * بنظامٍ ناقصٍ يعني شاشاتٍ تعتذر بلا سببٍ ظاهر — وهو أسوأُ
         * ممّا يبدو هنا صرامةً (§21).
         */
        disabled: !ok,
        onClick: () => void finish(),
      }}
    >
      <div className="nx-list">
        {(running ? PLACEHOLDER : checks.map((check) => check.key)).map((key) => {
          const result = checks.find((check) => check.key === key);
          const state = running || !result ? "busy" : result.ok ? "ok" : "bad";

          return (
            <div className="nx-row" key={key}>
              <div className="nx-row__body">
                <span className="nx-row__label">
                  {t.verification.checks[key]}
                </span>

                {/*
                  التفصيلُ التقنيّ يُعرض عند الفشل وحدَه.
                  `current=2 dates=true` لا تعني شيئاً لمن نجح فحصُه،
                  وتعني كلَّ شيءٍ لمن سقط عنده.
                */}
                {result && !result.ok && result.detail && (
                  <span className="nx-row__meta" dir="ltr">
                    {result.detail}
                  </span>
                )}
              </div>

              {state === "busy" ? (
                <span className="nx-pulse" aria-hidden="true" />
              ) : (
                <span
                  className={
                    state === "ok" ? "nx-tag nx-tag--ok" : "nx-tag nx-tag--bad"
                  }
                >
                  {state === "ok" ? "✓" : "✗"}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </Stage>
  );
}

/** ترتيبُ الفحوص أثناء الانتظار — ليُرسم الهيكلُ لا فراغٌ ثمّ قائمة */
const PLACEHOLDER: CheckKey[] = [
  "database",
  "schema",
  "language",
  "region",
  "institution",
  "administrator",
  "role",
  "permissions",
  "terms",
  "academicYear",
  "devices",
  "appVersion",
];
