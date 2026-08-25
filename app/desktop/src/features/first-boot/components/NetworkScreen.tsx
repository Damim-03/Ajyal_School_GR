/**
 * الشبكة — **وتصف معماريةَ هذا التطبيق لا معماريةً مستعارة** (§11/§35).
 *
 * لا واي‑فاي ولا كلمةَ مرورِ شبكة: NexSchool تطبيقُ سطحِ مكتبٍ مع خادمٍ
 * وقاعدةٍ إمّا على الجهاز نفسِه أو على جهاز الإدارة. فالسؤالُ الوحيدُ
 * الحقيقيّ هو: **أين الخادم؟**
 *
 * **والإنترنت ليس شرطاً — وصار يُقاس لا يُزعَم.**
 *
 * كان في ذيل الشاشة سطرٌ يقول «الإنترنت غيرُ مطلوب» ولا يفحص شيئاً.
 * وهو صادقٌ في معناه، لكنّه يترك السؤالَ الذي يسأله كلُّ من يرى شاشةً
 * عنوانُها «الشبكة» بلا جواب: **هل هذا الجهاز على الإنترنت أصلاً؟**
 *
 * فصار أوّلَ ما في الشاشة: سطرٌ يقول الجوابَ مقيساً — ومعه الطمأنة
 * التي كانت في الذيل، مقترنةً بحالتها لا معلّقةً في الفراغ. ومَن رأى
 * «بلا إنترنت» يقرأ في السطر نفسِه أنّ ذلك لا يضرّه.
 *
 * والقياسُ في `core/system/internet.ts`، وهناك شرحُ لماذا لا يكفي
 * `navigator.onLine` وحده.
 *
 * والفحصُ **حقيقيّ**: يُنادى `/system/first-boot/probe` على العنوان
 * المكتوب — لا على العنوان المعتمد — فيُقاس الخادمُ المقصودُ لا سواه.
 * والقاعدةُ والبنيةُ والصلاحياتُ تُسأل واحدةً واحدة، وما يُعرض هو ما
 * ردّ به الخادم (§29).
 *
 * والعنوانُ يُحفظ **في الجهاز**: هو طريقُه إلى القاعدة، وحفظُه فيها
 * دَورٌ مغلق (‏`core/api/base-url.ts`).
 */

import { useEffect, useState } from "react";
import {
  Database, Globe, HardDrive, Network, ShieldCheck, Table2, type LucideIcon,
} from "lucide-react";

import { Choice, ChoiceGroup, Field, Stage, StatusRow } from "./Stage";
import {
  apiBaseUrl,
  buildApiUrl,
  saveApiUrl,
} from "../../../core/api/base-url";
import { useInternet } from "../../../core/system/internet";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useAnswers, useT } from "../hooks/useFirstBootState";
import { probeAt, submitNetwork } from "../services/firstBoot.service";
import { hostValid, portValid } from "../utils/validation";
import { readDraft, saveDraft } from "../utils/recovery";
import type { NetworkMode, ProbeResult } from "../types/firstBoot.types";

interface Draft {
  mode: NetworkMode;
  host: string;
  port: string;
}

/** يُقرأ العنوانُ المعتمدُ ليُملأ الحقلان بما يعمل الآن لا بفراغ */
const splitCurrent = (): { host: string; port: string } => {
  try {
    const url = new URL(apiBaseUrl());

    return {
      host: url.hostname,
      port: url.port || (url.protocol === "https:" ? "443" : "80"),
    };
  } catch {
    return { host: "localhost", port: "3001" };
  }
};

