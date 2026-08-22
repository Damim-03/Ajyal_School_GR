import { Fragment, useState } from "react";

import { PrintSignature } from "../../components/print/PrintSignature";
import { SheetBarcode } from "../../components/print/SheetBarcode";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { printedStamp } from "../../components/print/printed-at";
import { usePagedFlow, type PrintBlock } from "../../components/print/paged-flow";
import { formatMoney, DEFAULT_CURRENCY } from "../../core/utils/money";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import type { DocumentType, Student } from "./student.api";

/**
 * كشفُ ملفات الطلبة — ورقةٌ تُقرأ على الطاولة لا على الشاشة.
 *
 * الشاشة تُصفَّح خمسةَ عشرَ سطراً في المرّة، والمراجعةُ الحقيقية تقع
 * على ورقةٍ واحدة: مديرٌ يمرّ على القائمة بقلمٍ ويعلّم مَن يُستدعى وليُّه.
 * فالكشف يحمل **ما رشّحته الشاشة كلَّه** لا صفحتَها الظاهرة — وإلّا
 * خرجت ورقةٌ ناقصةٌ لا يُعرف نقصُها.
 *
 * وأعمدتُه أعمدةُ الجدول نفسها: وثيقةٌ وثيقةٌ ثمّ حقوقُ التسجيل ثمّ
 * الحالة — فمن قرأ الشاشة قرأ الورقة بلا تعلُّمٍ ثانٍ.
 */
