/**
 * الساعة — أعلى اليمين.
 *
 * **تُحدَّث عند تبدّل الدقيقة وحدها.** مؤقّتٌ كلَّ ثانية يُعيد تصيير
 * الشاشة ستّين مرّةً في الدقيقة لأجل رقمٍ لا يتغيّر في تسعٍ وخمسين
 * منها — والشاشةُ فوق لوحةٍ ترسم ألفَ جسيم، فكلُّ تصييرٍ زائدٍ يزاحمها
 * على الخيط نفسه.
 *
 * فالمؤقّتُ يُضبط على ما بقي من الدقيقة الجارية، ثمّ يُعاد ضبطُه لكلّ
 * دقيقةٍ تالية — وهو أدقُّ من فاصلٍ ثابتٍ مقدارُه دقيقة، إذ لا ينزاح
 * عن رأس الدقيقة مع طول التشغيل.
 */

import { useEffect, useState } from "react";

/**
 * أربعٌ وعشرون ساعةً صراحةً.
 *
 * `fr-DZ` وحدَها لا تكفي: المحرّك يقع على تفضيل النظام حين لا تُذكر
 * الدورة، فظهرت «12:07 AM» على جهازٍ ضبطُه إنجليزيّ. و`hourCycle` يقطع
 * التبعية — الساعةُ في واجهة الجهاز رقمان ونقطتان، لا لاحقةَ صباحٍ
 * ومساء تُطيل السطر وتتبدّل بتبدّل إعدادات ويندوز.
 */
const shown = () =>
  new Date().toLocaleTimeString("fr-DZ", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

export function Clock({ className = "" }: { className?: string }) {
  const [time, setTime] = useState(shown);

  useEffect(() => {
    let timer = 0;

    const schedule = () => {
      const now = new Date();
      const remaining = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds());

      timer = window.setTimeout(() => {
        setTime(shown());
        schedule();
      }, remaining + 40);
    };

    schedule();

    return () => window.clearTimeout(timer);
  }, []);

  return (
    <span
      dir="ltr"
      className={`text-sm font-light tabular-nums tracking-wide text-white/45 ${className}`}
    >
      {time}
    </span>
  );
}
