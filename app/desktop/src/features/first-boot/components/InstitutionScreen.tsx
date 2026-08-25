/**
 * هويةُ المؤسسة — **الأساسيُّ وحدَه** (§18).
 *
 * ولا مادّةَ ولا أستاذَ ولا فوجَ ولا سعر. والقيدُ ليس تنظيمياً: هذه
 * الشاشةُ تُعرض على من يفتح البرنامجَ لأوّل مرّة، ووضعُ بناءِ المؤسسة
 * فيها يعني استمارةً بأربعين حقلاً في اللحظة التي يجب أن يشعر فيها
 * بأنّ الأمرَ يسير. والبناءُ بعد الدخول، تدريجاً (§31).
 *
 * وما يُكتب هنا يذهب إلى مفاتيح `school.*` نفسِها التي تقرؤها
 * الترويسةُ وكلُّ مطبوعة — لا إلى مفاتيحَ موازيةٍ تُنسخ لاحقاً.
 *
 * والشعارُ يُرفع إلى مسارٍ في وحدة النظام يمرّ بمُهيّئ الرفع نفسِه
 * الذي يخدم `/api/uploads` — ويُغلق فور اكتمال التهيئة. وهو
 * **اختياريٌّ صريح**: مؤسسةٌ لا تملك ملفَّ شعارها في هذه اللحظة لا
 * تُحبس لأجله (§63).
 */

import { useEffect, useRef, useState } from "react";

import { Field, Stage } from "./Stage";
import { apiBaseUrl } from "../../../core/api/base-url";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useFieldErrors, useT } from "../hooks/useFirstBootState";
import { submitInstitution } from "../services/firstBoot.service";
import { readDraft, saveDraft } from "../utils/recovery";
import { emailValid, institutionNameValid } from "../utils/validation";

interface Draft {
  name: string;
  shortName: string;
  nameEn: string;
  phone: string;
  email: string;
  address: string;
  logoPath: string;
}

