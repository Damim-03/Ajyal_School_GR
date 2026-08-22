import { useState } from "react";

import { Barcode } from "../../components/print/Barcode";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import type { Enrollment, Student } from "./student.api";

/**
 * شهادةُ تمدرس — وثيقةٌ تُسلَّم بيد الوليّ وتُقدَّم لغير المؤسسة.
 *
 * وهي غيرُ الكشوف في غرضها فغيرُها في شكلها: الكشفُ جدولٌ يُقرأ بالعين
 * السريعة، والشهادةُ **إثباتٌ** يُقرأ سطراً سطراً ويُختم ويُقدَّم إلى
 * جهةٍ أخرى. فترويستُها ترويسةُ الوثائق الرسمية الجزائرية، ومقاسُها
 * عموديٌّ كعرفها، وخطوطُها الفاصلة تُميّز الترويسةَ من المتن من الذيل
 * فتُقرأ الورقةُ في نظرة.
 *
 * والشعارُ في الطرفين لا في الوسط: الوسطُ للجمهورية، وهو عرفُ الورق
 * الرسمي — الدولةُ فوق والمؤسسةُ على الجانبين.
 *
 * وباركودان لا واحد: **رقمُ التسجيل** في متن الوثيقة يفتح ملفَّ الطالب
 * بمسحةٍ من أيّ ورقةٍ من أوراقه، و**رقمُ الشهادة** في الذيل يميّز هذه
 * النسخةَ من غيرها — فمن عاد بشهادةٍ بعد شهرٍ عُرف متى حُرِّرت.
 */
