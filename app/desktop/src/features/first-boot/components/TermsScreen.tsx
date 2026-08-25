/**
 * الشروط (§14).
 *
 * والموافقةُ **مطلوبةٌ فعلاً**: لا مضيَّ بدونها، ولا زرَّ «لاحقاً».
 * والسببُ ليس شكلياً — الخطواتُ التالية تُنشئ حساباً وتكتب بياناتِ
 * مؤسسةٍ في قاعدة، وذلك ما تصفه هذه الوثيقة.
 *
 * وتُسجَّل ثلاثةٌ لا واحد: **النسخةُ** التي وُوفق عليها، **ووقتُها**،
 * **ومَن** وافق. والأخيرُ يُملأ بعد خطوة المدير (لا مستخدمَ بعدُ حين
 * تُقبل الشروط) — فيصير للسجلّ صاحبٌ بدل أن يبقى معلَّقاً.
 *
 * والنصُّ يُقرأ في الشاشة نفسِها لا في نافذةٍ تُفتح: موافقةٌ على وثيقةٍ
 * تحتاج ثلاثَ نقراتٍ لرؤيتها موافقةٌ على غير مقروء.
 */

import { useState } from "react";

import { Stage } from "./Stage";
import { LEGAL } from "../content/legal";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useLanguage, useT, useTermsVersion } from "../hooks/useFirstBootState";
import { submitTerms } from "../services/firstBoot.service";

type Tab = "terms" | "privacy" | "license";

export function TermsScreen({ error }: { error: string | null }) {
  const t = useT();
  const language = useLanguage();
  const version = useTermsVersion();
  const { submit, back, canGoBack, submitting } = useFirstBoot("TERMS");

  const [tab, setTab] = useState<Tab>("terms");
  const [agreed, setAgreed] = useState(false);

  const document = LEGAL[language];

  return (
    <Stage
      stepKey="TERMS"
      title={t.terms.title}
      description={t.terms.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={`${t.terms.version} ${version}`}
      primary={{
        label: t.terms.action,
        busy: submitting,
        disabled: !agreed,
        onClick: () => void submit(() => submitTerms(version)),
      }}
    >
      <div style={{ display: "grid", gap: 12, maxWidth: "46rem" }}>
        <div style={{ display: "flex", gap: 6 }} role="tablist">
          {(["terms", "privacy", "license"] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              className={
                tab === key ? "nx-btn nx-btn--ghost" : "nx-btn nx-btn--quiet"
              }
              style={{ padding: "0.42rem 0.9rem", fontSize: "0.82rem" }}
              onClick={() => setTab(key)}
            >
              {t.terms.tabs[key]}
            </button>
          ))}
        </div>

        {/*
          مساحةُ القراءة محدودةُ الارتفاع وتُمرَّر.

          و`tabIndex={0}` عليها: صندوقٌ يُمرَّر ولا يُركَّز عليه لا
          يُمرَّر بلوحة المفاتيح — فمن لا يستعمل فأرةً لا يبلغ آخرَ
          الوثيقة (§45).
        */}
        <div
          role="tabpanel"
          tabIndex={0}
          style={{
            maxHeight: "34vh",
            overflowY: "auto",
            padding: "1rem 1.15rem",
            border: "1px solid var(--nx-line)",
            borderRadius: "var(--nx-radius)",
            background: "var(--nx-surface)",
            display: "grid",
            gap: "1rem",
          }}
        >
          {document[tab].map((section) => (
            <section key={section.heading} style={{ display: "grid", gap: 6 }}>
              <h2
                style={{
                  margin: 0,
                  fontSize: "0.95rem",
                  fontWeight: 800,
                  color: "var(--nx-ink)",
                }}
              >
                {section.heading}
              </h2>

              {section.paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  style={{
                    margin: 0,
                    fontSize: "0.86rem",
                    lineHeight: 1.75,
                    color: "var(--nx-ink-2)",
                  }}
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            cursor: "pointer",
            fontSize: "0.95rem",
            fontWeight: 600,
          }}
        >
          <input
            type="checkbox"
            checked={agreed}
            onChange={(event) => setAgreed(event.target.checked)}
            style={{ width: "1.05rem", height: "1.05rem", accentColor: "var(--nx-accent)" }}
          />
          {t.terms.agree}
        </label>
      </div>
    </Stage>
  );
}
