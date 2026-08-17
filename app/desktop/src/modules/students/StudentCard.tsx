import { Barcode } from "../../components/print/Barcode";
import { GenderGlyph } from "../../components/shared/Avatar";
import { useSchoolStore } from "../../core/stores/school.store";
import { assetUrl } from "../../lib/asset-url";
import type { Enrollment, Student } from "./student.api";

/**
 * بطاقة الطالب — وجهان بمقاس ISO/IEC 7810 ID‑1 (85.60 × 53.98 مم).
 *
 * بطاقة مؤسسة خاصة لا بطاقة جامعية: لا شعار حكومي ولا اسم جمهورية —
 * هوية أجيال وحدها، من شعارها إلى لونها. والمقاس الحقيقي لا تقريبَه:
 * البطاقة تُطبع على PVC وتُقصّ، وواحدةٌ أعرضُ بمليمتر لا تدخل قارئ
 * البطاقات أو الجيب البلاستيكي. لذلك **كل مقاس هنا بالمليمتر** —
 * والمليمتر في CSS ثابتٌ فيزيائي (96/25.4 بكسل)، فما يُعرض على الشاشة
 * هو ما يخرج من الطابعة حرفياً، لا تصميم واجهة يُحاكي بطاقة.
 *
 * ولا قيمةَ مكتوبةً في الشيفرة: اسما المؤسسة والشعار واللون والهاتف
 * والبريد كلُّها من `school.store`، والبيانات من صفّ الطالب وتسجيله.
 * تغييرُ هوية المؤسسة في شاشة الإعدادات يُعيد رسم كلّ بطاقة — لا يحتاج
 * تعديلاً هنا ولا إعادةَ إصدار. وطالبٌ آخر يعني بطاقةً أخرى تلقائياً:
 * هذان الوجهان مكوّنا عرضٍ محضان، لا يعرفان طالباً بعينه.
 *
 * والباركود Code128 يشفّر `studentNumber` وحده — لا رابطاً ولا JSON:
 * الماسح يكتب ما قرأ في الحقل الذي فيه المؤشّر، فمسحةٌ في خانة البحث
 * تفتح ملفّ الطالب مباشرة (Scanner → studentNumber → GET /students →
 * ملفّ الطالب). ورقمٌ مطبوعٌ تحته أيضاً لأنّ البطاقات تنخدش، والموظّف
 * حينها يقرأ الرقم ويكتبه يدوياً بدل إعادة تمرير بطاقةٍ لا تُقرأ.
 */

/** ISO/IEC 7810 ID‑1 — مقاس بطاقة البنك ورخصة السياقة، والمرجع لبطاقات PVC */
export const CARD_W_MM = 85.6;
export const CARD_H_MM = 53.98;

export type CardSide = "front" | "back";

/**
 * المستوى والطور — من حقل الطالب أوّلاً، ومن تسجيلاته ارتداداً.
 *
 * **الحقل أوّلاً** لأنّ المستوى صفةُ الطالب، يُختار عند تسجيله من
 * مستويات «البنية الدراسية». والاشتقاق من التسجيل كان يعطي إجاباتٍ
 * عدّة لطالبٍ يدرس ثلاث مواد في ثلاثة أفواج، ولا يعطي شيئاً لطالبٍ
 * سُجّل للتوّ ولم يُسنَد بعد — وهي اللحظة التي تُطبع فيها بطاقته.
 *
 * والارتداد يبقى للصفوف التي سبقت الحقل ولم تبلغها التعبئة الرجعية:
 * يُرجَّح **النشط في السنة الجارية**، ثمّ أحدثُ نشط، ثمّ أحدثُ ما
 * وُجد — فبطاقةُ من انقطع تحمل آخر ما كان عليه بدل فراغ.
 *
 * والفوج ليس منها: يبقى مُرجَعاً لمن يعرضه على الشاشة، ولا يُطبع على
 * البطاقة — الطالب في فوجٍ لكل مادة، وطباعةُ واحدٍ منها اختيارٌ بلا
 * معنى، وهو فوق ذلك يتبدّل بالنقل بينما البطاقة في جيبه.
 */
