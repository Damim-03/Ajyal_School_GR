import { useEffect, useState } from "react";
import { CheckCircle2, ImageOff, Loader2, UserRound } from "lucide-react";

import { Barcode } from "../../components/print/Barcode";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { SheetPreview } from "../../components/print/SheetPreview";
import { ImageIntake } from "../../components/shared/ImageIntake";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { assetUrl } from "../../lib/asset-url";
import {
  dmy,
  getTeacherFile,
  updateTeacher,
  uploadImage,
  yearsOfService,
  type TeacherDetail,
  type TeacherFile,
} from "./teachers.api";

const ACCENT = "#5eead4";

/**
 * شهادةُ عمل — وثيقةٌ تُسلَّم بيد الأستاذ وتُقدَّم لغير المؤسسة.
 *
 * أختُ شهادةِ تمدرس الطالب في شكلها وترويستها ومقاسها، وتفترق عنها في
 * ثلاثة:
 *
 * **صورةٌ في صدرها.** شهادةُ التمدرس يُقدّمها وليٌّ عن ابنه فتكفيها
 * سطورُه، وشهادةُ العمل يقدّمها صاحبُها بنفسه إلى بنكٍ أو إدارةٍ أو
 * قنصلية، وهذه تطلب وجهاً على الورقة يُقابَل بحاملها. وإطارُها يبقى
 * مرسوماً وإن لم تُرفع صورة — فتُلصق باليد كما يُصنع بالورق الرسمي.
 *
 * **وما درّسه لا ما درسه**: المادةُ ومعها الفوجُ والمستوى — الأستاذ
 * يُسأل عن نصابه لا عن مواده وحدها.
 *
 * **والوثائق المسلَّمة في ذيلها.** وهي أنفعُ ما فيها للإدارة: من سأل
 * «هل سلّم نسخةَ شهادته؟» بعد سنةٍ وجد الجوابَ على الورقة نفسِها
 * بتاريخه، لا في درجٍ يُبحث فيه.
 *
 * ولا تُذكر فيها **أجرة**: شهادةُ العمل تُقدَّم لجهاتٍ شتّى، وراتبٌ
 * مطبوعٌ عليها يمشي معها إلى حيث لا يُراد. ومن طلب دخلاً فله كشفُ
 * الحساب.
 */
