/**
 * جاهز (§53).
 *
 * وهي الشاشةُ الوحيدةُ في التهيئة التي لا تطلب شيئاً — ولذلك هي التي
 * تُقرأ. أربعُ عشرةَ شاشةً سألت وطلبت وتحقّقت، وهذه تقول: انتهى.
 *
 * والحركةُ فيها الوحيدةُ التي يُسمح لها أن تُبطئ قليلاً: حلقةٌ تُرسم
 * مرّةً واحدةً حول الشعار. وما بعدها ليس شاشةً بل **انتقالٌ إلى
 * التطبيق** (§54) — تبقى هذه الطبقةُ منسحبةً فوق الغلافِ الجديد بدل
 * أن تُفكَّك في الإطار نفسِه الذي يُركَّب فيه، فلا يومض السوادُ بينهما.
 */

import nexschoolLogo from "../../../assets/nexschool/nexschool.png";
import { useT } from "../hooks/useFirstBootState";

export function ReadyScreen({ onEnter }: { onEnter: () => void }) {
  const t = useT();

  return (
    <div className="nx-center">
      <div style={{ position: "relative", display: "grid", placeItems: "center" }}>
        {/*
          حلقةٌ تنفتح مرّةً — لا نبضٌ لانهائيّ.

          فالنبضُ يعني «ينتظر منك شيئاً»، وهذه اللحظةُ نقيضُه: تمَّ
          الأمر. والحركةُ الواحدةُ التي تُغلق نفسَها تقول ذلك بلا كلام.
        */}
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "clamp(150px, 22vh, 240px)",
            height: "clamp(150px, 22vh, 240px)",
            borderRadius: 999,
            border: "1px solid color-mix(in srgb, var(--nx-accent) 45%, transparent)",
            animation: "nx-ready-ring 1400ms cubic-bezier(0.16, 1, 0.3, 1) both",
          }}
        />

        <img
          className="nx-mark nx-rise-1"
          src={nexschoolLogo}
          alt="NexSchool"
          draggable={false}
        />
      </div>

      <h1 className="nx-title nx-rise-2" tabIndex={-1}>
        {t.ready.title}
      </h1>

      <p className="nx-lead nx-rise-3">{t.ready.lead}</p>

      <button
        type="button"
        className="nx-btn nx-btn--primary nx-rise-4"
        onClick={onEnter}
        autoFocus
      >
        {t.ready.action}
      </button>

      {/*
        الحركةُ معرَّفةٌ هنا لا في ملفّ الأنماط: تخصّ هذه الشاشةَ وحدها
        ولا تُستعمل مرّةً أخرى في التطبيق كلِّه.
      */}
      <style>{`
        @keyframes nx-ready-ring {
          from { opacity: 0; transform: scale(0.6); }
          60%  { opacity: 1; }
          to   { opacity: 0.5; transform: scale(1); }
        }

        :root[data-motion="still"] [style*="nx-ready-ring"] { animation: none; }

        @media (prefers-reduced-motion: reduce) {
          [style*="nx-ready-ring"] { animation: none; }
        }
      `}</style>
    </div>
  );
}