export function StudentFilesSheet({
  rows,
  required,
  scope,
}: {
  rows: Student[];
  /** الوثائق الإلزامية — عمودٌ لكلٍّ منها */
  required: DocumentType[];
  /** ما رشّحته الشاشة — يُكتب في الترويسة فيُعرف ما تحمله الورقة */
  scope: string;
}) {
  const settings = useSchoolStore((s) => s.settings);
  const schoolName = useSchool("school.name_ar");
  const currency = settings["school.currency"] || DEFAULT_CURRENCY;
  const logo: LogoSpec = logoSpec(settings);
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));
  const printedOn = printedStamp();

  /**
   * رقمُ الورقة — ثلاثَ عشرةَ خانةً من لحظة تحريرها.
   *
   * وهو **مرجعُ وثيقةٍ لا مفتاحُ سجلّ**: هذا الكشف ليس كياناً محفوظاً
   * كالكشوف الشهرية — هو قائمةٌ حيّة تتبدّل بتبدّل المرشِّح، فلا شيءَ
   * يُفتح بمسحه. وفائدتُه أنّ نسختين من الورقة تُميَّزان: أيُّهما
   * حُرِّرت قبلُ، وأيُّها المقصودة في المراسلة والتوقيع.
   *
   * و`Date.now()` ثلاثَ عشرةَ خانةً بالضبط إلى سنة 2286 — فيوافق
   * مقاسَ رموز الكشوف الأخرى ويُقرأ بالقارئة نفسها.
   */
  const [code] = useState(() => String(Date.now()));

  const complete = rows.filter((s) => s.completeness?.isComplete).length;
  const paid = rows.filter((s) => s.registrationFeePaid).length;
  const collected = rows.reduce(
    (sum, s) => sum + (s.registrationFeePaid ? (s.registrationFeeAmount ?? 0) : 0),
    0,
  );

  /*
   * عرضُ الأعمدة — يُحسب ولا يُكتب.
   *
   * أعمدةُ الوثائق يتغيّر عددُها بتغيّر سياسة المؤسسة: ثلاثةٌ اليوم
   * وقد تصير خمساً غداً. ونسبٌ مكتوبةٌ بيدٍ لثلاثةٍ تتجاوز المئة عند
   * الخامسة، فتتقاسم المتصفّحاتُ الزيادةَ كيف شاءت.
   *
   * فالثابتُ 42 (الرقم والتسجيل والحقوق والحالة)، والاسمُ يأخذ نصيبه،
   * وما بقي يُقسَّم على الوثائق بالتساوي. وقِيس أنّ عشرةً في المئة
   * (28.5مم) تسع «شهادة مدرسية» في سطرٍ واحد — وهي أطولُ ما يُسمّى به
   * وثيقةٌ اليوم.
   */
  const FIXED = 6 + 14 + 12 + 10;
  const nameWidth = required.length <= 3 ? 28 : 18;
  const docWidth =
    required.length > 0 ? (100 - FIXED - nameWidth) / required.length : 0;

  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        <span>الكشف : ملفات الطلبة</span>
        <span>المعروض : {scope}</span>
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
        <SheetBarcode code={code} />
      </div>

      <div className="sheet-print-center">
        {logo.src && (
          <img
            src={logo.src}
            alt=""
            className="sheet-print-logo"
            style={{ width: `${logoWidth}mm`, filter: logo.filter }}
          />
        )}
        <h1>{schoolName}</h1>
        <h2>كشف ملفات الطلبة</h2>
      </div>

      <div className="sheet-print-side sheet-print-side-end">
        <span>عدد الملفات : {rows.length}</span>
        <span>المكتملة : {complete}</span>
        <span>حقوقٌ مدفوعة : {paid}</span>
      </div>
    </header>
  );

  const blocks: PrintBlock[] = [
    {
      kind: "table",
      key: "files",
      head: (
        <thead data-flow-head="">
          <tr>
            <th style={{ width: "6%" }}>الرقم</th>
            <th
              style={{
                width: `${required.length > 0 ? nameWidth : 100 - FIXED}%`,
              }}
            >
              اللقب والاسم
            </th>
            <th style={{ width: "14%" }}>رقم التسجيل</th>

            {required.map((type) => (
              <th key={type.key} style={{ width: `${docWidth.toFixed(2)}%` }}>
                {type.label}
              </th>
            ))}

            <th style={{ width: "12%" }}>حقوق التسجيل</th>
            <th style={{ width: "10%" }}>الحالة</th>
          </tr>
        </thead>
      ),
      rows: rows.map((student, index) => {
        const have = new Set(student.documentTypes ?? []);
        const done = student.completeness?.isComplete;

        return (
          <tr key={student.id} data-flow-row="">
            <td className="c">{index + 1}</td>
            <td style={{ fontWeight: 700 }}>
              {student.lastName} {student.firstName}
            </td>
            <td className="c" style={{ fontSize: "2.7mm" }} dir="ltr">
              {student.studentNumber}
            </td>

            {required.map((type) => (
              <td key={type.key} className="c b">
                {have.has(type.key) ? "✔" : "—"}
              </td>
            ))}

            <td className="c">
              {student.registrationFeePaid
                ? student.registrationFeeAmount !== null
                  ? formatMoney(student.registrationFeeAmount, currency)
                  : "دُفعت"
                : "لم تُدفع"}
            </td>

            <td className="c b">{done ? "مكتمل" : "ناقص"}</td>
          </tr>
        );
      }),
      tail: (
        <tr data-flow-tail="">
          <td colSpan={3 + required.length} style={{ textAlign: "end", fontWeight: 700 }}>
            المجموع — {rows.length} ملفاً · المكتملة {complete}
          </td>
          <td className="c b">{formatMoney(collected, currency)}</td>
          <td className="c b">{paid} دُفعت</td>
        </tr>
      ),
    },
    {
      kind: "keep",
      key: "signature",
      node: (
        <div
          style={{ marginTop: "14mm", display: "flex", justifyContent: "flex-end" }}
        >
          <PrintSignature role="مدير المؤسسة" />
        </div>
      ),
    },
  ];

  const signature = [rows.length, required.length, scope, printedOn, code].join("|");
  const { measureRef, pages } = usePagedFlow(signature, blocks.length);

  /* طورُ القياس — ورقةٌ خفيّة فيها كلُّ الكتل بعلاماتها */
  if (!pages) {
    return (
      <div className="sheet-print" dir="rtl">
        <div className="sheet-measure" ref={measureRef}>
          <section className="sheet-measure-page" data-measure-page="">
            {header}

            {blocks.map((block, index) => (
              <div key={block.key} data-flow-index={index}>
                {block.kind === "keep" ? (
                  block.node
                ) : (
                  <>
                    {block.title}
                    <table className="sheet-print-table" data-flow-table="">
                      {block.head}
                      <tbody>
                        {block.rows}
                        {block.tail}
                      </tbody>
                    </table>
                  </>
                )}
              </div>
            ))}

            <footer className="sheet-print-foot" data-measure-foot="">
              <span style={{ display: "block" }}>الصفحة 1 من 1</span>
            </footer>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="sheet-print" dir="rtl">
      {pages.map(({ pieces, fillMm }, page) => (
        <section className="sheet-page" key={page}>
          {header}

          {pieces.map((piece, at) => {
            const block = blocks[piece.index]!;

            if (block.kind === "keep") {
              return <Fragment key={`${block.key}-${at}`}>{block.node}</Fragment>;
            }

            if (piece.kind !== "table") return null;

            return (
              <Fragment key={`${block.key}-${at}`}>
                {piece.withTitle && block.title}

                <table className="sheet-print-table">
                  {block.head}
                  <tbody>
                    {block.rows.slice(piece.from, piece.to + 1)}
                    {piece.withTail && block.tail}
                  </tbody>
                </table>
              </Fragment>
            );
          })}

          <div style={{ height: `${fillMm.toFixed(2)}mm` }} />

          <footer className="sheet-print-foot">
            {pages.length > 1 && (
              <span style={{ display: "block" }}>
                الصفحة {page + 1} من {pages.length}
              </span>
            )}
          </footer>
        </section>
      ))}
    </div>
  );
}
