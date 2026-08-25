/**
 * السنة الدراسية — **الاستثناءُ الأكاديميُّ الوحيد** (§22/§23).
 *
 * والتهيئةُ لا تبني مؤسسة: لا موادَّ ولا أفواجَ ولا أسعار. لكنّ
 * «السنةَ الجارية» ليست بياناً من بياناتِ المؤسسة — هي **السياقُ**
 * الذي تُقيَّد عليه كلُّ البيانات اللاحقة. الكشوفُ والفواتيرُ وتخليصُ
 * الأساتذة كلُّها تسأل عنها، فمن دخل بلا سنةٍ جاريةٍ وجد نصفَ الشاشات
 * تعتذر بلا أن يعرف السبب.
 *
 * ولذلك تُنشأ هنا فعلاً — صفٌّ في `AcademicYear` عليه `isCurrent` —
 * ولا يُكتفى بحفظ تاريخين في الإعدادات.
 *
 * والاقتراحُ يتبع عُرفَ المؤسسات: سنةٌ تبدأ في سبتمبر وتنتهي في جوان.
 * ومن فتح البرنامجَ في مارس يُقترح له **السنةُ الجارية** لا التالية —
 * وهو الفرقُ الذي يجعل الاقتراحَ نافعاً بدل أن يكون تخميناً يُصحَّح.
 */

import { useState } from "react";

import { Field, Stage } from "./Stage";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useFieldErrors, useT } from "../hooks/useFirstBootState";
import { submitAcademicYear } from "../services/firstBoot.service";
import { academicYearIssues, suggestAcademicYear } from "../utils/validation";

/** `Date` من الخادم تصل ISO كاملاً — والحقلُ يريد `YYYY-MM-DD` */
const toDateInput = (value: string): string => value.slice(0, 10);

export function AcademicYearScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const fieldErrors = useFieldErrors();
  const { submit, back, canGoBack, submitting } = useFirstBoot("ACADEMIC_YEAR");

  const suggestion = suggestAcademicYear();
  const saved = answers.academicYear;

  const [name, setName] = useState(saved?.name ?? suggestion.name);
  const [startDate, setStartDate] = useState(
    saved ? toDateInput(saved.startDate) : suggestion.startDate,
  );
  const [endDate, setEndDate] = useState(
    saved ? toDateInput(saved.endDate) : suggestion.endDate,
  );
  const [sessions, setSessions] = useState(
    String(saved?.sessionsPerMonth ?? suggestion.sessionsPerMonth),
  );

  const issues = academicYearIssues({
    name,
    startDate,
    endDate,
    sessionsPerMonth: Number(sessions),
  });

  const has = (issue: string) => issues.includes(issue as never);

  return (
    <Stage
      stepKey="ACADEMIC_YEAR"
      title={t.academicYear.title}
      description={t.academicYear.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={t.academicYear.why}
      primary={{
        label: t.common.continue,
        busy: submitting,
        disabled: issues.length > 0,
        onClick: () =>
          void submit(() =>
            submitAcademicYear({
              name: name.trim(),
              startDate,
              endDate,
              sessionsPerMonth: Number(sessions),
            }),
          ),
      }}
    >
      <div className="nx-fields nx-fields--two">
        <Field label={t.academicYear.name} error={fieldErrors.name}>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </Field>

        <Field
          label={t.academicYear.sessions}
          hint={t.academicYear.sessionsHint}
          error={has("sessions") ? t.errors.tryAgain : fieldErrors.sessionsPerMonth}
        >
          <input
            value={sessions}
            onChange={(event) => setSessions(event.target.value)}
            dir="ltr"
            inputMode="numeric"
          />
        </Field>

        <Field label={t.academicYear.start} error={fieldErrors.startDate}>
          <input
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            type="date"
            dir="ltr"
          />
        </Field>

        <Field
          label={t.academicYear.end}
          /*
           * «النهايةُ قبل البداية» تُعرض على حقل النهاية لا في شريطٍ
           * عامّ: الخطأُ في علاقةٍ بين حقلين، والعرضُ عند الثاني هو
           * ما يجعل المستخدمَ يعرف أيَّهما يصحّح.
           */
          error={
            has("order")
              ? t.errors.tryAgain
              : fieldErrors.endDate
          }
        >
          <input
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            type="date"
            dir="ltr"
          />
        </Field>
      </div>
    </Stage>
  );
}
