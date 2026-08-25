/**
 * الخطّافُ الذي تستعمله الشاشات — عقدٌ واحدٌ لكلّها.
 *
 * كلُّ شاشةٍ في التهيئة تحتاج الأربعةَ نفسَها: أن تُرسل، وأن ترجع، وأن
 * تعرف هل هي في أثناء إرسال، وأن تعرف هل يجوز الرجوعُ من هنا أصلاً.
 * فجمعُها هنا يعني أنّ شاشةً جديدةً تُكتب في عشرين سطراً — وأنّ قاعدةَ
 * «لا انتقالَ إلّا بردّ الخادم» تُطبَّق في موضعٍ واحدٍ لا في أربعةَ عشر.
 */

import { useCallback } from "react";

import { useFirstBootStore } from "../store/firstBoot.store";
import {
  FIRST_BOOT_STEPS,
  type FirstBootState,
  type FirstBootStep,
} from "../types/firstBoot.types";

/**
 * أوّلُ خطوةٍ لا رجوعَ من قبلها.
 *
 * والمنطقُ مرآةٌ لـ`stepTraits` في الخادم — والخادمُ هو الحَكَم: هذه
 * تُخفي الزرَّ فحسب، وذاك يردّ الطلبَ لو أُرسل. وإخفاءُ ما سيُرفض
 * أصدقُ من عرضِ زرٍّ يعتذر عند الضغط.
 */
const IRREVERSIBLE: FirstBootStep[] = ["ADMINISTRATOR", "READY"];

/** الخطوةُ الأولى: لا شيءَ قبلها يُرجَع إليه */
const FIRST: FirstBootStep = "LANGUAGE";

export const useFirstBoot = (step: FirstBootStep) => {
  const submitting = useFirstBootStore((store) => store.submitting);
  const submitStep = useFirstBootStore((store) => store.submit);
  const goBack = useFirstBootStore((store) => store.back);
  const done = useFirstBootStore((store) => store.state?.done);

  const submit = useCallback(
    (run: () => Promise<FirstBootState>) => submitStep(step, run),
    [submitStep, step],
  );

  const back = useCallback(() => goBack(step), [goBack, step]);

  /*
   * زرُّ الرجوع يظهر إن كان **خلفَه** ما يُرجَع إليه.
   *
   * وليس السؤالُ «هل هذه الخطوةُ تُرجَع» بل «هل قبلها خطوةٌ تُرجَع»:
   * من هو في «المؤسسة» يرجع إلى «الأجهزة» متخطّياً «المدير»، وقد
   * كان الزرُّ يختفي عنه لو قيس بالخطوة الحالية.
   */
  const previousIndex = FIRST_BOOT_STEPS.indexOf(step) - 1;

  const canGoBack =
    step !== FIRST &&
    previousIndex >= 0 &&
    FIRST_BOOT_STEPS.slice(0, previousIndex + 1).some(
      (candidate) => !IRREVERSIBLE.includes(candidate),
    );

  return {
    submit,
    back,
    canGoBack,
    submitting,
    /** هل أُتمّت هذه الخطوةُ من قبل؟ — تُغيّر نصَّ الزرّ إلى «حفظ» */
    completed: done?.includes(step) ?? false,
  };
};
