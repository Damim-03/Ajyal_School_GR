/**
 * المنطقة والوقت (§10).
 *
 * **والافتراضاتُ تُكتشف من النظام لا تُخمَّن**: `Intl` يعرف المنطقةَ
 * الزمنية للجهاز ولغتَه، فيُملأ الحقلان قبل أن يُسأل المستخدمُ عنهما.
 * وهو يعدّلهما إن شاء — لكنّ الأكثرَ أنّه يضغط «متابعة» فحسب، وهذه
 * هي الخطوةُ التي يجب ألّا تُبطئ أحداً.
 *
 * وقائمةُ المناطق من `Intl.supportedValuesOf` لا من جدولٍ مكتوب:
 * جداولُ IANA تتغيّر مع تحديثات النظام، وقائمةٌ مجمَّدةٌ في الشيفرة
 * ترفض بعد سنتين منطقةً صارت صحيحة.
 *
 * والمعاينةُ تُظهر التاريخَ والساعةَ بما اختير — فيُرى أثرُ الاختيار
 * لا يُوصف (§29).
 */

import { useMemo, useState } from "react";

import { Field, Stage } from "./Stage";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useFieldErrors, useT } from "../hooks/useFirstBootState";
import { submitRegion } from "../services/firstBoot.service";
import type { DateFormat } from "../types/firstBoot.types";

/**
 * الدولُ المعروضة — قائمةٌ قصيرةٌ يتصدّرها المحيطُ المستهدَف.
 *
 * ولا مئتا دولةٍ: هذا برنامجٌ يُباع في محيطٍ معلوم، وقائمةٌ من مئتين
 * تجعل المستخدمَ يبحث فيما لا يعنيه. و«أخرى» تحفظ الحالةَ النادرة
 * بلا أن تُثقل الشائعة.
 */
const COUNTRIES = [
  { code: "DZ", ar: "الجزائر", en: "Algeria", fr: "Algérie", tz: "Africa/Algiers" },
  { code: "TN", ar: "تونس", en: "Tunisia", fr: "Tunisie", tz: "Africa/Tunis" },
  { code: "MA", ar: "المغرب", en: "Morocco", fr: "Maroc", tz: "Africa/Casablanca" },
  { code: "LY", ar: "ليبيا", en: "Libya", fr: "Libye", tz: "Africa/Tripoli" },
  { code: "EG", ar: "مصر", en: "Egypt", fr: "Égypte", tz: "Africa/Cairo" },
  { code: "SA", ar: "السعودية", en: "Saudi Arabia", fr: "Arabie saoudite", tz: "Asia/Riyadh" },
  { code: "AE", ar: "الإمارات", en: "United Arab Emirates", fr: "Émirats arabes unis", tz: "Asia/Dubai" },
  { code: "FR", ar: "فرنسا", en: "France", fr: "France", tz: "Europe/Paris" },
  { code: "OTHER", ar: "أخرى", en: "Other", fr: "Autre", tz: "" },
] as const;

const DATE_FORMATS: DateFormat[] = ["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"];

/** المناطقُ المتاحةُ في هذه البيئة — والاحتياطُ منطقةُ الجهاز وحدها */
const timezones = (): string[] => {
  const supported = (
    Intl as unknown as { supportedValuesOf?: (key: string) => string[] }
  ).supportedValuesOf;

  const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (typeof supported !== "function") return [detected];

  try {
    return supported("timeZone");
  } catch {
    return [detected];
  }
};

const formatSample = (format: DateFormat, timezone: string, locale: string) => {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone || undefined,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((map, part) => {
      map[part.type] = part.value;
      return map;
    }, {});

  const date =
    format === "YYYY-MM-DD"
      ? `${parts.year}-${parts.month}-${parts.day}`
      : format === "MM/DD/YYYY"
        ? `${parts.month}/${parts.day}/${parts.year}`
        : `${parts.day}/${parts.month}/${parts.year}`;

  const time = new Intl.DateTimeFormat(locale, {
    timeZone: timezone || undefined,
    hour: "2-digit",
    minute: "2-digit",
  }).format(now);

  return `${date} — ${time}`;
};

export function RegionScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const fieldErrors = useFieldErrors();
  const { submit, back, canGoBack, submitting } = useFirstBoot("REGION");

  const zones = useMemo(() => timezones(), []);
  const systemZone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  );

  const [country, setCountry] = useState(answers.country || "DZ");
  const [timezone, setTimezone] = useState(
    answers.timezone ||
      COUNTRIES.find((entry) => entry.code === (answers.country || "DZ"))?.tz ||
      systemZone,
  );
  const [dateFormat, setDateFormat] = useState<DateFormat>(
    (answers.dateFormat as DateFormat) || "DD/MM/YYYY",
  );

  /*
   * تبديلُ الدولة يقترح منطقتَها — ولا يفرضها.
   *
   * فمؤسسةٌ في الجزائر قد يعمل خادمُها بتوقيتٍ آخر لسببٍ إداريّ، وحقلٌ
   * يُعاد ضبطُه كلّما لُمس ما فوقه يمنع تصحيحَه.
   */
  const onCountry = (code: string) => {
    setCountry(code);

    const suggested = COUNTRIES.find((entry) => entry.code === code)?.tz;

    if (suggested) setTimezone(suggested);
  };

  const label = (entry: (typeof COUNTRIES)[number]) =>
    t.meta.locale.startsWith("ar")
      ? entry.ar
      : t.meta.locale.startsWith("fr")
        ? entry.fr
        : entry.en;

  return (
    <Stage
      stepKey="REGION"
      title={t.region.title}
      description={t.region.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={t.region.detected}
      primary={{
        label: t.common.continue,
        busy: submitting,
        onClick: () =>
          void submit(() => submitRegion({ country, timezone, dateFormat })),
      }}
    >
      <div className="nx-fields nx-fields--two">
        <Field label={t.region.country} error={fieldErrors.country}>
          <select value={country} onChange={(e) => onCountry(e.target.value)}>
            {COUNTRIES.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {label(entry)}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.region.timezone} error={fieldErrors.timezone}>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            dir="ltr"
          >
            {/* منطقةُ الجهاز أوّلاً إن لم تكن في القائمة (بيئةٌ قديمة) */}
            {!zones.includes(timezone) && (
              <option value={timezone}>{timezone}</option>
            )}
            {zones.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.region.dateFormat} error={fieldErrors.dateFormat}>
          <select
            value={dateFormat}
            onChange={(e) => setDateFormat(e.target.value as DateFormat)}
            dir="ltr"
          >
            {DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {format}
              </option>
            ))}
          </select>
        </Field>

        <Field label={t.region.now}>
          {/*
            المعاينةُ ليست حقلاً — لكنّها في الشبكة نفسِها ليقع الجوابُ
            بإزاء السؤال: يبدّل المستخدمُ الصيغةَ فيرى الفرقَ في السطر
            المجاور بلا أن ينقل بصره.
          */}
          <div
            className="nx-row"
            style={{ justifyContent: "center", padding: "0.62rem 0.9rem" }}
            dir="ltr"
          >
            <span className="nx-row__label" style={{ fontWeight: 600 }}>
              {formatSample(dateFormat, timezone, t.meta.locale)}
            </span>
          </div>
        </Field>
      </div>
    </Stage>
  );
}
