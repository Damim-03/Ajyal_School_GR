import { Barcode } from "../../components/print/Barcode";
import { GenderGlyph } from "../../components/shared/Avatar";
import { useSchoolStore } from "../../core/stores/school.store";
import { assetUrl } from "../../lib/asset-url";
import type { Enrollment, Student } from "./student.api";

/**
 * بطاقة الطالب — وجهان بمقاس ISO ID‑1 (85.6 × 54 مم).
 *
 * المقاس الحقيقي لا تقريبَه: البطاقة تُطبع وتُقصّ وتُغلَّف، وواحدةٌ
 * أعرضُ بمليمترين لا تدخل الجيب البلاستيكي. لذلك **كل مقاس هنا
 * بالمليمتر** — والمليمتر في CSS ثابتٌ فيزيائي (96/25.4 بكسل)، فما
 * يُعرض على الشاشة هو ما يخرج من الطابعة حرفياً.
 *
 * ولا قيمةَ مكتوبةً في الشيفرة: الاسمان والشعار واللون والهاتف
 * والعنوان كلُّها من `school.store`، والبيانات من صفّ الطالب. تغييرُ
 * هوية المؤسسة في شاشة الإعدادات يُعيد رسم كلّ بطاقة — لا يحتاج
 * تعديلاً هنا ولا إعادةَ إصدار.
 *
 * والباركود Code128 يشفّر `studentNumber` وحده — لا رابطاً ولا
 * ‏JSON: الماسح يكتب ما قرأ في الحقل الذي فيه المؤشّر، فمسحةٌ في
 * خانة البحث تفتح ملفّ الطالب. ورقمٌ مطبوعٌ تحته لأنّ البطاقات
 * تنخدش، والموظّف حينها يقرأ ويكتب.
 */

/** ISO/IEC 7810 ID‑1 — مقاس بطاقة البنك ورخصة السياقة */
export const CARD_W_MM = 85.6;
export const CARD_H_MM = 54;

export type CardSide = "front" | "back";

/**
 * المستوى والطور من تسجيلات الطالب.
 *
 * ليسا حقلين فيه: الطالب يرتبط بالمستوى عبر التسجيل ← الإسناد ←
 * الفوج. فيُرجَّح **النشط في السنة الجارية**، ثمّ أحدثُ نشط، ثمّ
 * أحدثُ ما وُجد — فبطاقةُ من انقطع تحمل آخر ما كان عليه بدل فراغ.
 */
export function schoolingOf(enrollments: Enrollment[] | null) {
  if (!enrollments || enrollments.length === 0) return null;

  const pick =
    enrollments.find((e) => e.isActive && e.teachingAssignment.academicYear.isCurrent) ??
    enrollments.find((e) => e.isActive) ??
    enrollments[0];

  const level = pick.teachingAssignment.studyGroup.level;

  return {
    level: level.name,
    stage: level.educationStage?.name ?? null,
    year: pick.teachingAssignment.academicYear.name,
  };
}