export function EmploymentCertificate({
  teacher,
  assignments,
  documents,
  academicYear,
  photo,
}: {
  teacher: TeacherDetail;
  /** ما أُسند إليه في السنة المعروضة */
  assignments: TeacherDetail["teachingAssignments"];
  /** ما سُلّم من أوراق — تُعرض في الذيل بتواريخها */
  documents: { label: string; at: string }[];
  academicYear: string;
  /** رابطُ صورته — أو `undefined` فيبقى الإطار فارغاً يُلصق فيه */
  photo?: string;
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

  const female = teacher.gender === "FEMALE";
  const born = teacher.birthDate ? dmy(teacher.birthDate) : "..... / ..... / .........";
  const years = yearsOfService(teacher.hireDate);

  /* إسنادٌ لكلّ (مادة × فوج) — والمعطَّلُ يسقط، فالشهادة تصف اليوم */
  const active = assignments.filter((a) => a.isActive);

  return (
    <div className="sheet-print sheet-portrait" dir="rtl">
      <section className="sheet-page cert cert-employment">
        <div className="cert-frame">
          {/* ================= الترويسة ================= */}
          <header className="cert-head">
            <Logo logo={logo} />

            <div className="cert-state">
              <div className="cert-state-ar">الجمهورية الجزائرية الديمقراطية الشعبية</div>
              <div className="cert-state-fr" dir="ltr">
                République Algérienne Démocratique et Populaire
              </div>

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
            <h1 className="cert-title">شهادة عمل</h1>

            {/*
              الصورةُ إلى جانب الهوية لا فوقها.

              وضعُها في صدر الوثيقة وحدها يدفع السطورَ إلى أسفل ويُطيل
              الورقة، ووضعُها بمحاذاة الاسم يجعل العينَ تقرأ الوجهَ
              والاسمَ في نظرةٍ واحدة — وهو ما تفعله الجهةُ التي تستلمها.
            */}
            <div className="cert-ident">
              <div className="cert-photo">
                {photo ? (
                  <img src={photo} alt="" />
                ) : (
                  <span className="cert-photo-empty">صورة</span>
                )}
              </div>

              <dl className="cert-lines cert-ident-lines">
                <Line label={female ? "الأستاذة" : "الأستاذ(ة)"}>
                  <strong>
                    {teacher.lastName} {teacher.firstName}
                  </strong>
                </Line>

                <Line label={female ? "المولودة في" : "المولود(ة) في"}>
                  <span dir="ltr">{born}</span>
                </Line>

                <Line label="المؤهّل">
                  <strong>{teacher.qualification?.trim() || "..............................."}</strong>
                </Line>

                <Line label="التخصّص">
                  <strong>{teacher.specialization?.trim() || "..............................."}</strong>
                </Line>
              </dl>
            </div>

            <dl className="cert-lines">
              <Line label={female ? "توظَّفت بالمؤسسة" : "وظِّف(ت) بالمؤسسة"}>
                <strong>{nameAr}</strong>
                {" في: "}
                <span dir="ltr">{dmy(teacher.hireDate)}</span>
              </Line>

              <Line label="أقدميّة الخدمة">
                <strong>{serviceLabel(years)}</strong>
              </Line>

              <Line label="الصفة">
                <strong>{female ? "أستاذة" : "أستاذ"}</strong>
                {" — "}
                {teacher.isActive ? "في الخدمة" : "خارج الخدمة"}
              </Line>

              <Line label="خلال السنة الدراسية">
                <strong>{academicYear}</strong>
              </Line>
            </dl>

            {/* ما يدرّسه — المادة ومعها الفوج، فالنصاب هو المسؤول عنه */}
            <div className="cert-subjects">
              <span className="cert-subjects-label">
                {female ? "المواد التي تدرّسها" : "المواد التي يدرّسها"}
              </span>

              {active.length === 0 ? (
                <p className="cert-subjects-empty">— لا إسنادَ في هذه السنة —</p>
              ) : (
                <ol
                  className={`cert-subjects-list${
                    active.length > 8 ? " cols-3" : active.length > 2 ? " cols-2" : ""
                  }`}
                >
                  {active.map((a) => (
                    <li key={a.id}>
                      <span className="cert-subject-name">{a.subject.name}</span>
                      <span className="cert-subject-group">
                        {a.studyGroup.level.name} — {a.studyGroup.name}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            {/*
              الوثائق المسلَّمة — بتواريخها.

              التاريخُ لا زينة: «سلّم نسخةَ الشهادة» جوابٌ ناقص، و«سلّمها
              في 03/09» جوابٌ يُحسم به خلاف.
            */}
            <div className="cert-docs">
              <span className="cert-subjects-label">الوثائق المسلَّمة للمؤسسة</span>

              {documents.length === 0 ? (
                <p className="cert-subjects-empty">— لا وثيقةَ مسجَّلة في ملفّه —</p>
              ) : (
                <ol
                  className={`cert-docs-list${
                    documents.length > 6 ? " cols-3" : documents.length > 2 ? " cols-2" : ""
                  }`}
                >
                  {documents.map((doc) => (
                    <li key={doc.label}>
                      <span className="cert-doc-name">{doc.label}</span>
                      <span className="cert-doc-at" dir="ltr">
                        {doc.at}
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </div>

            <p className="cert-oath">
              سُلّمت هذه الشهادة {female ? "للمعنيّة" : "للمعنيّ(ة)"} بناءً على طلبه
              لتقديمها لدى الجهات المعنيّة، وذلك لخدمة ما يُثبته الحقّ.
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

/**
 * الأقدميّة بصيغتها العربية.
 *
 * «6 سنة» عجمةٌ على وثيقةٍ رسمية، والعددُ من ثلاثٍ إلى عشرٍ يُجمع
 * جمعَ قلّة. وتُقرأ هذه السطورُ في بنكٍ أو قنصلية، فخطأُ الصياغة فيها
 * يُنسب إلى المؤسسة لا إلى برنامجها.
 */
const serviceLabel = (years: number) => {
  if (years === 0) return "أقلّ من سنة";
  if (years === 1) return "سنة واحدة";
  if (years === 2) return "سنتان";
  if (years <= 10) return `${years} سنوات`;
  return `${years} سنة`;
};

/** الشعار في طرفَي الترويسة */
function Logo({ logo }: { logo: LogoSpec }) {
  if (!logo.src) return <span className="cert-logo" />;

  return <img src={logo.src} alt="" className="cert-logo" style={{ filter: logo.filter }} />;
}

/** سطرُ بيانٍ: تسميةٌ ثمّ القيمة */
function Line({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cert-line">
      <dt>{label} :</dt>
      <dd>{children}</dd>
    </div>
  );
}

// --------------------------------------------------
// المعاينة — ومعها حقلُ الصورة
// --------------------------------------------------

/**
 * معاينةُ شهادة العمل: الورقةُ كما تخرج، وفوقها حقلُ صورة الأستاذ.
 *
 * والحقلُ هنا **مع** كونه في نافذة التعديل، لا بدلاً عنه: يُفتح ملفُّ
 * الأستاذ لتحرير شهادةٍ فيُرى أنّ صورته ناقصة، فتُمسح في مكانها بلا
 * إغلاق المعاينة والعودة إلى النموذج ثمّ العودة إلى هنا.
 *
 * وما يُرفع منه يُحفظ في ملفّ الأستاذ لا في هذه الجلسة وحدها — فوجهُه
 * يظهر بعدها في القائمة وفي ملفّه وعلى شهادته التالية.
 *
 * و«بلا صورة» لهذه النسخة وحدها: جهاتٌ تطلب الشهادة بلا صورة، وحذفُ
 * الصورة من الملفّ لأجل ورقةٍ واحدة إتلافٌ لا استجابة.
 */
export function EmploymentCertificatePreview({
  teacher,
  assignments,
  academicYear,
  onTeacherChange,
  onClose,
}: {
  teacher: TeacherDetail;
  assignments: TeacherDetail["teachingAssignments"];
  academicYear: string;
  /** يُبلَّغ بالأستاذ بعد تغيير صورته — لتتبعه الشاشةُ خلف المعاينة */
  onTeacherChange?: (teacher: TeacherDetail) => void;
  onClose: () => void;
}) {
  const [file, setFile] = useState<TeacherFile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** إخفاءُ الصورة لهذه النسخة — لا حذفُها من الملفّ */
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let alive = true;

    getTeacherFile(teacher.id)
      .then((f) => alive && setFile(f))
      .catch(() => alive && setError("تعذّر جلب وثائق الأستاذ"))
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [teacher.id]);

  const photoUrl = hidden ? undefined : assetUrl(teacher.avatar);

  const attachPhoto = async (picked: File) => {
    setBusy(true);
    setError(null);

    try {
      const path = await uploadImage(picked);
      onTeacherChange?.(await updateTeacher(teacher.id, { avatar: path }));
      setHidden(false);
    } catch (err: unknown) {
      const response = (err as { response?: { data?: { message?: string } } }).response;
      setError(response?.data?.message ?? "تعذّر رفع الصورة");
    } finally {
      setBusy(false);
    }
  };

  /* الوثائق كما تُطبع — ما سُلّم منها فعلاً بتاريخه */
  const documents = (file?.catalogue ?? [])
    .filter((entry) => entry.document)
    .map((entry) => ({
      label: entry.label,
      at: new Date(entry.document!.createdAt).toLocaleDateString("fr-DZ", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
    }));

  return (
    <SheetPreview
      title="شهادة عمل"
      subtitle={`${teacher.lastName} ${teacher.firstName} — ${academicYear}`}
      orientation="portrait"
      onClose={onClose}
      controls={
        <>
          <span className="flex items-center gap-2 text-xs font-bold text-white/60">
            <UserRound className="h-4 w-4" style={{ color: ACCENT }} />
            صورة الأستاذ على الشهادة
          </span>

          <span className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/30 px-2.5 py-1.5">
            {teacher.avatar ? (
              <>
                <img
                  src={assetUrl(teacher.avatar)}
                  alt=""
                  className="h-8 w-6 rounded object-cover"
                />
                <span className="text-[11px] text-white/55">
                  {hidden ? "مخفيّة في هذه النسخة" : "تظهر في الإطار"}
                </span>
              </>
            ) : (
              <span className="text-[11px] text-white/45">
                لا صورة — يخرج الإطار فارغاً لتُلصق باليد
              </span>
            )}
          </span>

          <ImageIntake
            aspect="3:4"
            editorTitle="صورة الأستاذ"
            busy={busy}
            onFile={attachPhoto}
          >
            {teacher.avatar ? "استبدال" : "إضافة صورة"}
          </ImageIntake>

          {teacher.avatar && (
            <button
              type="button"
              onClick={() => setHidden((v) => !v)}
              className="flex items-center gap-1.5 rounded-lg bg-white/10 px-2.5 py-1.5 text-[11px] font-bold transition hover:bg-white/20"
            >
              {hidden ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <ImageOff className="h-3.5 w-3.5" />
              )}
              {hidden ? "أظهرها" : "بلا صورة"}
            </button>
          )}

          {loading && <Loader2 className="h-4 w-4 animate-spin text-white/40" />}
          {error && <span className="text-[11px] text-rose-300">{error}</span>}

          <span className="ms-auto text-[11px] text-white/30">
            ما يُرفع هنا يُحفظ صورةً للأستاذ في ملفّه
          </span>
        </>
      }
    >
      <EmploymentCertificate
        teacher={teacher}
        assignments={assignments}
        documents={documents}
        academicYear={academicYear}
        photo={photoUrl}
      />
    </SheetPreview>
  );
}
