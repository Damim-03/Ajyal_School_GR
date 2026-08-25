/**
 * الأداء — ثلاثةُ ملامحَ **لها أثرٌ يُقاس** (§13).
 *
 * وما يتبدّل بها في هذا التطبيق بالضبط، لا وصفاً عامّاً:
 *
 *   إيقاعُ البيانات   `queryTuning()` تُغذّي `QueryClient` — دقيقة،
 *                     أو خمس، أو ربعُ ساعة، مع/بلا استجلابٍ عند
 *                     العودة إلى النافذة.
 *   الحركة           `prefersStillMotion()` يقرؤها المشهدُ السينمائيّ
 *                     ودخولُ الرئيسية وكشفُ الحضور، ويكتب `data-motion`
 *                     على الجذر فتسكن انتقالاتُ CSS كلُّها.
 *
 * ولا يُذكر في الشاشة ما لا يقع: لا «تسريعُ المعالج» ولا «تحسينُ
 * الذاكرة» — هذا تطبيقُ نافذةٍ لا نظامُ تشغيل.
 *
 * والجدولُ أسفلَ الخيارات يقول لكلّ ملمحٍ ماذا يفعل بالضبط. وهو
 * الفرقُ بين خيارٍ يُفهم وخيارٍ يُخمَّن.
 */

import { useState } from "react";
import { Gauge, Leaf, Zap } from "lucide-react";

import { Choice, ChoiceGroup, Stage } from "./Stage";
import { applyPerformance } from "../services/initialization.service";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useT } from "../hooks/useFirstBootState";
import { submitPerformance } from "../services/firstBoot.service";
import { readPreferences } from "../../../core/system/preferences";
import type { PerformanceProfile } from "../types/firstBoot.types";

export function PerformanceScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const { submit, back, canGoBack, submitting } = useFirstBoot("PERFORMANCE");

  const [profile, setProfile] = useState<PerformanceProfile>(
    (answers.performance as PerformanceProfile) || readPreferences().performance,
  );

  /*
   * ويُطبَّق فوراً — كما في شاشة العرض.
   *
   * وأثرُه يُرى في الشاشة نفسِها: «توفير الطاقة» يُسكّن تنفّسَ الخلفية
   * ونبضةَ الانتظار في اللحظة. فالخيارُ يُثبت نفسَه بنفسه.
   */
  const choose = (value: PerformanceProfile) => {
    setProfile(value);
    applyPerformance(value);
  };

  const facts: Record<PerformanceProfile, [string, string]> = {
    PERFORMANCE: [t.performance.minute, t.performance.full],
    BALANCED: [t.performance.fiveMinutes, t.performance.full],
    POWER_SAVING: [t.performance.quarterHour, t.performance.still],
  };

  const [refresh, motion] = facts[profile];

  return (
    <Stage
      stepKey="PERFORMANCE"
      title={t.performance.title}
      description={t.performance.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      primary={{
        label: t.common.continue,
        busy: submitting,
        onClick: () => void submit(() => submitPerformance(profile)),
      }}
    >
      <ChoiceGroup label={t.performance.title}>
        <Choice
          icon={Gauge}
          label={t.performance.balanced}
          hint={t.performance.balancedHint}
          selected={profile === "BALANCED"}
          onSelect={() => choose("BALANCED")}
        />
        <Choice
          icon={Zap}
          label={t.performance.performance}
          hint={t.performance.performanceHint}
          selected={profile === "PERFORMANCE"}
          onSelect={() => choose("PERFORMANCE")}
        />
        <Choice
          icon={Leaf}
          label={t.performance.powerSaving}
          hint={t.performance.powerSavingHint}
          selected={profile === "POWER_SAVING"}
          onSelect={() => choose("POWER_SAVING")}
        />
      </ChoiceGroup>

      {/*
        ما يتبدّل فعلاً — سطران لا قائمةُ وعود.

        و`aria-live` لأنّهما يتبدّلان بلا أن يتحرّك التركيز: من ينتقل
        بين الخيارات بلوحة المفاتيح لا يرى هذا الركن، فيُقرأ له.
      */}
      <div
        className="nx-list"
        style={{ marginTop: 14, maxWidth: "28rem" }}
        aria-live="polite"
      >
        <div className="nx-row">
          <div className="nx-row__body">
            <span className="nx-row__meta">{t.performance.refresh}</span>
            <span className="nx-row__label">{refresh}</span>
          </div>
        </div>

        <div className="nx-row">
          <div className="nx-row__body">
            <span className="nx-row__meta">{t.performance.motion}</span>
            <span className="nx-row__label">{motion}</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}
