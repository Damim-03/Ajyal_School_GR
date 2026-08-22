import { useState } from "react";
import { motion } from "motion/react";
import { BadgeCheck, Loader2, Printer, X } from "lucide-react";

import { PrintPreview } from "../../../components/print/PrintPreview";
import { ReceiptDoc } from "../../finance/PrintDocs";
import { markReceiptPrinted, type Payment } from "../../finance/finance.api";
import { useAuthStore } from "../../../core/stores/auth.store";
import { formatMoney as money } from "../../../core/utils/money";
import { MOTION } from "../../../motion/system";

/**
 * ما بعد قبض المال — رقمُ الإيصال ثمّ الورقة.
 *
 * الدفعة في كشف الحقوق كانت تنتهي بسطرٍ أخضر عابر: «خالص — فلان».
 * والشبّاك يحتاج أكثر: الوليُّ واقفٌ ينتظر ورقتَه، والإدارة تحتاج رقم
 * الإيصال الذي حُفظ في المالية لتجده حين يُسأل عنه بعد شهر. فتُعرض
 * الأرقام أوّلاً — رقمُ الفاتورة ورقمُ الإيصال — ثمّ تُطبع الورقة.
 *
 * **والطباعة هنا تخرج مباشرة بلا معاينة.** المعاينة تكفي في شاشة
 * المالية حيث يُراجَع إيصالٌ قديم ويُعاد طبعه بتأنٍّ؛ أمّا هنا فالدفعة
 * وقعت للتوّ وما يُطبع هو ما قُبض قبل ثانية — والمعاينةُ في طريقٍ
 * يتكرّر عشرات المرّات في اليوم عائقٌ لا حارس. وإن تعذّرت الطباعة
 * ظهرت نافذةُ المعاينة كاملةً برسالتها، فيبقى الاختيار بيد الإدارة.
 */
export function PaymentDoneDialog({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) {
  const can = useAuthStore((s) => s.hasPermission);
  const [printing, setPrinting] = useState(false);

  const line = payment.paymentInvoices[0];
  const student = line?.invoice.studentEnrollment.student;
  const receipt = payment.receipt;

  /*
   * الطباعة الأولى وإعادتُها صلاحيتان لا واحدة — والخادم يرفض تسجيل
   * الأولى مرّتين. فمن لا يملك المناسبةَ منهما لا يُعرض له الزرّ أصلاً
   * بدل أن يضغطه فترتدّ عليه رسالة.
   */
  const mayPrint = can(receipt?.printed ? "receipt.reprint" : "receipt.print");

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast }}
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-115 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-emerald-400/25 bg-[#0a0f1a] p-6"
      >
        <header className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15">
            <BadgeCheck className="h-5 w-5 text-emerald-300" />
          </span>

          <div className="flex-1">
            <h3 className="text-lg font-black text-emerald-200">تمّ إثبات الدفع</h3>
            <p className="mt-0.5 text-xs text-white/45">
              {student ? `${student.lastName} ${student.firstName}` : "—"} —{" "}
              حُفظت الدفعة في المالية بالأرقام التالية.
            </p>
          </div>

          <button
            onClick={onClose}
            className="rounded-full bg-white/5 p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <dl className="space-y-px overflow-hidden rounded-xl border border-white/10">
          <Row label="رقم الإيصال" value={receipt?.receiptNumber ?? "—"} strong />
          <Row label="رقم الفاتورة" value={line?.invoice.invoiceNumber ?? "—"} />
          <Row label="رقم الدفعة" value={payment.paymentNumber} />
          <Row label="المبلغ المقبوض" value={money(payment.amount)} strong />
        </dl>

        <p className="mt-3 text-[11px] leading-relaxed text-white/35">
          الإيصال محفوظٌ في شاشة المالية برقمه — يُراجع ويُعاد طبعُه منها متى
          طُلب. والطباعة هنا تخرج مباشرةً إلى الطابعة المختارة بلا معاينة.
        </p>

        <div className="mt-5 flex gap-2.5">
          {mayPrint && receipt && (
            <button
              onClick={() => setPrinting(true)}
              disabled={printing}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-400 px-4 py-3 text-sm font-black text-[#04121f] transition hover:brightness-110 disabled:opacity-60"
            >
              {printing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Printer className="h-4 w-4" />
              )}
              {receipt.printed ? "إعادة طباعة الإيصال" : "طباعة الإيصال"}
            </button>
          )}

          <button
            onClick={onClose}
            className="rounded-xl border border-white/10 px-5 py-3 text-sm font-bold text-white/70 transition hover:bg-white/10"
          >
            إغلاق
          </button>
        </div>
      </motion.div>

      {printing && (
        <PrintPreview
          auto
          doc={{
            title: `إيصال ${receipt?.receiptNumber ?? payment.paymentNumber}`,
            render: () => <ReceiptDoc payment={payment} />,
            onPrinted: async () => {
              if (!receipt) return;

              try {
                await markReceiptPrinted(receipt.id, receipt.printed);
              } catch {
                /* الورقة خرجت فعلاً — فشل التعليم لا يُبطلها */
              }
            },
          }}
          onClose={() => setPrinting(false)}
        />
      )}
    </>
  );
}

/** سطرُ رقمٍ في البطاقة — الرقم لاتينيُّ الاتجاه دائماً */
function Row({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 bg-white/[0.03] px-4 py-2.5">
      <dt className="text-xs text-white/45">{label}</dt>
      <dd
        className={`font-mono text-sm ${strong ? "font-black text-emerald-200" : "font-bold text-white/80"}`}
        dir="ltr"
      >
        {value}
      </dd>
    </div>
  );
}
