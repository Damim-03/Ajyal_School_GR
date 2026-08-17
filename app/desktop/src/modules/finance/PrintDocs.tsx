import type { ReactNode } from "react";

import { Barcode } from "../../components/print/Barcode";
import { logoSpec } from "../../components/print/logo";
import { formatAmount } from "../../core/utils/money";
import { useSchoolStore } from "../../core/stores/school.store";
import { MONTHS, METHOD_LABEL, type Invoice, type Payment } from "./finance.api";

/**
 * مستندات الطباعة — الفاتورة والإيصال.
 *
 * البنية متّبعة عن إيصال SKK لأنّها بنية إيصالٍ حراريّ مجرَّبة على ورق
 * حقيقي: شعار، ترويسة، سطور طرفَين، **جدول محدَّد الأعمدة**، صندوق
 * المجموع، ملخّص، تذييل، باركود. والمضمون مدرسيّ لا تجاريّ: الطالب
 * مكان العميل، والمادة والشهر مكان الصنف والكمية.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * **كل مقاس هنا مضاعفٌ لـ`var(--rcp)`، ولا رقم بالبكسل.**
 *
 * كانت الأحجام بالبكسل (`fontSize: 12`)، وقواعد `@media print` في
 * index.css تفرض `font-size: var(--rcp-print) !important` — فكان منتقي
 * حجم النصّ يُكتب ولا يُقرأ: كل الأحجام تطبع 3.5mm. والبكسل أصلاً وحدة
 * شاشة: 11px تخرج نحو 2.91mm، دون الحدّ المألوف للإيصالات (3.2–4.5mm).
 *
 * والمضاعفات ترجع كلّها إلى الجذر لا يتراكم بعضها على بعض، فتغيير
 * `--rcp` وحده يُعيد تناسب الورقة كاملة.
 *
 * ─────────────────────────────────────────────────────────────
 *
 * والجداول بأعمدة ثابتة النسب (`table-fixed` + `colgroup`): اسم مادة
 * طويل على ورق 72 مم يدفع عمود المبلغ خارج الورقة إن تُركت الأعمدة
 * تتمدّد بمحتواها.
 */

const rcp = (n: number) => `calc(var(--rcp, 3.5mm) * ${n})`;

const pad = (n: number) => String(n).padStart(2, "0");

