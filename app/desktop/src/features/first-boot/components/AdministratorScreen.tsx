/**
 * المدير — الخطوةُ التي تُنشئ حساباً حقيقياً في القاعدة (§17).
 *
 * وثلاثةُ قيودٍ تحكمها:
 *
 * **① لا مسوّدةَ لهذه الشاشة.** ما يُكتب فيها لا يُحفظ في تخزين
 * المتصفّح ولو انقطع التيّار — لأنّ فيه كلمةَ مرور. و`recovery.ts`
 * يمنعها بقائمةٍ صريحة، فلا يُعتمد على تذكّرِ من يعدّل.
 *
 * **② السياسةُ تُرى وهي تُستوفى.** خمسُ قواعدَ تُضيء واحدةً واحدةً
 * أثناء الكتابة، لا رسالةَ خطأٍ بعد الضغط. والفرقُ أنّ الأولى تُعلّم
 * والثانيةُ تُعاقب.
 *
 * **③ لا رجوعَ بعدها** (§44). فالحسابُ يُنشأ ولا يُلغى بزرّ، وزرُّ
 * رجوعٍ يوحي بأنّه سيُلغى — فيُخفى. والخادمُ يرفض الرجوعَ أيضاً، فلا
 * يُعتمد على الإخفاء وحدَه.
 */

import { useState } from "react";

import { Field, Stage } from "./Stage";
import { useFirstBoot } from "../hooks/useFirstBoot";
import { useFieldErrors, useT } from "../hooks/useFirstBootState";
import { submitAdministrator } from "../services/firstBoot.service";
import {
  checkPassword,
  emailValid,
  passwordSatisfied,
  suggestUsername,
  usernameValid,
} from "../utils/validation";

export function AdministratorScreen({ error }: { error: string | null }) {
  const t = useT();
  const fieldErrors = useFieldErrors();
  const { submit, back, canGoBack, submitting } = useFirstBoot("ADMINISTRATOR");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  /** هل لمس المستخدمُ حقلَ الاسم؟ — بعدها لا يُقترح عليه شيء */
  const [usernameTouched, setUsernameTouched] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const rules = checkPassword(password);
  const matched = password !== "" && password === confirm;

  const ready =
    firstName.trim().length >= 2 &&
    lastName.trim().length >= 2 &&
    usernameValid(username) &&
    emailValid(email) &&
    passwordSatisfied(password) &&
    matched;

  /*
   * اقتراحُ اسم الدخول يتبع الاسمَ ما لم يُلمس حقلُه.
   *
   * والقيدُ الثاني هو المهمّ: من كتب اسمَ دخولٍ بيده ثمّ صحّح لقبَه
   * يجب ألّا يُدهَس ما كتب. والاقتراحُ راحةٌ لا وصاية.
   */
  const onName = (which: "first" | "last", value: string) => {
    const next = {
      firstName: which === "first" ? value : firstName,
      lastName: which === "last" ? value : lastName,
    };

    if (which === "first") setFirstName(value);
    else setLastName(value);

    if (!usernameTouched) {
      setUsername(suggestUsername(next.firstName, next.lastName));
    }
  };

  return (
    <Stage
      stepKey="ADMINISTRATOR"
      title={t.administrator.title}
      description={t.administrator.description}
      error={error}
      onBack={canGoBack ? () => void back() : undefined}
      footNote={t.administrator.role}
      primary={{
        label: t.administrator.action,
        busy: submitting,
        disabled: !ready,
        onClick: () =>
          void submit(() =>
            submitAdministrator({
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              username: username.trim(),
              ...(email.trim() ? { email: email.trim() } : {}),
              password,
              confirmPassword: confirm,
            }),
          ),
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "1.4rem",
          gridTemplateColumns: "minmax(0, 1.35fr) minmax(0, 1fr)",
          alignItems: "start",
        }}
      >
        <div className="nx-fields nx-fields--two">
          <Field label={t.administrator.firstName} error={fieldErrors.firstName}>
            <input
              value={firstName}
              onChange={(event) => onName("first", event.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field label={t.administrator.lastName} error={fieldErrors.lastName}>
            <input
              value={lastName}
              onChange={(event) => onName("last", event.target.value)}
              autoComplete="off"
            />
          </Field>

          <Field
            label={t.administrator.username}
            error={fieldErrors.username}
            hint={t.administrator.usernameHint}
          >
            <input
              value={username}
              onChange={(event) => {
                setUsernameTouched(true);
                setUsername(event.target.value);
              }}
              dir="ltr"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <Field
            label={`${t.administrator.email} — ${t.common.optional}`}
            error={fieldErrors.email}
          >
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              dir="ltr"
              type="email"
              spellCheck={false}
              autoComplete="off"
            />
          </Field>

          <Field label={t.administrator.password} error={fieldErrors.password}>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              dir="ltr"
              autoComplete="new-password"
            />
          </Field>

          <Field
            label={t.administrator.confirm}
            error={fieldErrors.confirmPassword}
          >
            <input
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              type="password"
              dir="ltr"
              autoComplete="new-password"
            />
          </Field>
        </div>

        {/*
          سياسةُ كلمة المرور — قائمةٌ تُضيء وهي تُستوفى.

          و`aria-live` عليها: من يكتب بلوحة المفاتيح ولا يرى القائمةَ
          يُعلَن له ما استوفى. ولولا ذلك لكان الزرُّ يُقفل بلا سببٍ
          مسموع (§45).
        */}
        <div
          className="nx-list"
          style={{ gap: 6 }}
          aria-live="polite"
          aria-label={t.administrator.password}
        >
          {rules.map((rule) => (
            <PolicyLine
              key={rule.key}
              ok={rule.ok}
              label={t.administrator.rules[rule.key]}
            />
          ))}

          <PolicyLine ok={matched} label={t.administrator.rules.match} />
        </div>
      </div>
    </Stage>
  );
}

function PolicyLine({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        fontSize: "0.84rem",
        color: ok ? "var(--nx-ink)" : "var(--nx-ink-3)",
        transition: "color 200ms ease",
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "0.42rem",
          height: "0.42rem",
          borderRadius: 999,
          flex: "none",
          background: ok ? "var(--nx-accent)" : "var(--nx-line-2)",
          transition: "background 200ms ease",
        }}
      />
      {label}
    </div>
  );
}