export function EnrolmentCertificate({
  student,
  enrolments,
  academicYear,
}: {
  student: Student;
  /** ما يدرسه في المؤسسة — مادةً مادة */
  enrolments: Enrollment[];
  academicYear: string;
}) {
  const settings = useSchoolStore((s) => s.settings);
  const nameAr = useSchool("school.name_ar");
  const nameEn = useSchool("school.name_en");
  const logo: LogoSpec = logoSpec(settings);

  /** رقمُ الشهادة — من لحظة تحريرها، ثلاثَ عشرةَ خانة */
  const [code] = useState(() => String(Date.now()));

  const now = new Date();
  const stamp = now.toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const born = student.birthDate
    ? new Date(student.birthDate).toLocaleDateString("fr-DZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "..... / ..... / .........";

  const enrolled = new Date(student.registrationDate).toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const stage = student.level?.educationStage?.name ?? "...................";
  const level = student.level?.name ?? "...................";
  const female = student.gender === "FEMALE";

  /* مادّةٌ واحدة لكلّ سطر — ولا تتكرّر إن درسها في فوجين */
  const subjects = [
    ...new Map(
      enrolments
        .filter((e) => e.isActive !== false)
        .map((e) => [e.teachingAssignment.subject.id, e.teachingAssignment]),
    ).values(),
  ];

  return (
    <div className="sheet-print sheet-portrait" dir="rtl">
      <section className="sheet-page cert">
        {/*
          إطارٌ يلفّ الوثيقة كلَّها.

          والغرضُ منه شيئان: يُبعد الكلامَ عن حافّة الورق — والطابعةُ
          تترك حافّةً لا تطبع فيها، فما قاربها خرج مضغوطاً — ويكشف
          الميلَ: ورقةٌ دخلت مائلةً يظهر ميلُها في الإطار فتُعاد، ولولاه
          ما عُرف إلّا بعد التسليم.
        */}
        <div className="cert-frame">
            {/* ================= الترويسة ================= */}
          <header className="cert-head">
            <Logo logo={logo} />

            <div className="cert-state">
              <div className="cert-state-ar">الجمهورية الجزائرية الديمقراطية الشعبية</div>
              <div className="cert-state-fr" dir="ltr">
                République Algérienne Démocratique et Populaire
              </div>

              {/*
                اسمُ المؤسسة تحت اسم الدولة — ترتيبُ الورق الرسمي:
                الجمهوريةُ أوّلاً ثمّ الجهةُ المُصدِرة.
              */}
              <div className="cert-state-school">{nameAr}</div>
              {nameEn && (
                <div className="cert-state-school-en" dir="ltr">
                  {nameEn}
                </div>
              )}
            </div>

            <Logo logo={logo} />
          </header>

          <hr className="cert-rule" />

          {/* ================= المتن ================= */}
          <main className="cert-body">
            <h1 className="cert-title">شهادة تمدرس</h1>

            {/*
              رقمُ التسجيل أوّلَ ما يُقرأ تحت العنوان.

              وهو مفتاحُ الوثيقة: من مسحه ظهر له كلُّ ما بعده. فتقديمُه
              يجعل الورقة تُعرَّف بصاحبها قبل أن تُقرأ سطراً سطراً.
            */}
            <div className="cert-code">
              <span className="cert-code-label">رقم تسجيل الطالب</span>
              <Barcode value={student.studentNumber} height={40} fit />
              <span className="cert-code-text" dir="ltr">
                {student.studentNumber}
              </span>
            </div>

            <dl className="cert-lines">
              <Line label={female ? "الطالبة" : "الطالب(ة)"}>
                <strong>
                  {student.lastName} {student.firstName}
                </strong>
              </Line>

              <Line label={female ? "المولودة في" : "المولود(ة) في"}>
                <span dir="ltr">{born}</span>
                {"  بـ: "}
                <strong>{student.birthPlace?.trim() || "..............................."}</strong>
              </Line>
            </dl>

            <dl className="cert-lines">
              <Line label={female ? "مسجَّلة بالمؤسسة" : "مسجَّل(ة) بالمؤسسة"}>
                <strong>{nameAr}</strong>
                {" في: "}
                <span dir="ltr">{enrolled}</span>
              </Line>

              <Line label="الطور">
                <strong>{stage}</strong>
              </Line>

              <Line label="المستوى">
                <strong>{level}</strong>
              </Line>

              <Line label="خلال السنة الدراسية">
                <strong>{academicYear}</strong>
              </Line>
            </dl>

            {/* المواد في مربّعها — كلُّ مادةٍ في سطر */}
            <div className="cert-subjects">
              <span className="cert-subjects-label">المواد التي يدرسها</span>

              {subjects.length === 0 ? (
                <p className="cert-subjects-empty">— لا مادّةَ مسجَّلة بعد —</p>
              ) : (
                <ol
                  className={`cert-subjects-list${
                    subjects.length > 8
                      ? " cols-3"
                      : subjects.length > 4
                        ? " cols-2"
                        : ""
                  }`}
                >
                  {/*
                    اسمُ المادة وحده — لا فوجَ ولا أستاذ.

                    الشهادةُ تُثبت أنّه يدرسها في المؤسسة، والفوجُ والأستاذُ
                    تفصيلٌ داخليٌّ يتبدّل خلال السنة فتُكذّبه الورقةُ بعد
                    شهر. ومن أراده مسح الباركود فظهر له كلُّ شيء.
                  */}
                  {subjects.map((assignment) => (
                    <li key={assignment.id}>
                      <span className="cert-subject-name">{assignment.subject.name}</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="cert-oath">
              يتعهّد {female ? "الطالبة" : "الطالب(ة)"} بالالتزام بميثاق الآداب
              والأخلاقيات الدراسية المعمول به في المؤسسة.
            </p>

            <div className="cert-sign">
              <span className="cert-sign-role">الإمضاء والختم</span>
              <span className="cert-sign-line" />
            </div>
          </main>

          <hr className="cert-rule" />

          {/* ================= الذيل ================= */}
          <footer className="cert-foot">
            <div className="cert-foot-side">
              <span>حُرِّرت في</span>
              <span dir="ltr">{stamp}</span>
            </div>

            <div className="cert-foot-center">
              <div className="cert-foot-name">{nameAr}</div>
              {nameEn && (
                <div className="cert-foot-name-en" dir="ltr">
                  {nameEn}
                </div>
              )}
            </div>

            <div className="cert-foot-side cert-foot-code">
              <Barcode value={code} height={26} fit />
              <span dir="ltr">{code}</span>
            </div>
            </footer>
        </div>
      </section>
    </div>
  );
}

/** الشعار في طرفَي الترويسة — كبيرٌ لأنّ الورقة تُقدَّم لغير المؤسسة */
function Logo({ logo }: { logo: LogoSpec }) {
  if (!logo.src) return <span className="cert-logo" />;

  return (
    <img src={logo.src} alt="" className="cert-logo" style={{ filter: logo.filter }} />
  );
}

/** سطرُ بيانٍ: تسميةٌ ثمّ نقاطٌ ثمّ القيمة */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cert-line">
      <dt>{label} :</dt>
      <dd>{children}</dd>
    </div>
  );
}
