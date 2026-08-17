import { useState } from "react";
import { RotateCw } from "lucide-react";
import { StudentCardBack, StudentCardFront, CARD_H_MM, CARD_W_MM } from "./StudentCard";
import type { Enrollment, Student } from "./student.api";

/**
 * معاينة البطاقة على الشاشة — قلبٌ ثلاثي الأبعاد بين الوجهين.
 *
 * تفافٌ محضٌ حول `StudentCardFront`/`StudentCardBack`: لا بيانات هنا
 * ولا هوية مؤسسة، فكلاهما مُعرَّفان مرّة واحدة في `StudentCard.tsx`
 * ويُقرآن من صفّ الطالب و`school.store` مباشرة. فتغييرُ معلومات
 * الطالب أو شعار المؤسسة أو اسمها يظهر هنا فوراً دون أيّ تعديل —
 * هذا المكوّن لا يعرف عنهما شيئاً، فلا شيء فيه ليُحدَّث.
 *
 * والقلب هنا للشاشة فقط: ورقة الطباعة (`CardSheet`) تعرض الوجهين
 * متجاورين كما هما فعلاً على الورق، فلا معنى لتقليبٍ ثلاثي الأبعاد
 * هناك.
 *
 * والتكبير هنا `zoom` لا `transform: scale`: يُعيد المتصفّح توزيع
 * التخطيط على القياس الجديد (فالتلميح أسفل البطاقة يتبعها ولا
 * يتراكب معها)، وبلا أثرٍ على القياس الحقيقي بالمليمتر — ذاك من
 * `CARD_W_MM`/`CARD_H_MM` كما هو، والورقة المطبوعة لا تمرّ من هنا
 * أصلاً فلا تراه.
 */
export function StudentCardFlip({
  student,
  enrollments,
}: {
  student: Student;
  enrollments: Enrollment[] | null;
}) {
  const [flipped, setFlipped] = useState(false);
  const flip = () => setFlipped((f) => !f);

  return (
    <div className="inline-block" style={{ zoom: 1.18 }}>
      <div
        role="button"
        tabIndex={0}
        aria-label="اقلب البطاقة لرؤية الوجه الآخر"
        onClick={flip}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            flip();
          }
        }}
        className="cursor-pointer select-none outline-none"
        style={{
          width: `${CARD_W_MM}mm`,
          height: `${CARD_H_MM}mm`,
          perspective: "900px",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            transformStyle: "preserve-3d",
            transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <Face>
            <StudentCardFront student={student} enrollments={enrollments} />
          </Face>
          <Face back>
            <StudentCardBack />
          </Face>
        </div>
      </div>

      <button
        type="button"
        onClick={flip}
        className="mx-auto mt-3 flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold transition hover:bg-white/20"
      >
        <RotateCw className="h-3.5 w-3.5" />
        قلب البطاقة — الوجه {flipped ? "الأمامي" : "الخلفي"}
      </button>
    </div>
  );
}

function Face({ back, children }: { back?: boolean; children: React.ReactNode }) {
  return (
    <div
      className="rounded-[3.4mm] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]"
      style={{
        position: "absolute",
        inset: 0,
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg)" : undefined,
      }}
    >
      {children}
    </div>
  );
}