const dmy = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleDateString("fr-DZ", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
    : "—";

/** هوية المؤسسة كما تظهر على البطاقة — قراءةٌ واحدة يشترك فيها الوجهان */
function useIdentity() {
  const s = useSchoolStore((st) => st.settings);

  return {
    nameAr: s["school.name_ar"] || "",
    nameEn: s["school.name_en"] || "",
    address: s["school.address"] || "",
    phone: s["school.phone"] || "",
    brand: s["school.brand_color"] || "#0f5f8a",
    logo: assetUrl(s["school.logo_path"]),
  };
}

// --------------------------------------------------
// الوجه الأمامي
// --------------------------------------------------

export function StudentCardFront({
  student,
  enrollments,
}: {
  student: Student;
  enrollments: Enrollment[] | null;
}) {
  const id = useIdentity();
  const schooling = schoolingOf(enrollments);
  const photo = assetUrl(student.avatar);

  return (
    <CardShell brand={id.brand}>
      {/* ===== شريط الرقم على الحافّة ===== */}
      <div
        style={{
          position: "absolute",
          insetInlineStart: 0,
          insetBlockStart: 0,
          insetBlockEnd: 0,
          width: "6mm",
          background: id.brand,
          color: "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        <span
          style={{
            /*
             * الرقم رأسيّاً على الحافّة كما في البطاقات الرسمية —
             * يُقرأ والبطاقةُ في المحفظة بلا إخراجها.
             */
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
            fontSize: "2.9mm",
            fontWeight: 800,
            letterSpacing: "0.06em",
            fontVariantNumeric: "tabular-nums",
            direction: "ltr",
          }}
        >
          {student.studentNumber}
        </span>
      </div>

      <div
        style={{
          position: "absolute",
          inset: 0,
          paddingInlineStart: "6mm",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ===== الترويسة: الشعار واسم المركز ===== */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2mm",
            padding: "2mm 3mm 1.6mm",
            borderBottom: `0.4mm solid ${id.brand}`,
          }}
        >
          <Logo src={id.logo} size="8mm" brand={id.brand} />

          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.15 }}>
            <div style={{ fontSize: "3.1mm", fontWeight: 900, color: id.brand }}>
              {id.nameAr}
            </div>
            {id.nameEn && (
              <div
                style={{
                  fontSize: "2.1mm",
                  fontWeight: 700,
                  color: "#5b6472",
                  direction: "ltr",
                  textAlign: "start",
                }}
              >
                {id.nameEn}
              </div>
            )}
          </div>

          <span
            style={{
              fontSize: "2.2mm",
              fontWeight: 900,
              color: "#fff",
              background: id.brand,
              borderRadius: "1mm",
              padding: "0.7mm 1.6mm",
              whiteSpace: "nowrap",
            }}
          >
            بطاقة طالب
          </span>
        </header>

        {/* ===== الجسم: الصورة والحقول ===== */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "18mm minmax(0, 1fr)",
            gap: "2.6mm",
            padding: "2mm 3mm 0",
            alignItems: "start",
          }}
        >
          <Photo src={photo} gender={student.gender} brand={id.brand} />

          <div style={{ display: "grid", gap: "1.1mm", minWidth: 0 }}>
            <Field
              label="الاسم واللقب"
              value={`${student.firstName} ${student.lastName}`}
              strong
              brand={id.brand}
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6mm" }}>
              <Field label="المستوى" value={schooling?.level ?? "—"} brand={id.brand} />
              <Field label="الطور" value={schooling?.stage ?? "—"} brand={id.brand} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.6mm" }}>
              <Field label="تاريخ الميلاد" value={dmy(student.birthDate)} ltr brand={id.brand} />
              <Field
                label="السنة الدراسية"
                value={schooling?.year ?? "—"}
                ltr
                brand={id.brand}
              />
            </div>
          </div>
        </div>

        {/* ===== الباركود ===== */}
        <footer
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            gap: "2mm",
            padding: "0 3mm 2mm",
          }}
        >
          {/*
            المنطقة الهادئة — 4.2 مم بياضاً على جانبَي القضبان.

            ليست حشوةً جمالية: Code128 يشترط فراغاً لا يقلّ عن عشرة
            أضعاف أنحف قضيب (0.4 مم هنا) قبل أوّل قضيب وبعد آخره، وبدونه
            يقرأ الماسحُ حافّةَ التصميم قضيباً فيفشل أو يقرأ ناقصاً.
            والخلفية بيضاء صراحةً لأنّ تدرّج البطاقة الخافت يمرّ من هنا،
            والماسح يقرأ التباين لا الشكل.
          */}
          <div
            style={{
              background: "#fff",
              borderRadius: "1mm",
              padding: "0.8mm 4.2mm",
            }}
          >
            <div style={{ width: "36mm", height: "7mm" }}>
              <Barcode value={student.studentNumber} fit />
            </div>
            <div
              style={{
                marginTop: "0.4mm",
                fontSize: "2.4mm",
                fontWeight: 800,
                letterSpacing: "0.14em",
                fontVariantNumeric: "tabular-nums",
                direction: "ltr",
                textAlign: "center",
                color: "#1b232f",
              }}
            >
              {student.studentNumber}
            </div>
          </div>

          <div
            style={{
              textAlign: "start",
              fontSize: "2.1mm",
              lineHeight: 1.35,
              color: "#5b6472",
            }}
          >
            <div>
              التسجيل: <span style={{ direction: "ltr", unicodeBidi: "isolate" }}>{dmy(student.registrationDate)}</span>
            </div>
            {id.phone && (
              <div style={{ direction: "ltr", unicodeBidi: "isolate", textAlign: "start" }}>
                {id.phone}
              </div>
            )}
          </div>
        </footer>
      </div>
    </CardShell>
  );
}

// --------------------------------------------------
// الوجه الخلفي
// --------------------------------------------------

export function StudentCardBack() {
  const id = useIdentity();

  return (
    <CardShell brand={id.brand}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "2.2mm",
          padding: "5mm",
          textAlign: "center",
        }}
      >
        <Logo src={id.logo} size="20mm" brand={id.brand} />

        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: "5mm", fontWeight: 900, color: id.brand }}>{id.nameAr}</div>
          {id.nameEn && (
            <div
              style={{
                marginTop: "1mm",
                fontSize: "3mm",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#5b6472",
                direction: "ltr",
              }}
            >
              {id.nameEn}
            </div>
          )}
        </div>

        {(id.address || id.phone) && (
          <div
            style={{
              borderTop: `0.3mm solid ${id.brand}55`,
              paddingTop: "1.6mm",
              fontSize: "2.3mm",
              lineHeight: 1.45,
              color: "#5b6472",
            }}
          >
            {id.address && <div>{id.address}</div>}
            {id.phone && (
              <div style={{ direction: "ltr", unicodeBidi: "isolate" }}>{id.phone}</div>
            )}
          </div>
        )}
      </div>
    </CardShell>
  );
}

