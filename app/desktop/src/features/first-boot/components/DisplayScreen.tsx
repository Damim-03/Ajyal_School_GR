/**
 * العرض — **كلُّ خيارٍ هنا يُطبَّق وأنت تختاره** (§12).
 *
 * ولا معاينةَ مرسومة: المعاينةُ أدناه عناصرُ حقيقيةٌ ترث مقياسَ الجذر
 * وكثافةَ المسافات، فتكبر وتضيق مع الشاشة كلِّها. وصورةٌ ثابتةٌ لبطاقةٍ
 * «هكذا سيبدو» كانت ستكون رسماً لا معاينة (§29).
 *
 * وأثرُ كلٍّ منها حقيقيّ (‏`core/system/preferences.ts`):
 *   • المقياسُ يكتب `font-size` على الجذر — وTailwind يقيس بالـrem.
 *   • الكثافةُ تكتب `--spacing` — وهو ما تشتقّ منه كلُّ أدوات المسافة.
 *   • النافذةُ تُكبَّر أو تملأ الشاشةَ عبر Tauri فعلاً.
 */

import { useEffect, useState } from "react";
import {
  AppWindow, Expand, Maximize2, Monitor, Rows3, Rows4, ZoomIn, ZoomOut,
  type LucideIcon,
} from "lucide-react";

import { Choice, ChoiceGroup, Stage } from "./Stage";
import { applyDisplay } from "../services/initialization.service";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useT } from "../hooks/useFirstBootState";
import { submitDisplay } from "../services/firstBoot.service";
import { readPreferences } from "../../../core/system/preferences";
import type { Density, UiScale, WindowMode } from "../types/firstBoot.types";

export function DisplayScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const { submit, back, canGoBack, submitting } = useFirstBoot("DISPLAY");

  const stored = readPreferences();

  const [uiScale, setUiScale] = useState<UiScale>(
    (answers.uiScale as UiScale) || stored.uiScale,
  );
  const [density, setDensity] = useState<Density>(
    (answers.density as Density) || stored.density,
  );
  const [windowMode, setWindowMode] = useState<WindowMode>(
    (answers.windowMode as WindowMode) || stored.windowMode,
  );

  /*
   * التطبيقُ في تأثير، لا في معالج الضغط.
   *
   * فالحالةُ تُملأ أوّلاً ممّا حُفظ سابقاً، ومن رجع إلى هذه الشاشة يجب
   * أن يجد الواجهةَ على اختياره المحفوظ لا على ما تركته شاشةٌ أخرى.
   * والتأثيرُ يغطّي الحالتين: أوّلَ عرضٍ وكلَّ تبديل.
   */
  useEffect(() => {
    void applyDisplay({ uiScale, density, windowMode });
  }, [uiScale, density, windowMode]);

  return (
    <Stage
      stepKey="DISPLAY"
      title={t.display.title}
      description={t.display.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={t.display.previewHint}
      primary={{
        label: t.common.continue,
        busy: submitting,
        onClick: () =>
          void submit(() => submitDisplay({ uiScale, density, windowMode })),
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "1.2rem",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 0.9fr)",
          alignItems: "start",
        }}
      >
        <div style={{ display: "grid", gap: "1rem" }}>
          <ChoiceGroup label={t.display.scale}>
            <Choice
              icon={ZoomOut}
              label={t.display.small}
              selected={uiScale === "SMALL"}
              onSelect={() => setUiScale("SMALL")}
            />
            <Choice
              icon={Monitor}
              label={t.display.default}
              selected={uiScale === "DEFAULT"}
              onSelect={() => setUiScale("DEFAULT")}
            />
            <Choice
              icon={ZoomIn}
              label={t.display.large}
              selected={uiScale === "LARGE"}
              onSelect={() => setUiScale("LARGE")}
            />
          </ChoiceGroup>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {/*
              الكثافةُ والنافذةُ أزرارٌ صغيرةٌ لا صفوفٌ كبيرة.

              فتدرّجُ الحركة يقتضي تدرّجاً في الوزن (§7): المقياسُ هو
              القرارُ الأهمّ في هذه الشاشة، وإعطاءُ الثلاثة الوزنَ نفسَه
              كان سيجعلها ثلاثةَ قراراتٍ متساوية — وهي ليست كذلك.
            */}
            <ModeButton
              icon={Rows3}
              label={t.display.comfortable}
              active={density === "COMFORTABLE"}
              onClick={() => setDensity("COMFORTABLE")}
            />
            <ModeButton
              icon={Rows4}
              label={t.display.compact}
              active={density === "COMPACT"}
              onClick={() => setDensity("COMPACT")}
            />

            <span style={{ flexBasis: "100%" }} />

            <ModeButton
              icon={AppWindow}
              label={t.display.windowed}
              active={windowMode === "WINDOWED"}
              onClick={() => setWindowMode("WINDOWED")}
            />
            <ModeButton
              icon={Maximize2}
              label={t.display.maximized}
              active={windowMode === "MAXIMIZED"}
              onClick={() => setWindowMode("MAXIMIZED")}
            />
            <ModeButton
              icon={Expand}
              label={t.display.fullscreen}
              active={windowMode === "FULLSCREEN"}
              onClick={() => setWindowMode("FULLSCREEN")}
            />
          </div>
        </div>

        {/* المعاينة — عناصرُ حيّةٌ ترث المقياسَ والكثافة */}
        <div className="nx-preview" aria-hidden="true">
          <div className="nx-preview__bar">{t.display.previewTitle}</div>
          <div className="nx-preview__row">
            <span>{t.display.previewRow}</span>
            <span className="nx-tag">24</span>
          </div>
          <div className="nx-preview__row">
            <span>{t.display.previewRow}</span>
            <span className="nx-tag">18</span>
          </div>
          <div className="nx-preview__row">
            <span>{t.display.previewRow}</span>
            <span className="nx-tag">31</span>
          </div>
        </div>
      </div>
    </Stage>
  );
}

function ModeButton({
  label,
  active,
  onClick,
  icon: Icon,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  /** رمزٌ يسبق النصّ — الكثافةُ والنافذةُ تُميَّزان بالشكل قبل الاسم. */
  icon?: LucideIcon;
}) {
  return (
    <button
      type="button"
      className="nx-btn nx-toggle"
      aria-pressed={active}
      onClick={onClick}
    >
      {Icon && <Icon aria-hidden="true" size={15} strokeWidth={1.8} />}
      {label}
    </button>
  );
}