export function InstitutionScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const fieldErrors = useFieldErrors();
  const { submit, back, canGoBack, submitting } = useFirstBoot("INSTITUTION");

  const draft = readDraft<Draft>("INSTITUTION");
  const saved = answers.institution;

  const [form, setForm] = useState<Draft>({
    name: saved.name || draft?.name || "",
    shortName: saved.shortName || draft?.shortName || "",
    nameEn: saved.nameEn || draft?.nameEn || "",
    phone: saved.phone || draft?.phone || "",
    email: saved.email || draft?.email || "",
    address: saved.address || draft?.address || "",
    logoPath: saved.logoPath || draft?.logoPath || "",
  });

  const [uploading, setUploading] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  /*
   * المسوّدةُ تُحفظ عند كلّ تبديل.
   *
   * وهذه الشاشةُ أطولُ ما في التهيئة: ستّةُ حقولٍ يُكتب فيها اسمُ
   * مؤسسةٍ وعنوانُها وهاتفُها. وانقطاعُ تيّارٍ قبل «متابعة» كان يعني
   * إعادةَ كتابتها كلِّها — عقوبةٌ على حادثٍ لا ذنبَ للمستخدم فيه (§26).
   */
  useEffect(() => {
    saveDraft("INSTITUTION", form);
  }, [form]);

  const set = (key: keyof Draft, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const uploadLogo = async (file: File) => {
    setUploading(true);
    setUploadFailed(false);

    try {
      const body = new FormData();
      body.append("file", file);

      /*
       * `fetch` لا `apiClient`: مسارُ الرفع العامّ (`/api/uploads`)
       * خلف المصادقة، ولا توكنَ في التهيئة. فللشعار مسارٌ في وحدة
       * النظام يمرّ بمُهيّئ الرفع نفسِه (المجلَّد والحدُّ والامتدادات)
       * ويُغلق فور اكتمال التهيئة.
       *
       * وسقوطُه لا يوقف شيئاً: الشعارُ اختياريّ، ويُضاف من الإعدادات
       * بعد الدخول.
       */
      const response = await fetch(`${apiBaseUrl()}/system/first-boot/logo`, {
        method: "POST",
        body,
        credentials: "include",
      });

      if (!response.ok) throw new Error("upload failed");

      const data = (await response.json()) as { data?: { path?: string } };
      const path = data.data?.path ?? "";

      if (!path) throw new Error("no path");

      set("logoPath", path);
    } catch {
      setUploadFailed(true);
    } finally {
      setUploading(false);
    }
  };

  const ready = institutionNameValid(form.name) && emailValid(form.email);

  return (
    <Stage
      stepKey="INSTITUTION"
      title={t.institution.title}
      description={t.institution.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={t.institution.later}
      primary={{
        label: t.common.continue,
        busy: submitting,
        disabled: !ready,
        onClick: () =>
          void submit(() =>
            submitInstitution({
              name: form.name.trim(),
              shortName: form.shortName.trim(),
              nameEn: form.nameEn.trim(),
              phone: form.phone.trim(),
              email: form.email.trim(),
              address: form.address.trim(),
              logoPath: form.logoPath,
            }),
          ),
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "1.4rem",
          gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 0.7fr)",
          alignItems: "start",
        }}
      >
        <div className="nx-fields nx-fields--two">
          <Field label={t.institution.name} error={fieldErrors.name}>
            <input
              value={form.name}
              onChange={(event) => set("name", event.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label={`${t.institution.shortName} — ${t.common.optional}`}>
            <input
              value={form.shortName}
              onChange={(event) => set("shortName", event.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label={`${t.institution.nameEn} — ${t.common.optional}`}>
            <input
              value={form.nameEn}
              onChange={(event) => set("nameEn", event.target.value)}
              dir="ltr"
              autoComplete="off"
            />
          </Field>

          <Field label={`${t.institution.phone} — ${t.common.optional}`}>
            <input
              value={form.phone}
              onChange={(event) => set("phone", event.target.value)}
              dir="ltr"
              autoComplete="off"
            />
          </Field>

          <Field
            label={`${t.institution.email} — ${t.common.optional}`}
            error={fieldErrors.email}
          >
            <input
              value={form.email}
              onChange={(event) => set("email", event.target.value)}
              dir="ltr"
              type="email"
              autoComplete="off"
            />
          </Field>

          <Field label={`${t.institution.address} — ${t.common.optional}`}>
            <input
              value={form.address}
              onChange={(event) => set("address", event.target.value)}
              autoComplete="off"
            />
          </Field>
        </div>

        {/* الشعار — اختياريٌّ، ويُعرض ما رُفع فعلاً لا رمزٌ مكانه */}
        <div style={{ display: "grid", gap: 10, justifyItems: "start" }}>
          <span
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              letterSpacing: "0.04em",
              color: "var(--nx-ink-3)",
            }}
          >
            {t.institution.logo} — {t.common.optional}
          </span>

          <div
            style={{
              width: "7.5rem",
              height: "7.5rem",
              borderRadius: "var(--nx-radius)",
              border: "1px solid var(--nx-line)",
              background: "var(--nx-surface)",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            {form.logoPath ? (
              <img
                src={`${apiBaseUrl().replace(/\/api$/, "")}${form.logoPath}`}
                alt=""
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            ) : (
              <span className="nx-hint">{uploading ? "…" : "—"}</span>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void uploadLogo(file);
            }}
          />

          <div style={{ display: "flex", gap: 6 }}>
            <button
              type="button"
              className="nx-btn nx-btn--ghost"
              style={{ padding: "0.42rem 0.85rem", fontSize: "0.8rem" }}
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {t.institution.logoAction}
            </button>

            {form.logoPath && (
              <button
                type="button"
                className="nx-btn nx-btn--quiet"
                style={{ fontSize: "0.8rem" }}
                onClick={() => set("logoPath", "")}
              >
                {t.institution.logoRemove}
              </button>
            )}
          </div>

          <span className="nx-hint">
            {uploadFailed ? t.errors.generic : t.institution.logoHint}
          </span>
        </div>
      </div>
    </Stage>
  );
}