const stampOf = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
  `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

const dateOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * المبلغ من كاتب المال الواحد (`core/utils/money`) لا من نسخةٍ هنا.
 *
 * كانت هنا نسخةٌ محلّية تفصل الآلاف **بمسافة**، وهي التي أخرجت
 * «500.00 1» في خانة المبلغ بدل «1,500.00». والسبب ثنائيّ:
 *
 *   1. المسافة محرفٌ محايد بين رقمين، وفي سياقٍ عربيّ (RTL) يأخذ اتجاه
 *      الفقرة — فتُصفّ مجموعتا الأرقام من اليمين إلى اليسار ويسبق
 *      «500.00» الآحادَ «1». والخطأ يظهر في الآلاف وحدها، فرقمٌ من
 *      ثلاث خانات يُختبر ويبدو سليماً.
 *   2. الخانة نفسُها كانت بلا `dir="ltr"` بخلاف خانة الشهر بجانبها.
 *
 * و`money.ts` قد حسم هذا سلفاً بالفاصلة لا المسافة، ووثّق السبب: الورقة
 * تُطبع وتُصوَّر، والمسافة تنكسر عند التفاف السطر فيصير «11 625» رقمين.
 * فهذه النسخة السادسة أُسقطت وبقي كاتبٌ واحد.
 */
const amount = formatAmount;

function useIdentity() {
  const s = useSchoolStore((x) => x.settings);

  return {
    nameAr: s["school.name_ar"] ?? "",
    nameEn: s["school.name_en"] ?? "",
    address: s["school.address"] ?? "",
    phone: s["school.phone"] ?? "",
    email: s["school.email"] ?? "",
    currency: s["school.currency"] ?? "دج",
    note: s["school.receipt_note"] ?? "",
    thanks: s["school.receipt_thanks"] ?? "",
  };
}

/**
 * مبلغ معزول اتجاهياً.
 *
 * ‏«2 500.00 دج» داخل سطر عربي ينقلب ترتيبه بلا عزل، فيخرج على الورق
 * ‏«دج 00.500 2». و`unicodeBidi: isolate` تمنع ذلك — وهو خطأ لا يُكتشف
 * إلّا بعد إتلاف ورقة، لأنّ الشاشة قد تعرضه صحيحاً والطابعة لا.
 */
function Money({ value }: { value: number }) {
  const id = useIdentity();

  return (
    <span
      dir="ltr"
      className="inline-block tabular-nums"
      style={{ unicodeBidi: "isolate" }}
    >
      {amount(value)} {id.currency}
    </span>
  );
}

/**
 * مبلغٌ بلا عملة — لخانات الجدول.
 *
 * معزولٌ اتجاهياً كأخيه: الفاصلة تجعل «1,500.00» رقماً واحداً في نظر
 * الاتجاه فلا ينقلب، لكنّ العزل صريحٌ لا متروكٌ لخاصيةٍ في محرفٍ —
 * ورقةٌ أُتلفت مرّةً بسبب هذا تكفي.
 */
function Amount({ value }: { value: number }) {
  return (
    <span
      dir="ltr"
      className="inline-block tabular-nums"
      style={{ unicodeBidi: "isolate" }}
    >
      {amount(value)}
    </span>
  );
}

// --------------------------------------------------
// القطع المشتركة
// --------------------------------------------------

export function Header({ title }: { title: string }) {
  const id = useIdentity();
  /* الانتقاء على `settings` لا على ناتج logoSpec: الأخير كائن جديد كل
     نداء فيرى zustand مرجعاً متغيّراً أبداً */
  const logo = logoSpec(useSchoolStore((s) => s.settings));

  return (
    <>
      {logo.src && (
        <img
          src={logo.src}
          alt=""
          data-logo
          className="mx-auto block object-contain"
          style={{
            width: `${logo.widthMm}mm`,
            maxWidth: "60%",
            filter: logo.filter,
            /* الطباعة تُسقط الخلفيات لا الصور — والشعار جزء من المستند */
            printColorAdjust: "exact",
            WebkitPrintColorAdjust: "exact",
          }}
        />
      )}

      <div className="mt-1 font-black leading-tight" style={{ fontSize: rcp(1.55) }}>
        {id.nameAr}
      </div>

      {id.nameEn && (
        <div className="font-bold" style={{ fontSize: rcp(1.09) }} dir="ltr">
          {id.nameEn}
        </div>
      )}

      {id.address && <div style={{ fontSize: rcp(1) }}>{id.address}</div>}

      {/* الهاتف والبريد: يظهران إن مُلئا — سطرٌ فارغ يأكل ورقاً */}
      {(id.phone || id.email) && (
        <div style={{ fontSize: rcp(0.955) }} dir="ltr">
          {[id.phone, id.email].filter(Boolean).join("  ·  ")}
        </div>
      )}

      <div
        className="mt-1.5 border-t border-black pt-1 font-black"
        style={{ fontSize: rcp(1.18) }}
      >
        {title}
      </div>
    </>
  );
}

/** سطر طرفَين — التسمية يميناً والقيمة يساراً */
function Pair({ label, value, ltr }: { label: string; value: ReactNode; ltr?: boolean }) {
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

/** صندوق المبلغ المطلوب — أغلظ إطار في الورقة، فالعين تقع عليه أوّلاً */
function TotalBox({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="mt-2 border-2 border-black px-2 py-1.5 text-center font-black"
      style={{ fontSize: rcp(1.36) }}
    >
      {label} : <Money value={value} />
    </div>
  );
}

function Footer({ stamp }: { stamp: string }) {
  const id = useIdentity();

  return (
    <>
      {id.note && (
        <div
          className="mt-2 border-t border-black pt-1.5"
          style={{ fontSize: rcp(0.955) }}
        >
          {id.note}
        </div>
      )}

      <div
        className="mt-2 border-t border-black pt-1.5"
        style={{ fontSize: rcp(0.91) }}
      >
        <span dir="ltr">{stamp}</span> &nbsp; {id.nameEn || id.nameAr}
      </div>

      {id.thanks && (
        <div className="mt-1 font-black" style={{ fontSize: rcp(1.18) }}>
          {id.thanks}
        </div>
      )}
    </>
  );
}

/** الباركود ورقمه — يُمسح لاسترجاع المستند بدل نسخ رقمه يدوياً */
function CodeBlock({ value }: { value: string }) {
  return (
    <div className="my-2 flex flex-col items-center">
      <Barcode value={value} />
      <div
        className="mt-0.5 font-mono tabular-nums tracking-[0.12em]"
        style={{ fontSize: rcp(1.09) }}
      >
        {value}
      </div>
    </div>
  );
}

const COLS = (
  <colgroup>
    <col style={{ width: "48%" }} />
    <col style={{ width: "22%" }} />
    <col style={{ width: "30%" }} />
  </colgroup>
);

const TH = "border border-black px-1 py-1 font-bold";
const TD = "border border-black px-1 py-1";

// --------------------------------------------------
// الفاتورة
// --------------------------------------------------

export function InvoiceDoc({ invoice }: { invoice: Invoice }) {
  const st = invoice.studentEnrollment;
  const ta = st.teachingAssignment;
  const paid = invoice.total - invoice.remaining;
  const stamp = stampOf(new Date());

  return (
    <div
      className="receipt-card bg-white px-2 py-2 text-center text-black"
      style={{ fontFamily: '"Tahoma","Arial",sans-serif' }}
    >
      <Header title="فاتورة" />

      {/* الطالب والتاريخ */}
      <div
        className="mt-2 flex flex-col gap-1 border-t border-black pt-1.5 text-right"
        style={{ fontSize: rcp(1) }}
      >
        <Pair label="الطالب" value={`${st.student.firstName} ${st.student.lastName}`} />
        <Pair label="الفوج" value={ta.studyGroup.name} />
        <Pair label="ولي الأمر" value={st.student.parentPhone} ltr />
        <Pair label="رقم الفاتورة" value={invoice.invoiceNumber} ltr />
        <Pair label="تاريخ الاستحقاق" value={dateOf(invoice.dueDate)} ltr />
        <Pair label="السنة الدراسية" value={invoice.academicYear.name} ltr />
      </div>

      {/* الجدول — سطر لكل مادة مفوترة */}
      <table
        className="mt-2 w-full table-fixed border-collapse"
        style={{ fontSize: rcp(1) }}
      >
        {COLS}
        <thead>
          <tr>
            <th className={TH}>البيان</th>
            <th className={TH}>الشهر</th>
            <th className={TH}>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className={`${TD} text-right font-semibold leading-tight wrap-anywhere`}>
              {ta.subject.name}
              <div className="font-normal" style={{ fontSize: rcp(0.85) }}>
                {ta.teacher.firstName} {ta.teacher.lastName}
              </div>
            </td>
            <td className={`${TD} tabular-nums`} dir="ltr">
              {pad(invoice.month)}/{invoice.year}
            </td>
            <td className={`${TD} font-bold tabular-nums`}>
              <Amount value={invoice.amount} />
            </td>
          </tr>
        </tbody>
      </table>

      <TotalBox label="المطلوب" value={invoice.remaining} />

      {/* الملخّص — التخفيض والمدفوع يظهران إن وُجدا فقط */}
      <div
        className="mt-2 flex flex-col gap-0.5 text-center font-bold"
        style={{ fontSize: rcp(1.09) }}
      >
        <div>المبلغ : <Money value={invoice.amount} /></div>
        {invoice.discount > 0 && (
          <div>التخفيض : <Money value={invoice.discount} /></div>
        )}
        <div>الإجمالي : <Money value={invoice.total} /></div>
        {paid > 0 && <div>المدفوع : <Money value={paid} /></div>}
        <div>المتبقّي : <Money value={invoice.remaining} /></div>
      </div>

      {invoice.status === "CANCELLED" && (
        <div
          className="mt-2 border-2 border-black px-2 py-1 font-black"
          style={{ fontSize: rcp(1.27) }}
        >
          — فاتورة ملغاة —
        </div>
      )}

      <CodeBlock value={invoice.invoiceNumber} />

      <Footer stamp={stamp} />
    </div>
  );
}

// --------------------------------------------------
// الإيصال — دفعة قد تغطّي عدّة فواتير
// --------------------------------------------------

export function ReceiptDoc({ payment }: { payment: Payment }) {
  const first = payment.paymentInvoices[0]?.invoice.studentEnrollment.student;
  const remainingAfter = payment.paymentInvoices.reduce(
    (s, pi) => s + pi.invoice.remaining,
    0,
  );
  const stamp = stampOf(new Date());
  const number = payment.receipt?.receiptNumber ?? payment.paymentNumber;

  return (
    <div
      className="receipt-card bg-white px-2 py-2 text-center text-black"
      style={{ fontFamily: '"Tahoma","Arial",sans-serif' }}
    >
      <Header title="إيصال دفع" />

      <div
        className="mt-2 flex flex-col gap-1 border-t border-black pt-1.5 text-right"
        style={{ fontSize: rcp(1) }}
      >
        <Pair
          label="الطالب"
          value={first ? `${first.firstName} ${first.lastName}` : "—"}
        />
        <Pair label="رقم الإيصال" value={number} ltr />
        <Pair label="رقم الدفعة" value={payment.paymentNumber} ltr />
        <Pair label="التاريخ" value={dateOf(payment.paymentDate)} ltr />
        <Pair label="طريقة الدفع" value={METHOD_LABEL[payment.paymentMethod]} />
        {payment.receivedBy && (
          <Pair label="استلمها" value={payment.receivedBy.username} ltr />
        )}
      </div>

      {/* الجدول — سطر لكل فاتورة سُدِّدت بهذه الدفعة */}
      <table
        className="mt-2 w-full table-fixed border-collapse"
        style={{ fontSize: rcp(1) }}
      >
        {COLS}
        <thead>
          <tr>
            <th className={TH}>البيان</th>
            <th className={TH}>الشهر</th>
            <th className={TH}>المدفوع</th>
          </tr>
        </thead>
        <tbody>
          {payment.paymentInvoices.map((pi) => (
            <tr key={pi.id}>
              <td className={`${TD} text-right font-semibold leading-tight wrap-anywhere`}>
                {pi.invoice.studentEnrollment.teachingAssignment.subject.name}
                {pi.invoice.remaining > 0 && (
                  <div className="font-normal" style={{ fontSize: rcp(0.85) }}>
                    متبقٍّ <Amount value={pi.invoice.remaining} />
                  </div>
                )}
              </td>
              <td className={`${TD} tabular-nums`} dir="ltr">
                {pad(pi.invoice.month)}/{pi.invoice.year}
              </td>
              <td className={`${TD} font-bold tabular-nums`}>
                <Amount value={pi.paidAmount} />
              </td>
            </tr>
          ))}

          {payment.paymentInvoices.length === 0 && (
            <tr>
              <td colSpan={3} className="border border-black py-3">
                لا فواتير
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <TotalBox label="المجموع" value={payment.amount} />

      <div
        className="mt-2 flex flex-col gap-0.5 text-center font-bold"
        style={{ fontSize: rcp(1.09) }}
      >
        <div>عدد الفواتير : {payment.paymentInvoices.length}</div>
        <div>المدفوع : <Money value={payment.amount} /></div>
        <div>المتبقّي بعد الدفع : <Money value={remainingAfter} /></div>
      </div>

      {payment.status === "CANCELLED" && (
        <div
          className="mt-2 border-2 border-black px-2 py-1 font-black"
          style={{ fontSize: rcp(1.27) }}
        >
          — دفعة ملغاة —
        </div>
      )}

      <CodeBlock value={number} />

      <Footer stamp={stamp} />
    </div>
  );
}

export { MONTHS };