export function schoolingOf(
  student: Pick<Student, "level">,
  enrollments: Enrollment[] | null,
) {
  if (student.level) {
    return {
      level: student.level.name,
      stage: student.level.educationStage?.name ?? null,
      group: null as string | null,
      year: null as string | null,
    };
  }

  if (!enrollments || enrollments.length === 0) return null;

  const pick =
    enrollments.find((e) => e.isActive && e.teachingAssignment.academicYear.isCurrent) ??
    enrollments.find((e) => e.isActive) ??
    enrollments[0];

  const assignment = pick.teachingAssignment;
  const level = assignment.studyGroup.level;

  return {
    level: level.name,
    stage: level.educationStage?.name ?? null,
    group: assignment.studyGroup.name as string | null,
    year: assignment.academicYear.name as string | null,
  };
}

/**
 * كلماتٌ لا تميّز طوراً عن طور — تُطرح قبل المقارنة.
 *
 * «التعليم المتوسط» و«التعليم الثانوي» يشتركان في «التعليم»، فلو دخل
 * في المقارنة لطابق كلُّ طورٍ كلَّ مستوًى وسقط الطور دائماً.
 */
const STAGE_NOISE = new Set(["التعليم", "تعليم", "طور", "الطور", "مرحلة", "المرحلة"]);

/** «المتوسط» و«متوسط» كلمةٌ واحدة — أل التعريف لا تفرّق بينهما هنا */
const stem = (word: string) => (word.startsWith("ال") ? word.slice(2) : word);

/**
 * سطر المستوى على البطاقة — والطور مطويٌّ فيه لا سطراً ثانياً.
 *
 * التسمية الجزائرية تحمل الطور داخل المستوى: «أولى متوسط» تحت طور
 * «متوسط» أو «التعليم المتوسط». فسطرٌ مستقلٌّ للطور يستهلك واحداً من
 * أربعة أسطر على بطاقةٍ ارتفاعها 53.98 مم ولا يضيف حرفاً جديداً.
 *
 * لكن التسمية بيد الإدارة لا بيد هذا الملف: مستوًى سُمّي «أولى» تحت
 * «متوسط» يخرج مبتوراً لا يُعرف من أيّ طور. فيُضاف الطور **حين لا
 * تجمعهما كلمة** — «متوسط · أولى» — ويُترك حين تجمعهما.
 */
function levelLabel(
  schooling: { level: string; stage: string | null } | null,
): string {
  if (!schooling) return "—";
  if (!schooling.stage) return schooling.level;

  const inLevel = new Set(schooling.level.split(/\s+/).filter(Boolean).map(stem));

  const implied = schooling.stage
    .split(/\s+/)
    .filter((word) => word && !STAGE_NOISE.has(word))
    .some((word) => inLevel.has(stem(word)));

  return implied ? schooling.level : `${schooling.stage} · ${schooling.level}`;
}

