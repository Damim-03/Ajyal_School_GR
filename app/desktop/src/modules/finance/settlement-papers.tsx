/**
 * أوراقُ التخليص المحفوظة — الممسوحة والمجمَّدة.
 *
 * لكلّ تخليصٍ في الأرشيف وجهان من الحفظ:
 *
 *   • **الورقة الممسوحة**: الكشف التقديري موقَّعاً من الأستاذ والإدارة.
 *     والورقة تُطبع على وجهٍ واحد غالباً وعلى وجهين حين تطول، فلها
 *     خانتان — والخلفيّة **اختيارية** لا ناقصة.
 *
 *   • **اللقطة المجمَّدة**: كشفُ الحضور اليومي وكشفُ دفع الحقوق كما
 *     كانا لحظة الدفع. ومعطياتُهما حيّة في القاعدة تتبدّل بعد ذلك —
 *     حضورٌ يُصحَّح ودَينٌ يُسدَّد — فالمعروض هنا ما وُقّع عليه لا ما
 *     صارت إليه.
 *
 * والمكوّنات هنا مشتركة بين نافذة إثبات الدفع وشاشة الأرشيف: المسحُ
 * سلوكٌ واحد، فلا يُكتب مرّتين ولا يفترقان عند أوّل تعديل.
 */

import { useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  CircleCheckBig,
  ClipboardCheck,
  Eye,
  FileText,
  Loader2,
  Trash2,
  Wallet,
  X,
} from "lucide-react";

import { MotionDialog } from "../../motion/MotionDialog";
import { ImageIntake } from "../../components/shared/ImageIntake";
import { assetUrl } from "../../lib/asset-url";
import { formatMoney as money } from "../../core/utils/money";
import { uploadImage } from "../students/student.api";
import {
  attachSettlementDocument,
  removeSettlementDocument,
  type SettlementDocument,
  type SettlementSnapshot,
} from "./teacher-payments.api";

/**
 * الورقة الموقَّعة صفحاتٌ لا وجهان.
 *
 * كانت خانتين ثابتتين — أمامية وخلفية — والواقع أنّ الكشف التقديري
 * يطول فيُطبع على ثلاث صفحاتٍ وأربع، وتعود من الأستاذ موقَّعةً كلُّها.
 * فما زاد على الوجهين لم يكن له موضع، ومسحُه كان يحلّ محلّ ما قبله.
 *
 * فصارت قائمةً تُزاد بزرّ: الصفحة الأولى تُمسح، ثمّ «أضف صفحة» لكلّ
 * ما بعدها بلا حدّ. والترتيب هو ترتيب القراءة لا ترتيب المسح.
 */
const sorted = (documents: SettlementDocument[]) =>
  [...documents].sort((a, b) => a.pageNumber - b.pageNumber);

const pageLabel = (document: SettlementDocument) =>
  `الصفحة ${document.pageNumber}`;

// --------------------------------------------------
// خانتا المسح
// --------------------------------------------------

