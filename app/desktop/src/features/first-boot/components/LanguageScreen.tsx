/**
 * اللغة — **وتتبدّل الشاشةُ بها في اللحظة، لا بعد التهيئة** (§9).
 *
 * وهذا هو الفرقُ بين اختيارٍ يُفهم واختيارٍ يُوعد به: من ضغط
 * «Français» يجب أن يقرأ الفرنسيةَ قبل أن يرفع إصبعه — فيعلم أنّه
 * اختار الصحيح. والتأجيلُ إلى ما بعد الإرسال كان سيجعل الشاشةَ تُقرّ
 * بالاختيار بعد ثلثِ ثانيةٍ من الصمت، وهو زمنٌ كافٍ للشكّ.
 *
 * فالتطبيقُ يقع أوّلاً (`setLanguage` تكتب `dir` و`lang` على المستند)،
 * ثمّ يُرسَل الاختيارُ عند «متابعة». وإن سقط الإرسالُ بقيت الشاشةُ
 * باللغة المختارة — وهو الصواب: المستخدمُ يقرأ رسالةَ الخطأ بلغته.
 */

import { Choice, ChoiceGroup, Stage } from "./Stage";
import { LANGUAGES } from "../i18n";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useLanguage, useT } from "../hooks/useFirstBootState";
import { useFirstBootStore } from "../store/firstBoot.store";
import { submitLanguage } from "../services/firstBoot.service";

export function LanguageScreen({ error }: { error: string | null }) {
  const t = useT();
  const language = useLanguage();
  const setLanguage = useFirstBootStore((store) => store.setLanguage);
  const { submit, submitting } = useFirstBoot("LANGUAGE");

  return (
    <Stage
      stepKey="LANGUAGE"
      title={t.language.title}
      description={t.language.description}
      error={error}
      primary={{
        label: t.common.continue,
        busy: submitting,
        onClick: () => void submit(() => submitLanguage(language)),
      }}
    >
      <ChoiceGroup label={t.language.title}>
        {LANGUAGES.map((entry) => (
          <Choice
            key={entry.code}
            label={entry.label}
            /*
             * الاسمُ الإنجليزيُّ تحت الاسم الأصليّ.
             *
             * فمن فُتح له التطبيقُ بلغةٍ لا يقرؤها — وهي حالةٌ واقعية:
             * جهازٌ نظامُه فرنسيٌّ عند مؤسسةٍ عربية — يجد سطراً واحداً
             * يفهمه على الأقلّ. والأسماءُ الأصليةُ وحدها كانت ستجعل
             * شاشةَ اللغة أوّلَ حاجزٍ لغويّ.
             */
            hint={entry.label === entry.english ? undefined : entry.english}
            selected={language === entry.code}
            onSelect={() => setLanguage(entry.code)}
          />
        ))}
      </ChoiceGroup>
    </Stage>
  );
}