export function NetworkScreen({ error }: { error: string | null }) {
  const t = useT();
  const answers = useAnswers();
  const { submit, back, canGoBack, submitting } = useFirstBoot("NETWORK");

  const current = splitCurrent();
  const draft = readDraft<Draft>("NETWORK");

  const [mode, setMode] = useState<NetworkMode>(
    (answers.networkMode as NetworkMode) || draft?.mode || "LOCAL",
  );
  const [host, setHost] = useState(draft?.host || current.host);
  const [port, setPort] = useState(draft?.port || current.port);

  /*
   * الوضعُ المحلّيُّ يبدأ فاحصاً: لا شيءَ يُكتب فيه ولا شيءَ يُنتظر من
   * المستخدم — فيُقاس من نفسه عند العرض. والبدءُ بـ`true` هنا لا
   * `setProbing(true)` في التأثير: كتابةُ حالةٍ متزامنةٌ داخل تأثيرٍ
   * تُنتج تصييراً متتالياً بلا داعٍ.
   */
  const [probing, setProbing] = useState(
    ((answers.networkMode as NetworkMode) || draft?.mode || "LOCAL") === "LOCAL",
  );
  const [result, setResult] = useState<ProbeResult | null>(null);
  const [probeFailed, setProbeFailed] = useState(false);

  /** حالةُ إنترنت هذا الجهاز — إخبارٌ لا شرط: لا تمنع المتابعة. */
  const internet = useInternet();

  useEffect(() => {
    saveDraft("NETWORK", { mode, host, port });
  }, [mode, host, port]);

  const target =
    mode === "LOCAL" ? apiBaseUrl() : buildApiUrl(host, port);

  const inputsValid =
    mode === "LOCAL" || (hostValid(host) && portValid(port));

  const runProbe = async () => {
    if (!inputsValid) return;

    setProbing(true);
    setProbeFailed(false);
    setResult(null);

    try {
      setResult(await probeAt(target));
    } catch {
      /*
       * لا تُعرض «✓ متّصل» ولا «✗» لكلّ سطرٍ على حدة حين يسقط الطلبُ
       * كلُّه: السقوطُ يعني أنّ **الخادمَ** لم يُبلَغ، لا أنّ قاعدتَه
       * ساقطة. والتمييزُ بينهما هو الفرقُ بين إصلاحٍ في دقيقة وبحثٍ
       * في المكان الخطأ.
       */
      setProbeFailed(true);
    } finally {
      setProbing(false);
    }
  };

  /*
   * فحصُ الوضع المحلّي — **والتأثيرُ لا يكتب إلّا بعد الردّ**.
   *
   * وتصفيرُ النتيجة عند تبديل الوضع محلُّه معالجُ الضغط (`chooseMode`)
   * لا هذا التأثير: التبديلُ حدثٌ من المستخدم، والحدثُ هو موضعُ
   * الكتابة الطبيعيّ.
   */
  useEffect(() => {
    if (mode !== "LOCAL") return;

    let alive = true;

    probeAt(apiBaseUrl())
      .then((probed) => {
        if (!alive) return;
        setResult(probed);
        setProbing(false);
      })
      .catch(() => {
        if (!alive) return;
        setProbeFailed(true);
        setProbing(false);
      });

    return () => {
      alive = false;
    };
  }, [mode]);

  /** تبديلُ الوضع — يُصفّر ما قِيس للوضع السابق */
  const chooseMode = (next: NetworkMode) => {
    setMode(next);
    setResult(null);
    setProbeFailed(false);
    setProbing(next === "LOCAL");
  };

  const reachable = result !== null && result.database && result.schema;

  const onContinue = () => {
    /*
     * العنوانُ يُعتمد **قبل** إرسال الخطوة — والترتيبُ لازم: الإرسالُ
     * نفسُه يذهب إلى الخادم، فلو أُرسل أوّلاً لذهب إلى القديم ثمّ
     * بُدِّل العنوان، فتُكتب الخطوةُ في قاعدةٍ والباقي في أخرى.
     */
    if (mode === "SERVER") saveApiUrl(target);
    else saveApiUrl("");

    void submit(() => submitNetwork(mode));
  };

  const row = (label: string, ok: boolean | undefined, icon: LucideIcon) => (
    <StatusRow
      label={label}
      icon={icon}
      state={probing ? "busy" : ok === undefined ? "idle" : ok ? "ok" : "bad"}
      trailing={
        ok === undefined ? null : (
          <span className={ok ? "nx-tag nx-tag--ok" : "nx-tag nx-tag--bad"}>
            {ok ? t.network.reachable : t.network.unreachable}
          </span>
        )
      }
    />
  );

  return (
    <Stage
      stepKey="NETWORK"
      title={t.network.title}
      description={t.network.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      /*
        الطمأنةُ انتقلت إلى سطر الإنترنت في المتن — حيث تقترن بحالتها.
        وبقاؤها هنا كان سيكرّرها مرّتين في شاشةٍ واحدة، إحداهما مقيسةٌ
        والأخرى مزعومة.
      */
      secondary={
        mode === "SERVER"
          ? {
              label: probing ? t.network.testing : t.network.test,
              onClick: () => void runProbe(),
              disabled: probing || !inputsValid,
            }
          : undefined
      }
      primary={{
        label: t.common.continue,
        busy: submitting,
        /*
         * لا متابعةَ قبل فحصٍ ناجح.
         *
         * وهذا القيدُ هو ما يجعل الخطوةَ ذاتَ معنى: الخطواتُ التالية
         * كلُّها تكتب في القاعدة، فالمضيُّ بعنوانٍ لم يُبلَغ يعني أن
         * تسقط الخطوةُ التالية بخطأٍ غامضٍ بدل أن تسقط هذه بخطأٍ مفهوم.
         */
        disabled: !reachable,
        onClick: onContinue,
      }}
    >
      {/*
        ===== ① هل هذا الجهاز على الإنترنت؟ =====

        قبل سؤال «أين الخادم؟» عمداً: هذا جوابٌ عن الحاضر، وذاك قرارٌ
        يُتّخذ. والقارئُ يطمئنّ قبل أن يُطلب منه أن يقرّر.
      */}
      <div className="nx-list">
        <StatusRow
          icon={Globe}
          label={t.network.internet}
          state={
            internet.status === "CHECKING"
              ? "busy"
              : internet.status === "ONLINE"
                ? "ok"
                : /*
                     `"idle"` لا `"bad"`: غيابُ الإنترنت **ليس عطلاً** في
                     هذا التطبيق. ولو صُبغ أحمرَ لظنّ المستخدمُ أنّ عليه
                     إصلاحَ شيءٍ قبل أن يُكمل — وهو ليس كذلك.
                  */ "idle"
          }
          trailing={
            <span className="nx-trail">
              <span
                className={
                  internet.status === "ONLINE" ? "nx-tag nx-tag--ok" : "nx-tag"
                }
              >
                {internet.status === "ONLINE"
                  ? t.network.internetOnline
                  : t.network.internetOffline}
              </span>

              <button type="button" className="nx-recheck" onClick={internet.recheck}>
                {t.network.internetRecheck}
              </button>
            </span>
          }
        />
      </div>

      {/*
        الطمأنةُ مقترنةٌ بحالتها لا معلّقةٌ في ذيل الشاشة.

        وأثناء الفحص يُعرض النصُّ العامّ — فهو صحيحٌ في الحالات الثلاث،
        ولا يترك السطرَ فارغاً فيقفز التخطيطُ حين يصل الجواب.
      */}
      <p className="nx-hint" style={{ marginTop: 10, marginBottom: 18 }}>
        {internet.status === "CHECKING"
          ? t.network.internetOptional
          : internet.status === "ONLINE"
            ? t.network.internetOnlineHint
            : t.network.internetOfflineHint}
      </p>

      <ChoiceGroup label={t.network.title}>
        <Choice
          icon={HardDrive}
          label={t.network.local}
          hint={t.network.localHint}
          selected={mode === "LOCAL"}
          onSelect={() => chooseMode("LOCAL")}
        />
        <Choice
          icon={Network}
          label={t.network.server}
          hint={t.network.serverHint}
          selected={mode === "SERVER"}
          onSelect={() => chooseMode("SERVER")}
        />
      </ChoiceGroup>

      {mode === "SERVER" && (
        <div className="nx-fields nx-fields--two" style={{ marginTop: 14 }}>
          <Field label={t.network.host}>
            <input
              value={host}
              onChange={(e) => setHost(e.target.value)}
              dir="ltr"
              placeholder="192.168.1.20"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <Field label={t.network.port}>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              dir="ltr"
              inputMode="numeric"
              placeholder="3001"
            />
          </Field>
        </div>
      )}

      <div className="nx-list" style={{ marginTop: 14 }}>
        {probeFailed ? (
          <div className="nx-alert" role="status">
            {t.network.failed}
          </div>
        ) : (
          <>
            {row(t.network.database, result?.database, Database)}
            {row(t.network.schema, result?.schema, Table2)}
            {row(t.network.auth, result?.auth, ShieldCheck)}
          </>
        )}
      </div>
    </Stage>
  );
}