export function PaperSlots({
  settlementId,
  documents,
  canEdit,
  accent,
  onChange,
  onFail,
}: {
  settlementId: string;
  documents: SettlementDocument[];
  canEdit: boolean;
  accent: string;
  /** الأوراق بعد الإضافة أو الحذف — الأب يحفظها */
  onChange: (next: SettlementDocument[]) => void;
  onFail: (message: string) => void;
}) {
  /** رقمُ الصفحة المشغولة الآن — أو `0` للصفحة الجديدة */
  const [busy, setBusy] = useState<number | null>(null);
  const [viewing, setViewing] = useState(false);

  const pages = sorted(documents);

  /**
   * `pageNumber` فارغاً يعني «صفحةٌ تالية» — والخادم يحسب رقمها.
   *
   * ولا يُحسب هنا: صفحةٌ أُضيفت من جهازٍ آخر بين قراءة القائمة والمسح
   * تجعل الرقمَ المحسوب في الواجهة يحلّ محلّ صفحةٍ قائمة.
   */
  const attach = async (pageNumber: number | null, file: File) => {
    setBusy(pageNumber ?? 0);

    try {
      const path = await uploadImage(file);
      const document = await attachSettlementDocument(settlementId, {
        filePath: path,
        fileName: file.name,
        pageNumber,
      });

      /* الصفحة الواحدة تُستبدل لا تُراكم — كما يفعل الخادم */
      onChange([
        ...documents.filter((d) => d.pageNumber !== document.pageNumber),
        document,
      ]);
    } catch {
      onFail("تعذّر حفظ الورقة");
    } finally {
      setBusy(null);
    }
  };

  const drop = async (document: SettlementDocument) => {
    try {
      await removeSettlementDocument(document.id);
      onChange(documents.filter((d) => d.id !== document.id));
    } catch {
      onFail("تعذّر حذف الورقة");
    }
  };

  const scanned = documents.length > 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[11px] font-bold text-white/50">
          الورقة الموقَّعة
          {scanned
            ? ` — ${pages.length} ${pages.length === 1 ? "صفحة" : "صفحات"}`
            : " — لم تُمسح بعد"}
        </span>

        {scanned && (
          <button
            onClick={() => setViewing(true)}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:bg-white/10"
          >
            <Eye className="h-3.5 w-3.5" />
            عرض الورقة كاملةً
          </button>
        )}
      </div>

      <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
        {pages.map((document) => (
          <div
            key={document.id}
            className="rounded-lg border bg-black/20 p-3"
            style={{ borderColor: `${accent}44` }}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/70">
                {pageLabel(document)}
              </span>
              <CircleCheckBig className="h-3.5 w-3.5" style={{ color: accent }} />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewing(true)}
                className="min-w-0 flex-1 truncate text-start text-[11px] font-bold text-white/80 hover:text-white"
              >
                <FileText className="me-1.5 inline h-3 w-3 text-white/35" />
                {document.fileName ?? pageLabel(document)}
              </button>

              {canEdit && (
                <>
                  <ImageIntake
                    aspect="a4"
                    editorTitle={pageLabel(document)}
                    busy={busy === document.pageNumber}
                    onFile={(file) => attach(document.pageNumber, file)}
                  >
                    استبدال
                  </ImageIntake>

                  <button
                    onClick={() => drop(document)}
                    aria-label="حذف"
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white/35 transition hover:bg-rose-500/15 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}

        {/*
          الخانة الفارغة الأخيرة — هي زرُّ الإضافة نفسُه.
          لا زرَّ منفصلٌ عن الخانات: الموضعُ الذي ستشغله الصفحة الجديدة
          هو الذي يُنقر لمسحها، فيُرى أين ستقع قبل أن تُمسح.
        */}
        {canEdit && (
          <div className="rounded-lg border border-dashed border-white/15 bg-black/10 p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-white/50">
                {pages.length === 0
                  ? "الصفحة الأولى"
                  : `الصفحة ${pages.length + 1}`}
              </span>
              <span className="text-[10px] text-white/30">
                {pages.length === 0 ? "الكشف موقَّعاً" : "أضِف ما بقي من الصفحات"}
              </span>
            </div>

            <ImageIntake
              aspect="a4"
              editorTitle={`الصفحة ${pages.length + 1}`}
              busy={busy === 0}
              onFile={(file) => attach(null, file)}
            >
              {pages.length === 0 ? "مسح أو رفع" : "أضف صفحة"}
            </ImageIntake>
          </div>
        )}

        {!canEdit && pages.length === 0 && (
          <p className="rounded-lg border border-white/10 bg-black/20 p-3 text-[11px] text-white/25">
            لم تُمسح بعد
          </p>
        )}
      </div>

      <AnimatePresence>
        {viewing && (
          <ScannedPaperDialog
            documents={documents}
            accent={accent}
            onClose={() => setViewing(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// --------------------------------------------------
// عرضُ الورقة بوجهيها
// --------------------------------------------------

function ScannedPaperDialog({
  documents,
  accent,
  onClose,
}: {
  documents: SettlementDocument[];
  accent: string;
  onClose: () => void;
}) {
  const pages = sorted(documents).map((document) => ({
    label: pageLabel(document),
    document,
  }));

  return (
    <MotionDialog
      onClose={onClose}
      className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header className="flex items-center gap-3 border-b border-white/10 px-6 py-4">
        <FileText className="h-5 w-5 shrink-0" style={{ color: accent }} />
        <h3 className="flex-1 text-base font-black">الورقة الموقَّعة</h3>
        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      {/* الصفحات كلُّها في تمريرةٍ واحدة — كما تُقلَّب الورقة باليد */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-black/20 px-6 py-5">
        {pages.map((page, index) => (
          <figure key={page.document!.id} className="space-y-2">
            <figcaption className="flex items-center gap-2 text-[11px] font-bold text-white/50">
              <span
                className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-black"
                style={{ background: `${accent}22`, color: accent }}
              >
                {index + 1}
              </span>
              {page.label}
            </figcaption>

            <img
              src={assetUrl(page.document!.filePath) ?? page.document!.filePath}
              alt={page.label}
              className="w-full rounded-xl border border-white/10 bg-white"
            />
          </figure>
        ))}
      </div>
    </MotionDialog>
  );
}

// --------------------------------------------------
// اللقطة المجمَّدة — الكشفان كما وُقّع عليهما
// --------------------------------------------------

interface SnapshotStudent {
  enrollmentId: string;
  student: { id: string; firstName: string; lastName: string; parentPhone: string | null };
  attended?: number;
  late?: number;
  absent?: number;
  excused?: number;
  blank?: number;
  present: number;
  invoice?: { total: number; paid: number; remaining: number } | null;
  defaulter?: boolean;
  uninvoiced?: boolean;
}

interface DailySnapshot {
  sessions: { id: string; sessionDate: string; status: string; marks: { studentEnrollmentId: string; status: string }[] }[];
  students: SnapshotStudent[];
}

interface FeesSnapshot {
  tuition: number;
  students: SnapshotStudent[];
  totals?: { grossTuition?: number; collected?: number; remaining?: number };
}

const MARK: Record<string, string> = {
  PRESENT: "ح",
  LATE: "ح",
  ABSENT: "غ",
  EXCUSED: "م",
};

const dayOf = (iso: string) => new Date(iso).toLocaleDateString("fr-DZ");

export function SnapshotDialog({
  kind,
  snapshot,
  title,
  currency,
  accent,
  onClose,
}: {
  kind: "daily" | "fees";
  snapshot: SettlementSnapshot;
  title: string;
  currency: string;
  accent: string;
  onClose: () => void;
}) {
  const daily = snapshot.dailySheet as DailySnapshot;
  const fees = snapshot.monthlyFees as FeesSnapshot;

  return (
    <MotionDialog
      onClose={onClose}
      className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header
        className="flex items-center gap-3 px-6 py-4"
        style={{ background: `linear-gradient(120deg, ${accent}22, transparent)` }}
      >
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
          style={{ background: `${accent}1f`, color: accent }}
        >
          {kind === "daily" ? <ClipboardCheck className="h-5 w-5" /> : <Wallet className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-black leading-tight">
            {kind === "daily" ? "كشف الحضور اليومي" : "كشف دفع الحقوق الشهري"}
          </h3>
          <p className="truncate text-[11px] text-white/45">
            {title} · لقطةٌ مجمَّدة لحظة الدفع
          </p>
        </div>

        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-auto px-6 py-5">
        <p className="mb-3 text-[11px] leading-relaxed text-white/40">
          هذه صورةُ الكشف كما كان يوم الدفع — لا تتغيّر بتصحيحِ حضورٍ ولا بسدادِ
          دَينٍ بعده.
        </p>

        {kind === "daily" ? (
          <DailyTable daily={daily} />
        ) : (
          <FeesTable fees={fees} currency={currency} accent={accent} />
        )}
      </div>
    </MotionDialog>
  );
}

function DailyTable({ daily }: { daily: DailySnapshot }) {
  const sessions = daily?.sessions ?? [];
  const students = daily?.students ?? [];

  /* خريطةُ العلامات: تسجيل ← حصة ← حالة */
  const marks = new Map<string, string>();
  for (const session of sessions) {
    for (const mark of session.marks ?? []) {
      marks.set(`${mark.studentEnrollmentId}|${session.id}`, mark.status);
    }
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-white/10 text-xs text-white/50">
          <th className="w-12 px-2 py-2.5 text-center font-bold">#</th>
          <th className="px-3 py-2.5 text-start font-bold">اللقب والاسم</th>
          {sessions.map((session, i) => (
            <th key={session.id} className="w-20 px-1.5 py-2 text-center font-bold">
              <span className="block whitespace-nowrap">الحصة {i + 1}</span>
              <span className="mt-0.5 block text-[10px] font-normal text-white/30" dir="ltr">
                {dayOf(session.sessionDate)}
              </span>
            </th>
          ))}
          <th className="w-20 px-2 py-2.5 text-center font-bold">الحضور</th>
        </tr>
      </thead>

      <tbody>
        {students.map((row, index) => (
          <tr key={row.enrollmentId} className="border-b border-white/5 last:border-0">
            <td className="px-2 py-2 text-center text-white/40">{index + 1}</td>
            <td className="px-3 py-2 font-bold">
              {row.student.lastName} {row.student.firstName}
            </td>
            {sessions.map((session) => {
              const mark = marks.get(`${row.enrollmentId}|${session.id}`);

              return (
                <td
                  key={session.id}
                  className="px-1.5 py-2 text-center font-black"
                  style={{ color: mark === "ABSENT" ? "#fda4af" : "#86efac" }}
                >
                  {mark ? (MARK[mark] ?? mark) : ""}
                </td>
              );
            })}
            <td className="px-2 py-2 text-center font-black text-white/85">{row.present}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FeesTable({
  fees,
  currency,
  accent,
}: {
  fees: FeesSnapshot;
  currency: string;
  accent: string;
}) {
  const students = fees?.students ?? [];

  return (
    <>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 text-xs text-white/50">
            <th className="w-12 px-2 py-2.5 text-center font-bold">#</th>
            <th className="px-3 py-2.5 text-start font-bold">اللقب والاسم</th>
            <th className="w-20 px-2 py-2.5 text-center font-bold">حضر</th>
            <th className="w-28 px-2 py-2.5 text-center font-bold">الحقّ</th>
            <th className="w-28 px-2 py-2.5 text-center font-bold">المدفوع</th>
            <th className="w-28 px-2 py-2.5 text-center font-bold">الدَّين</th>
            <th className="w-24 px-2 py-2.5 text-center font-bold">الحالة</th>
          </tr>
        </thead>

        <tbody>
          {students.map((row, index) => (
            <tr key={row.enrollmentId} className="border-b border-white/5 last:border-0">
              <td className="px-2 py-2 text-center text-white/40">{index + 1}</td>
              <td className="px-3 py-2 font-bold">
                {row.student.lastName} {row.student.firstName}
              </td>
              <td className="px-2 py-2 text-center font-black" style={{ color: accent }}>
                {row.present}
              </td>
              <td className="px-2 py-2 text-center text-white/70">
                {row.invoice ? money(row.invoice.total, currency) : "—"}
              </td>
              <td className="px-2 py-2 text-center text-white/70">
                {row.invoice ? money(row.invoice.paid, currency) : "—"}
              </td>
              <td
                className="px-2 py-2 text-center font-black"
                style={{ color: row.defaulter ? "#fda4af" : "#86efac" }}
              >
                {row.invoice ? money(row.invoice.remaining, currency) : "—"}
              </td>
              <td className="px-2 py-2 text-center text-[11px] font-bold text-white/60">
                {row.uninvoiced ? "بلا فاتورة" : row.defaulter ? "مخلَّف" : "سدّد"}
              </td>
            </tr>
          ))}
        </tbody>

        {fees?.totals && (
          <tfoot>
            <tr className="border-t border-white/15 bg-white/[0.03] text-xs">
              <td colSpan={3} className="px-3 py-2.5 text-end font-bold text-white/60">
                المجاميع
              </td>
              <td className="px-2 py-2.5 text-center font-black">
                {money(fees.totals.grossTuition ?? 0, currency)}
              </td>
              <td className="px-2 py-2.5 text-center font-black text-emerald-300">
                {money(fees.totals.collected ?? 0, currency)}
              </td>
              <td className="px-2 py-2.5 text-center font-black text-rose-300">
                {money(fees.totals.remaining ?? 0, currency)}
              </td>
              <td />
            </tr>
          </tfoot>
        )}
      </table>

      {students.length === 0 && (
        <p className="py-10 text-center text-sm text-white/40">
          <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin opacity-40" />
          لا معطيات في هذه اللقطة
        </p>
      )}
    </>
  );
}