const dmy = (iso: string | null | undefined) =>
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
    email: s["school.email"] || "",
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
  const schooling = schoolingOf(student, enrollments);
  const photo = assetUrl(student.avatar);

  return (
    <CardShell brand={id.brand}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/*
          ===== الترويسة: الشعار ← اسم المؤسسة/عنوان البطاقة =====
          شعار أجيال وحده — بلا أي رمزٍ حكومي أو جامعي، فالبطاقة لمؤسسة
          خاصة. كبيرٌ وواضحٌ على اليمين (بداية التخطيط في RTL)، والنصّ
          يملأ الباقي: اسم المؤسسة من هويتها، ثمّ عنوان البطاقة بالعربية
          وتحته سطرٌ ثانويٌّ صغير بالإنجليزية.
        */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            gap: "2mm",
            padding: "0.9mm 3mm 0.8mm",
            borderBottom: `0.35mm solid ${id.brand}`,
          }}
        >
          <Logo src={id.logo} size="8.6mm" brand={id.brand} />

          <div style={{ flex: 1, minWidth: 0, display: "grid", gap: "0.35mm", textAlign: "center" }}>
            <div
              style={{
                fontSize: "2.7mm",
                fontWeight: 900,
                color: id.brand,
                lineHeight: 1.05,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {/*
                سطرٌ واحد لا يُلتفّ: ارتفاع الترويسة محسوبٌ بدقّة، واسمٌ
                طويل يلتفّ يكسر الحساب فيدفع الجسم خارج البطاقة. القصّ
                بثلاث نقاط أهون من ذلك.
              */}
              {id.nameAr}
            </div>

            <div style={{ fontSize: "2.3mm", fontWeight: 800, color: "#1b232f", lineHeight: 1 }}>
              بطاقة الطالب
            </div>

            <div
              style={{
                fontSize: "1.5mm",
                fontWeight: 600,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "#8a93a3",
                lineHeight: 1,
              }}
            >
              Student Identification Card
            </div>
          </div>
        </header>

        {/*
          ===== الجسم: الصورة يميناً، الحقول وسطاً، الباركود يساراً =====
          الباركود على الحافّة المقابلة للصورة، عمودياً كما في بطاقات
          الطلبة الرسمية. ورقمه مطبوعٌ بجانبه مرّةً واحدةً فقط — لا
          يتكرّر حقلاً في النموذج: هو الرقم نفسه، وتكراره يضيّع مساحةً
          ويوهم أنّهما رقمان مختلفان.
        */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "19mm minmax(0, 1fr) 9mm",
            gap: "2.4mm",
            padding: "0.9mm 3mm 0.8mm",
            /* توسيطٌ رأسي: الحقول الخمسة أقصرُ من الجسم، والمحاذاة إلى
               الأعلى تترك فراغاً أسفلَ البطاقة يبدو نقصاً لا تنفيساً */
            alignItems: "center",
          }}
        >
          <Photo src={photo} gender={student.gender} brand={id.brand} />

          {/*
            حقلٌ في كلّ سطر، واللقب منفصلٌ عن الاسم — كما في وثائق
            الهوية الرسمية: «محمد الأمين بن عبد الرحمان» في سطرٍ واحد
            لا يُعرف أين ينتهي الاسم ويبدأ اللقب، والفصل يرفع اللبس عند
            التحقّق من هوية حاملها.
          */}
          <div style={{ display: "grid", gap: "1.6mm", minWidth: 0 }}>
            <Field label="اللقب" value={student.lastName} brand={id.brand} />
            <Field label="الاسم" value={student.firstName} brand={id.brand} />
            <Field label="تاريخ الميلاد" value={dmy(student.birthDate)} ltr brand={id.brand} />
            <Field label="المستوى" value={levelLabel(schooling)} brand={id.brand} />
          </div>

          <VerticalBarcode value={student.studentNumber} />
        </div>

        {/* شريطٌ متموّج على الحافّة السفلى — نقشُ وثائق الهوية الرسمية */}
        <WavyRule color={id.brand} />
      </div>
    </CardShell>
  );
}

// --------------------------------------------------
// الوجه الخلفي
// --------------------------------------------------

export function StudentCardBack() {
  const id = useIdentity();
  const contact = [id.phone, id.email, id.address].filter(Boolean);

  return (
    /*
     * بلا علامةٍ مائية هنا: الشعار نفسُه معروضٌ كبيراً في وسط الوجه،
     * وطبعُه مرّتين — باهتاً خلف نفسه وواضحاً فوقه — يُوسّخ الخلفية
     * ولا يضيف شيئاً. والأمامي يبقيها لأنّ شعاره صغيرٌ في الترويسة.
     */
    <CardShell brand={id.brand} watermark={false}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '3mm 4mm 2.6mm',
          textAlign: 'center',
        }}
      >
        {/* ===== الشعار كبيراً واضحاً، ثمّ الاسم باللغتين ===== */}
        <Logo src={id.logo} size='17mm' brand={id.brand} />

        <div style={{ marginTop: '1.4mm', lineHeight: 1.15 }}>
          <div style={{ fontSize: '3.2mm', fontWeight: 900, color: id.brand }}>
            {id.nameAr}
          </div>
          {id.nameEn && (
            <div
              style={{
                marginTop: '0.5mm',
                fontSize: '2mm',
                fontWeight: 600,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#8a93a3',
                direction: 'ltr',
              }}
            >
              {id.nameEn}
            </div>
          )}
        </div>

        <div
          style={{
            width: '32mm',
            height: '0.3mm',
            background: `${id.brand}33`,
            margin: '2mm 0',
          }}
        />

        {/* ===== تنبيه الفقدان وملكية البطاقة ===== */}
        <div style={{ fontSize: '1.9mm', lineHeight: 1.5, color: '#3a4250' }}>
          <p style={{ fontWeight: 700 }}>في حالة العثور على هذه البطاقة</p>
          <p>يرجى إعادتها إلى إدارة المؤسسة. وهي ملكٌ لها، لا يستعملها غير صاحبها.</p>
        </div>

        {/*
          حفظ الحقوق والتواصل —  يلصقهما بالقاع مهما
          قصُر ما فوقهما، فلا يطفوان في وسط البياض.
        */}
        <div
          style={{
            marginTop: 'auto',
            paddingTop: '1.4mm',
            fontSize: '1.6mm',
            lineHeight: 1.45,
            color: '#8a93a3',
          }}
        >
          <div>© جميع الحقوق محفوظة</div>
          {contact.length > 0 && (
            <div style={{ direction: 'ltr', unicodeBidi: 'isolate' }}>
              {contact.join('  ·  ')}
            </div>
          )}
        </div>
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
 * خلفيةٌ بيضاءُ نظيفة لا تدرّجات صاخبة ولا زخارف: بطاقةٌ تُطبع على
 * PVC، والتدرّج الوحيد هنا خافتٌ جداً (شفافيته أقل من عُشر) ليكسر
 * برودة الأبيض المطلق بلا ابتلاع حبرٍ ولا تعتيم نصٍّ — بخلاف بطاقات
 * البنوك بتدرّجاتها القوية، وهذا مقصودٌ: بطاقة طالبٍ لا بطاقة دفع.
 */
