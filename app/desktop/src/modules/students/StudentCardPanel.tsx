import { useEffect, useState } from "react";
import { Loader2, Printer, Scan } from "lucide-react";

import { SheetPreview } from "../../components/print/SheetPreview";
import { useSchoolStore } from "../../core/stores/school.store";
import {
  CARD_H_MM,
  CARD_W_MM,
  StudentCardBack,
  StudentCardFront,
  schoolingOf,
} from "./StudentCard";
import { getStudentEnrollments, type Enrollment, type Student } from "./student.api";

/**
 * قسم البطاقة في ملفّ الطالب — الوجهان معروضان بمقاسهما الحقيقي.
 *
 * ولا يُصغَّران في المعاينة: 85.6 مم تدخل الشاشة كما هي، ورؤيتها
 * بحجمها تُغني عن طباعةِ نسخةٍ لقياس ما إن كان النصّ يُقرأ.
 *
 * والتسجيلات تُجلب هنا لا في البطاقة: المستوى والطور يمرّان عبرها،
 * والبطاقة مكوّنُ عرضٍ محضٌ يُعطى ما يرسمه — فالورقة المطبوعة
 * والمعاينة يقرآن المصدر نفسه.
 */
export function StudentCardPanel({ student }: { student: Student }) {
  const [enrollments, setEnrollments] = useState<Enrollment[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [printing, setPrinting] = useState(false);

  const nameAr = useSchoolStore((s) => s.settings["school.name_ar"]);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    getStudentEnrollments(student.id)
      .then((rows) => alive && setEnrollments(rows))
      /*
       * فشلُ الجلب لا يمنع البطاقة: الاسم والرقم والصورة والباركود
       * كلُّها من صفّ الطالب. يغيب المستوى والطور وحدهما فتُكتب «—».
       */
      .catch(() => alive && setEnrollments([]))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [student.id]);

  const schooling = schoolingOf(enrollments);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex-1">
          <h3 className="text-sm font-black">بطاقة الطالب</h3>
          <p className="mt-0.5 text-[11px] text-white/40">
            85.6 × 54 مم — مقاس بطاقة البنك. تُطبع على A4 ثمّ تُقصّ.
          </p>
        </div>

        <button
          onClick={() => setPrinting(true)}
          disabled={loading}
          className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20 disabled:opacity-40"
        >
          <Printer className="h-4 w-4" />
          طباعة البطاقة
        </button>
      </div>

      {loading ? (
        <div className="grid place-items-center py-14 text-white/40">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-start gap-6">
            <CardFace label="الوجه الأمامي">
              <StudentCardFront student={student} enrollments={enrollments} />
            </CardFace>

            <CardFace label="الوجه الخلفي">
              <StudentCardBack />
            </CardFace>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-3 text-[11px] leading-relaxed text-white/45">
            <Scan className="h-4 w-4 shrink-0 text-white/30" />
            <span className="flex-1">
              الباركود يشفّر رقم الطالب{" "}
              <span className="font-bold text-white/70" dir="ltr">
                {student.studentNumber}
              </span>
              . امسحه وأنت في خانة البحث بقائمة الطلبة فيُفتح ملفّه — الماسح يكتب
              الرقم كما تكتبه لوحة المفاتيح.
            </span>
          </div>

          {!schooling && (
            <p className="text-[11px] text-amber-200/70">
              لا تسجيل لهذا الطالب بعد، فالمستوى والطور يظهران فارغين على البطاقة.
            </p>
          )}
        </>
      )}

      {printing && (
        <SheetPreview
          title={`بطاقة — ${student.firstName} ${student.lastName}`}
          subtitle={`${nameAr} · رقم ${student.studentNumber}`}
          onClose={() => setPrinting(false)}
        >
          <CardSheet student={student} enrollments={enrollments} />
        </SheetPreview>
      )}
    </div>
  );
}

/** إطارٌ فاتح تحت الوجه — البطاقة بيضاء ولا تُرى على خلفيةٍ داكنة بلا حدّ */
function CardFace({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[11px] font-bold text-white/40">{label}</div>
      <div className="inline-block rounded-[3.4mm] bg-white/10 p-[0.8mm] shadow-[0_18px_40px_-24px_rgba(0,0,0,0.9)]">
        {children}
      </div>
    </div>
  );
}

/**
 * ورقة الطباعة — الوجهان على A4 أفقية بمقاسهما الحقيقي.
 *
 * على A4 لا على ورق بطاقات: المركز لا يملك طابعة بطاقات، والورقة
 * تُقصّ وتُغلَّف. والوجهان **متجاوران لا متقابلان** لأنّ الطباعة على
 * الوجهين تحتاج قلبَ الورقة ومحاذاةً لا تضبطها طابعةٌ مكتبية —
 * فيُقصّان ويُلصقان ظهراً لظهر.
 *
 * وعلامات القصّ خطوطٌ رفيعة على الحدّ: القصُّ بالعين على بياضٍ يخرج
 * مائلاً، وبطاقةٌ مائلة لا تدخل الغلاف مستوية.
 */
function CardSheet({
  student,
  enrollments,
}: {
  student: Student;
  enrollments: Enrollment[] | null;
}) {
  return (
    <div className="sheet-print">
      <div className="sheet-page">
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10mm",
            alignItems: "flex-start",
            paddingTop: "6mm",
          }}
        >
          <CutFrame>
            <StudentCardFront student={student} enrollments={enrollments} />
          </CutFrame>
          <CutFrame>
            <StudentCardBack />
          </CutFrame>
        </div>

        <p
          style={{
            marginTop: "8mm",
            fontSize: "3mm",
            color: "#6b7280",
            textAlign: "center",
          }}
        >
          قُصّ على الخطوط، ثمّ ألصق الوجهين ظهراً لظهر وغلّف.
        </p>
      </div>
    </div>
  );
}

/** حدٌّ متقطّع خارج البطاقة بمليمتر — يُقصّ عليه ولا يظهر على البطاقة */
function CutFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        padding: "1mm",
        border: "0.2mm dashed #9ca3af",
        width: `calc(${CARD_W_MM}mm + 2.4mm)`,
        height: `calc(${CARD_H_MM}mm + 2.4mm)`,
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}
