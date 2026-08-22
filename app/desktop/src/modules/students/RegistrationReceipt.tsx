import { Barcode } from "../../components/print/Barcode";
import { Header } from "../finance/PrintDocs";
import { formatMoney, DEFAULT_CURRENCY } from "../../core/utils/money";
import { useSchool } from "../../core/stores/school.store";
import type { CatalogueEntry, Student } from "./student.api";

/** مضاعفاتُ مقاس الإيصال — تُضبط `--rcp` على `.print-area` في المعاينة */
const rcp = (n: number) => `calc(var(--rcp, 3.5mm) * ${n})`;

const dateOf = (value: string | Date) =>
  new Date(value).toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/**
 * وصلُ تأكيد التسجيل — يُسلَّم للوليّ ساعةَ التسجيل.
 *
 * وهو ليس إيصال دفعٍ ولا يُغني عنه: الإيصال يُثبت مالاً قُبض، وهذا
 * يُثبت **حالةَ ملفٍّ** — أيُّ وثيقةٍ سُلِّمت وأيُّها بقيت، وأدُفعت حقوقُ
 * التسجيل أم لا. والوليُّ يخرج به فيعرف ما عليه أن يُحضره في المرّة
 * القادمة، ولا يعود ليسأل «ماذا ينقصني؟».
 *
 * والوثائقُ تُعرض كلُّها لا الناقصةُ وحدها: قائمةٌ بالناقص تُجيب سؤالاً
 * واحداً، وقائمةُ الكلّ تُجيبه وتُثبت في الوقت نفسه ما سُلِّم — وهي
 * حجّةُ الوليّ إن ضاعت ورقةٌ في المؤسسة.
 *
 * والباركود يشفّر **رقم الطالب في المؤسسة**، وهو نفسه ما تحمله بطاقتُه
 * وكشفُ حسابه — فمسحةٌ واحدة تفتح ملفَّه من أيّ ورقةٍ من الثلاث.
 */
export function RegistrationReceiptDoc({
  student,
  catalogue,
  currency = DEFAULT_CURRENCY,
}: {
  student: Student;
  catalogue: CatalogueEntry[];
  currency?: string;
}) {
  const feeNote = useSchool("school.registration_fee_note");

  const delivered = catalogue.filter((entry) => entry.document);
  const missing = catalogue.filter((entry) => !entry.document);
  const missingRequired = missing.filter((entry) => entry.required);

  return (
    <div
      className="receipt-card bg-white px-2 py-2 text-center text-black"
      style={{ fontFamily: '"Tahoma","Arial",sans-serif' }}
    >
      <Header title="وصل تأكيد التسجيل" />

      <div
        className="mt-2 flex flex-col gap-1 border-t border-black pt-1.5 text-right"
        style={{ fontSize: rcp(1) }}
      >
        <Pair label="الطالب" value={`${student.lastName} ${student.firstName}`} />
        <Pair label="رقم التسجيل" value={student.studentNumber} ltr />
        {student.level && <Pair label="المستوى" value={student.level.name} />}
        <Pair label="هاتف الوليّ" value={student.parentPhone} ltr />
        <Pair label="تاريخ التسجيل" value={dateOf(student.registrationDate)} ltr />
      </div>

      {/* ============ حقوق التسجيل ============ */}
      <div
        className="mt-2 border-2 border-black px-2 py-1.5 text-center font-black"
        style={{ fontSize: rcp(1.2) }}
      >
        حقوق التسجيل :{" "}
        {student.registrationFeePaid ? (
          <>
            دُفعت
            {student.registrationFeeAmount !== null && (
              <> — {formatMoney(student.registrationFeeAmount, currency)}</>
            )}
          </>
        ) : (
          "لم تُدفع بعد"
        )}
      </div>

      {student.registrationFeePaid && student.registrationFeePaidAt && (
        <div style={{ fontSize: rcp(0.95) }} dir="ltr">
          {dateOf(student.registrationFeePaidAt)}
        </div>
      )}

      {/* ============ الوثائق ============ */}
      <table
        className="mt-2 w-full table-fixed border-collapse"
        style={{ fontSize: rcp(0.98) }}
      >
        <colgroup>
          <col style={{ width: "68%" }} />
          <col style={{ width: "32%" }} />
        </colgroup>

        <thead>
          <tr>
            <th className="border border-black px-1 py-1 font-bold">الوثيقة</th>
            <th className="border border-black px-1 py-1 font-bold">الحالة</th>
          </tr>
        </thead>

        <tbody>
          {catalogue.map((entry) => (
            <tr key={entry.key}>
              <td className="border border-black px-1 py-1 text-right leading-tight wrap-anywhere">
                {entry.label}
                {entry.required && <span className="font-black"> *</span>}
              </td>
              <td className="border border-black px-1 py-1 font-bold">
                {entry.document ? "سُلِّمت" : "ناقصة"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-1 text-right" style={{ fontSize: rcp(0.9) }}>
        * وثيقةٌ إلزامية
      </div>

      <div
        className="mt-1.5 border-t border-black pt-1 text-right font-bold"
        style={{ fontSize: rcp(1) }}
      >
        سُلِّم {delivered.length} من {catalogue.length} · ناقصٌ {missing.length}
        {missingRequired.length > 0 && (
          <span className="block font-black">
            منها {missingRequired.length} إلزامية — تُستكمل قبل نهاية الشهر
          </span>
        )}
      </div>

      {feeNote && (
        <div className="mt-1.5 text-right" style={{ fontSize: rcp(0.9) }}>
          {feeNote}
        </div>
      )}

      {/* ============ الباركود ============ */}
      <div className="mt-2 border-t border-black pt-1.5">
        <Barcode value={student.studentNumber} />
        <div className="font-mono font-bold" style={{ fontSize: rcp(0.95) }} dir="ltr">
          {student.studentNumber}
        </div>
      </div>

      <div className="mt-2 flex items-end justify-between" style={{ fontSize: rcp(0.95) }}>
        <span>إمضاء الوليّ</span>
        <span>إمضاء الإدارة</span>
      </div>

      <div style={{ height: rcp(3) }} />
    </div>
  );
}

/** سطر طرفَين — التسمية يميناً والقيمة يساراً */
function Pair({
  label,
  value,
  ltr,
}: {
  label: string;
  value: string;
  ltr?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0">{label} :</span>
      <span
        className="text-left font-semibold wrap-anywhere"
        dir={ltr ? "ltr" : undefined}
      >
        {value}
      </span>
    </div>
  );
}