function CardShell({
  brand,
  watermark = true,
  children,
}: {
  brand: string;
  /** يُطفأ حين يحمل الوجهُ الشعارَ ظاهراً — لا يُطبع الشعار خلف نفسه */
  watermark?: boolean;
  children: React.ReactNode;
}) {
  const logo = useSchoolStore((s) => assetUrl(s.settings["school.logo_path"]));

  return (
    <div
      className="student-card"
      style={{
        position: "relative",
        width: `${CARD_W_MM}mm`,
        height: `${CARD_H_MM}mm`,
        borderRadius: "2.6mm",
        overflow: "hidden",
        background: "#fff",
        color: "#1b232f",
        border: `0.3mm solid ${brand}55`,
        backgroundImage: `radial-gradient(120% 90% at 100% 0%, ${brand}0d, transparent 60%)`,
        fontFamily: '"Tahoma","Arial",sans-serif',
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    >
      {/*
        علامة مائية — شعار المؤسسة كبيراً في المنتصف خلف كل المحتوى،
        على نمط الزخارف الأمنية في الوثائق الرسمية (نقشٌ خافتٌ يملأ
        البطاقة) لكن بشعار أجيال بدل نقشٍ زخرفي عام. شفافيتها منخفضة
        جداً عمداً — العلامة المائية زينةٌ لا معلومة، وأولويةُ الطباعة
        وضوحُ النصّ فوقها لا بروزُها هي.
      */}
      {watermark && logo && (
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: "68%",
            height: "68%",
            transform: "translate(-50%, -50%)",
            objectFit: "contain",
            opacity: 0.07,
            pointerEvents: "none",
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        />
      )}

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

/** صورة الطالب — نسبة 3:4 (Portrait) وبديلُها ظلُّ الجنس نفسُه المستعمل في كل الشاشات */
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
        /* 3:4 صورةً شخصية — نسبة صور الهوية الرسمية */
        width: "19mm",
        height: "25.3mm",
        borderRadius: "1mm",
        overflow: "hidden",
        border: `0.3mm solid ${brand}66`,
        background: `${brand}14`,
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
        <span style={{ width: "10mm", height: "10mm", display: "block" }}>
          <GenderGlyph gender={gender} fill={`${brand}80`} />
        </span>
      )}
    </div>
  );
}

/**
 * الباركود عمودياً على حافّة البطاقة، مقابلَ الصورة.
 *
 * التدوير بـ`transform` لا يغيّر المساحة التي يحجزها العنصر في
 * التخطيط، فالمحتوى المدوَّر مثبَّتٌ مطلقاً داخل عمودٍ عرضُه 9 مم
 * يمتدّ بارتفاع الجسم: العمود هو ما يحجز المكان، والمدوَّر يتوسّطه.
 *
 * وخلفيةٌ بيضاءُ صريحة تحته تحجب العلامة المائية — الماسح يقرأ
 * التباين، وشعارٌ باهتٌ يعبر القضبان يكفي لإفساد القراءة. والرقم
 * مطبوعٌ بجانبه لأنّ البطاقات تنخدش، فيقرؤه الموظّف ويكتبه يدوياً.
 */
