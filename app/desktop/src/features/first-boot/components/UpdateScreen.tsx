/**
 * التحديث — **الشاشةُ التي رفضت أن تكذب** (§15/§36).
 *
 * المطلوبُ منها في التصميم الأصليّ: «جارٍ البحث… ✓ محدَّث» أو
 * «تحميل… تثبيت… لا تُغلق». وهذه أسهلُ شاشةٍ تُزيَّف في التطبيق كلِّه:
 * ثلاثةُ مؤقّتاتٍ وشريطُ تقدّمٍ يتحرّك من نفسه.
 *
 * ولا مُحدِّثَ في هذا التركيب: لا لاحقةَ `updater` في Cargo ولا إعدادَ
 * لها في `tauri.conf.json`. فالشاشةُ تقول ذلك صراحةً وتمضي — وهو ما
 * يوجبه §36: «إذا كان update غير متاح، يجب أن يكون النظام قادراً على
 * إكمال First Boot بطريقة آمنة».
 *
 * وما تفعله بدلَه **حقيقيٌّ ونافع**: تصالح بين نسخة النافذة ونسخة
 * الخادم. وهذا أكثرُ ما يُعطب هذه التركيبةَ فعلاً — تُحدَّث إحداهما
 * وتبقى الأخرى، فتُنادى مساراتٌ لا توجد. والتحذيرُ لا يمنع المضيَّ:
 * هو خبرٌ يُقرأ، لا حاجزٌ يُقام على ما قد يكون مقصوداً.
 */

import { AppWindow, Server } from "lucide-react";
import { useEffect, useState } from "react";

import { Stage, StatusRow } from "./Stage";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useT } from "../hooks/useFirstBootState";
import { submitUpdate } from "../services/firstBoot.service";
import { checkForUpdates, type UpdateReport } from "../services/update.service";

export function UpdateScreen({ error }: { error: string | null }) {
  const t = useT();
  const { submit, back, canGoBack, submitting } = useFirstBoot("UPDATE");

  const [checking, setChecking] = useState(true);
  const [report, setReport] = useState<UpdateReport | null>(null);

  const run = async () => {
    setChecking(true);

    try {
      setReport(await checkForUpdates());
    } finally {
      setChecking(false);
    }
  };

  /* كما في «الأجهزة»: الحالةُ تبدأ فاحصةً، ولا تُكتب إلّا بعد الردّ */
  useEffect(() => {
    let alive = true;

    checkForUpdates()
      .then((result) => {
        if (!alive) return;
        setReport(result);
        setChecking(false);
      })
      .catch(() => {
        if (alive) setChecking(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const description = checking
    ? t.update.checking
    : report?.available
      ? t.update.available
      : report && !report.aligned
        ? t.update.mismatch
        : t.update.upToDate;

  return (
    <Stage
      stepKey="UPDATE"
      title={t.update.title}
      description={description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={
        report?.channel === "MANUAL" ? t.update.notConfiguredHint : undefined
      }
      secondary={
        checking
          ? undefined
          : { label: t.update.recheck, onClick: () => void run() }
      }
      primary={{
        label: t.common.continue,
        busy: submitting,
        /*
         * لا يُمنع المضيُّ ولو اختلفت النسختان.
         *
         * فقد تكون المؤسسةُ في وسط ترقيةٍ مقصودة، ومنعُها يعني تعطيلَ
         * التركيب لأجل خبرٍ يكفي أن يُقرأ. والمنعُ يكون حيث يستحيل
         * العمل — وهو ما تقرّره شاشةُ التحقّق النهائي لا هذه.
         */
        disabled: checking,
        onClick: () =>
          void submit(() =>
            submitUpdate({
              appVersion: report?.appVersion ?? "",
              channel: report?.channel ?? "NONE",
            }),
          ),
      }}
    >
      <div className="nx-list">
        <StatusRow
          icon={AppWindow}
          label={t.update.appVersion}
          meta={report?.appVersion}
          state={checking ? "busy" : "ok"}
          trailing={<span className="nx-tag">{report?.appVersion ?? "—"}</span>}
        />

        <StatusRow
          icon={Server}
          label={t.update.serverVersion}
          state={
            checking
              ? "busy"
              : report?.serverUnreachable
                ? "bad"
                : report?.aligned
                  ? "ok"
                  : "bad"
          }
          trailing={
            <span
              className={
                report?.serverUnreachable || report?.aligned === false
                  ? "nx-tag nx-tag--bad"
                  : "nx-tag nx-tag--ok"
              }
            >
              {report?.serverUnreachable
                ? t.network.unreachable
                : report?.serverVersion || "—"}
            </span>
          }
        />
      </div>

      {!checking && report?.channel === "MANUAL" && (
        <p className="nx-hint" style={{ marginTop: 12, maxWidth: "44rem" }}>
          {t.update.notConfigured}
        </p>
      )}

      {!checking && report && !report.aligned && (
        <p className="nx-hint" style={{ marginTop: 8, maxWidth: "44rem" }}>
          {t.update.mismatchHint}
        </p>
      )}

      {/*
        وجودُ تحديثٍ أصليّ — المسارُ الذي يعمل يومَ تُضاف اللاحقة.

        ولا يُعرض اليومَ لأنّ `available` تكون `null` دائماً بلا مُحدِّث.
        وكتابتُه الآن تعني أنّ إضافةَ اللاحقة تكفي وحدَها — بلا شاشةٍ
        جديدةٍ تُكتب في حينها على عجل.
      */}
      {report?.available && (
        <div className="nx-row" style={{ marginTop: 12, maxWidth: "44rem" }}>
          <div className="nx-row__body">
            <span className="nx-row__label">
              {t.update.available} — {report.available.version}
            </span>
            {report.available.notes && (
              <span className="nx-row__meta">{report.available.notes}</span>
            )}
          </div>
        </div>
      )}
    </Stage>
  );
}