// --------------------------------------------------
// القطع المشتركة
// --------------------------------------------------

/**
 * جسم البطاقة.
 *
 * `overflow: hidden` مع `borderRadius` يقصّ شريطَ الرقم عند الزوايا
 * فيتبع انحناءها، و`position: relative` هو ما ينسب إليه الشريط
 * والمحتوى معاً.
 */
function CardShell({ brand, children }: { brand: string; children: React.ReactNode }) {
  return (
    <div
      className="student-card"
      style={{
        position: "relative",
        width: `${CARD_W_MM}mm`,
        height: `${CARD_H_MM}mm`,
        borderRadius: "3mm",
        overflow: "hidden",
        background: "#fff",
        color: "#1b232f",
        border: `0.3mm solid ${brand}66`,
        /*
         * تدرّجٌ خافت لا لون: البطاقة تُطبع، والخلفية المشبعة تبتلع
         * الحبر وتُخرج نصّاً رمادياً على لونٍ داكن. والقيمة بالمئة من
         * لون الهوية فتتبعه إن تغيّر.
         */
        backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${brand}14, transparent 60%)`,
        fontFamily: '"Tahoma","Arial",sans-serif',
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {children}
    </div>
  );
}

/** الشعار — وبديلُه الحرف الأوّل من اسم المؤسسة حتى لا يفرغ الوجه */
function Logo({ src, size, brand }: { src?: string; size: string; brand: string }) {
  const nameAr = useSchoolStore((s) => s.settings["school.name_ar"] ?? "");

  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: size, height: size, objectFit: "contain", display: "block" }}
      />
    );
  }

  return (
    <span
      style={{
        width: size,
        height: size,
        display: "grid",
        placeItems: "center",
        borderRadius: "50%",
        background: brand,
        color: "#fff",
        fontWeight: 900,
        fontSize: `calc(${size} * 0.5)`,
      }}
    >
      {nameAr.trim().charAt(0) || "؟"}
    </span>
  );
}

/** صورة الطالب — وبديلُها ظلُّ الجنس نفسُه المستعمل في كل الشاشات */
function Photo({
  src,
  gender,
  brand,
}: {
  src?: string;
  gender: Student["gender"];
  brand: string;
}) {
  return (
    <div
      style={{
        width: "18mm",
        height: "22mm",
        borderRadius: "1.2mm",
        overflow: "hidden",
        border: `0.3mm solid ${brand}66`,
        background: `${brand}1a`,
        display: "grid",
        placeItems: "center",
      }}
    >
      {src ? (
        <img
          src={src}
          alt=""
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        />
      ) : (
        <span style={{ width: "12mm", height: "12mm", display: "block" }}>
          <GenderGlyph gender={gender} fill={`${brand}80`} />
        </span>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  ltr,
  strong,
  brand,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  strong?: boolean;
  brand: string;
}) {
  return (
    <div style={{ minWidth: 0 }}>
      {/*
        2.1 مم ≈ ستّ نقاط — أدنى ما يُقرأ مطبوعاً بلا عناء. وأصغرُ منه
        يخرج من طابعةٍ نافثة للحبر مشوَّشاً على ورقٍ عادي.
      */}
      <div style={{ fontSize: "2.1mm", fontWeight: 700, color: brand, opacity: 0.8 }}>
        {label}
      </div>
      <div
        style={{
          fontSize: strong ? "3.2mm" : "2.7mm",
          fontWeight: strong ? 900 : 700,
          lineHeight: 1.2,
          direction: ltr ? "ltr" : undefined,
          unicodeBidi: ltr ? "isolate" : undefined,
          textAlign: "start",
          overflow: "hidden",
          /*
           * الاسم يأخذ سطرين، وبقيةُ الحقول سطراً واحداً بحذفٍ عند
           * الطول. والفرقُ مقصود: «أولى متوسط» مقصوصاً يبقى مفهوماً،
           * واسمٌ مقصوص يجعل البطاقة لشخصٍ آخر. والسطر الثاني يسعه
           * الفراغ الذي يفصل الحقول عن الباركود.
           */
          ...(strong
            ? {
                display: "-webkit-box",
                WebkitBoxOrient: "vertical" as const,
                WebkitLineClamp: 2,
              }
            : { textOverflow: "ellipsis", whiteSpace: "nowrap" }),
        }}
      >
        {value}
      </div>
    </div>
  );
}