function VerticalBarcode({ value }: { value: string }) {
  return (
    <div
      style={{
        position: "relative",
        alignSelf: "stretch",
        background: "#fff",
        borderRadius: "1mm",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%) rotate(-90deg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.4mm",
        }}
      >
        <div style={{ width: "27mm", height: "5.2mm" }}>
          <Barcode value={value} fit />
        </div>
        <div
          style={{
            fontSize: "2.1mm",
            fontWeight: 800,
            letterSpacing: "0.12em",
            fontVariantNumeric: "tabular-nums",
            direction: "ltr",
            whiteSpace: "nowrap",
            color: "#1b232f",
          }}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/**
 * شريطٌ متموّج يمتدّ بعرض البطاقة — نقشُ الأمان المتموّج نفسُه الذي في
 * وثائق الهوية الرسمية، بلون هوية المؤسسة لا بأخضرَ ثابت.
 *
 * بلاطةٌ مكرّرة خلفيةً لا `<pattern>` داخل SVG ممدود: الأخير يحتاج
 * `preserveAspectRatio="none"` ليملأ العرض، فيمطّ البلاطة أفقياً
 * بنسبةٍ تفوق الرأسية أضعافاً — تخرج الموجة خطاً شبه مستقيم مسطّح لا
 * موجة. والبلاطة هنا 4×2 مم بمقياسٍ موحّد على المحورين (0.5 مم لكل
 * وحدة)، تتكرّر بعرض البطاقة كاملاً محتفظةً بشكلها مهما اتّسع.
 *
 * وموجتان متعاكستان لا واحدة: تشابكهما يعطي النقش المتداخل نفسه،
 * والموجةُ المفردة تبدو خطاً مزخرفاً لا نقشَ أمان.
 */
function WavyRule({ color }: { color: string }) {
  const tile =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 8 4">` +
    `<g fill="none" stroke="${color}" stroke-width="0.45">` +
    `<path d="M0,2 Q2,0.55 4,2 T8,2"/>` +
    `<path d="M0,2 Q2,3.45 4,2 T8,2"/>` +
    `</g></svg>`;

  return (
    <div
      style={{
        width: "100%",
        height: "2mm",
        /* عنصرُ مرونةٍ لا يُضغط: بلا هذا يقلّصه الحاوي إلى خيطٍ بلا موجة */
        flexShrink: 0,
        backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(tile)}")`,
        backgroundRepeat: "repeat-x",
        backgroundSize: "4mm 2mm",
        opacity: 0.75,
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
      }}
    />
  );
}

/**
 * حقلٌ في سطرٍ واحد — «اللقب: السايح».
 *
 * المعرّف والقيمة متجاوران لا مكدَّسان: التكديس يضاعف عدد الأسطر،
 * والبطاقة تحمل أربعة حقول لا حقلين. والمعرّف لا ينكمش (`flexShrink: 0`)
 * فالقيمة وحدها تُقصّ عند الطول — معرّفٌ مقصوص لا يُفهم أصلاً.
 */
function Field({
  label,
  value,
  ltr,
  brand,
}: {
  label: string;
  value: string;
  ltr?: boolean;
  brand: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: "1.1mm", minWidth: 0 }}>
      <span
        style={{
          fontSize: "2mm",
          fontWeight: 600,
          color: brand,
          opacity: 0.85,
          whiteSpace: "nowrap",
          flexShrink: 0,
        }}
      >
        {label}:
      </span>
      <span
        style={{
          fontSize: "2.3mm",
          fontWeight: 600,
          lineHeight: 1.3,
          color: "#1b232f",
          minWidth: 0,
          direction: ltr ? "ltr" : undefined,
          unicodeBidi: ltr ? "isolate" : undefined,
          textAlign: "start",
          /*
           * سطران للقيمة عند الطول لا قصٌّ بثلاث نقاط: «بن عبد القادر
           * الزهراني» مقصوصاً يجعل البطاقة لشخصٍ آخر، والالتفافُ يحفظ
           * الاسم كاملاً. والحدُّ سطران كي لا يزحف الحقل على ما تحته.
           */
          display: "-webkit-box",
          WebkitBoxOrient: "vertical" as const,
          WebkitLineClamp: 2,
          overflow: "hidden",
        }}
      >
        {value}
      </span>
    </div>
  );
}

