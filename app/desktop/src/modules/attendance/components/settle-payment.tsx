/**
 * إثبات الدفع للأستاذ — نافذةٌ بخطوتين.
 *
 * الخطوة الأولى **مال**: مَن الأستاذ، وكم استحقّ، وعن أيّ الأفواج.
 * والتخليص في النظام واحدٌ لكل (مادة + فوج + كشف)، والأستاذ يدرّس
 * ثلاثة أفواج — فتُجمع كشوفه غير المدفوعة في دفعةٍ واحدة بورقةٍ واحدة،
 * لا ثلاث عمليّاتٍ يُنسى ثالثتُها.
 *
 * والخطوة الثانية **إقرار**: الورقة تُطبع وتُمضى من الأستاذ والإدارة،
 * ثمّ تُمسح وتُلحق بالتخليص. فالسطر في القاعدة يقول «دُفع»، والورقة
 * الممسوحة تقول «وهذا إمضاؤه» — وهي التي تُخرَج عند النزاع.
 *
 * وبينهما لحظةُ الحفظ: عند إثبات الدفع يُجمِّد الخادم لقطةَ كشف
 * الحضور وكشف الحقوق كما هما، فما يُفتح من الأرشيف بعد سنةٍ هو ما رآه
 * الأستاذ حين أمضى.
 */

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "motion/react";
import {
  BadgeCheck,
  CircleAlert,
  CircleCheckBig,
  Loader2,
  ScanLine,
  Wallet,
  X,
} from "lucide-react";

import { MotionDialog } from "../../../motion/MotionDialog";
import { DateField, todayIso } from "../../../components/DateField";
import { formatMoney as money } from "../../../core/utils/money";
import { PaperSlots } from "../../finance/settlement-papers";
import {
  computeSettlement,
  confirmSettlement,
  listDebtShares,
  listSettlements,
  payTeacher,
  TEACHER_PAYMENT_METHOD_LABEL,
  type DebtShare,
  type SettlementDocument,
  type SettlementRow,
  type TeacherPayment,
  type TeacherPaymentMethod,
} from "../../finance/teacher-payments.api";

const ACCENT = "#93c5fd";

/** رسالةُ الخادم إن شرح السبب — وإلّا نصٌّ مفهوم بدل «[object Object]» */
const failure = (err: unknown, fallback: string) =>
  (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback;

/** وصفُ الكشف كما يُقرأ في سطرٍ واحد */
const sheetLabel = (row: SettlementRow) =>
  `${row.teachingAssignment.subject.name} · ${row.teachingAssignment.studyGroup.name} · ` +
  (row.attendanceSheet.label?.trim() || `الشهر رقم ${row.attendanceSheet.number}`);

export function SettlePaymentDialog({
  teacherId,
  teacherName,
  teacherPhone,
  academicYearId,
  /** الكشف المفتوح — يُقترح أوّلاً ويُخلَّص إن لم يكن مخلَّصاً */
  teachingAssignmentId,
  attendanceSheetId,
  currency,
  onClose,
  onDone,
}: {
  teacherId: string;
  teacherName: string;
  teacherPhone?: string | null;
  academicYearId: string;
  teachingAssignmentId: string;
  attendanceSheetId: string;
  currency: string;
  onClose: () => void;
  /** الدفع وقع — الشاشة تُحدِّث نفسها */
  onDone: (message: string) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);

  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  /** متأخّراتٌ حُصّلت بعد تخليصها — تُدمج في هذه الدفعة */
  const [shares, setShares] = useState<DebtShare[]>([]);
  const [pickedShares, setPickedShares] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [method, setMethod] = useState<TeacherPaymentMethod>("CASH");
  const [date, setDate] = useState(todayIso());
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");

  const [payment, setPayment] = useState<TeacherPayment | null>(null);

  // --------------------------------------------------
  // ما يستحقّه الأستاذ ولم يُدفع
  // --------------------------------------------------

  /**
   * حالةُ تخليص الكشف المفتوح.
   *
   * لا يكفي أن نسأل «هل هو بين المؤكَّدة؟»: المدفوعُ ليس بينها أيضاً،
   * فيبدو كأنّه لم يُخلَّص فيُعرض عليه الدفع مرّةً ثانية. فتُقرأ حالتُه
   * صراحةً — وإن كانت «مدفوع» أُغلق الباب وقيل ذلك.
   */
  const [openSheet, setOpenSheet] = useState<SettlementRow | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);

    try {
      const [ready, forSheet, pending] = await Promise.all([
        listSettlements({ teacherId, academicYearId, status: "CONFIRMED" }),
        listSettlements({ teachingAssignmentId, attendanceSheetId }),
        listDebtShares({ teacherId, status: "PENDING" }),
      ]);

      setRows(ready.settlements);
      /* كلُّ المؤكَّدة مقترحةٌ أوّلاً، وللمستخدم أن ينزع منها */
      setPicked(new Set(ready.settlements.map((s) => s.id)));

      setShares(pending.shares);
      setPickedShares(new Set(pending.shares.map((s) => s.id)));

      /* الملغى لا يُعتدّ به — البديلُ يأخذ مكانه */
      setOpenSheet(
        forSheet.settlements.find((row) => row.status !== "CANCELLED") ?? null,
      );
    } catch (err) {
      setError(failure(err, "تعذّر جلب التخليصات"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teacherId, academicYearId]);

  /** الكشف المفتوح دُفع فعلاً — فلا يُدفع ثانيةً */
  const openSheetPaid = openSheet?.status === "PAID";

  /** لم يُخلَّص بعد، أو بقي مسوّدةً — فيُعرض طريقُ تخليصه */
  const openSheetPending = !openSheet || openSheet.status === "DRAFT";

  const total = useMemo(
    () =>
      rows.filter((r) => picked.has(r.id)).reduce((sum, r) => sum + r.teacherAmount, 0) +
      shares.filter((s) => pickedShares.has(s.id)).reduce((sum, s) => sum + s.shareAmount, 0),
    [rows, picked, shares, pickedShares],
  );

  /** يحسب تخليص الكشف المفتوح ويؤكّده — خطوةٌ تسبق الدفع */
  const settleOpenSheet = async () => {
    setBusy(true);
    setError(null);

    try {
      const draft = await computeSettlement({
        teachingAssignmentId,
        attendanceSheetId,
      });

      if (draft.status === "DRAFT") await confirmSettlement(draft.id);

      await load();
    } catch (err) {
      setError(failure(err, "تعذّر تخليص هذا الكشف"));
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    if (picked.size + pickedShares.size === 0 || busy) return;

    setBusy(true);
    setError(null);

    try {
      const done = await payTeacher({
        teacherId,
        settlementIds: [...picked],
        debtShareIds: [...pickedShares],
        paymentMethod: method,
        paymentDate: date,
        reference: reference.trim() || null,
        note: note.trim() || null,
      });

      setPayment(done);
      setStep(2);
      onDone(`دُفع للأستاذ ${teacherName} — ${money(done.amount, currency)}`);
    } catch (err) {
      setError(failure(err, "تعذّر إثبات الدفع"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionDialog
      onClose={onClose}
      labelledBy="settle-title"
      closeOnBackdrop={false}
      className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header
        className="flex items-center gap-3 px-6 py-4"
        style={{ background: `linear-gradient(120deg, ${ACCENT}22, transparent)` }}
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${ACCENT}1f`, color: ACCENT }}
        >
          {step === 1 ? <Wallet className="h-5 w-5" /> : <ScanLine className="h-5 w-5" />}
        </span>

        <div className="min-w-0 flex-1">
          <h3 id="settle-title" className="text-base font-black leading-tight">
            {step === 1 ? "إثبات الدفع للأستاذ" : "الورقة الموقَّعة"}
          </h3>
          <p className="truncate text-[11px] text-white/45">
            {step === 1
              ? "كلُّ ما استحقّه ولم يُدفع — في دفعةٍ واحدة"
              : "امسح الورقة بعد إمضاء الأستاذ والإدارة، فتُحفظ في الأرشيف"}
          </p>
        </div>

        {/* مؤشّر الخطوتين — في الترويسة فلا يتمرّر */}
        <div className="flex items-center gap-1.5">
          {[1, 2].map((n) => (
            <span
              key={n}
              className="h-1.5 w-8 rounded-full transition"
              style={{ background: step >= n ? ACCENT : "rgba(255,255,255,0.12)" }}
            />
          ))}
        </div>

        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
        {error && (
          <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs leading-relaxed text-rose-100">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1 whitespace-pre-line">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {step === 1 ? (
          <StepPay
            teacherName={teacherName}
            teacherPhone={teacherPhone}
            currency={currency}
            rows={rows}
            picked={picked}
            setPicked={setPicked}
            shares={shares}
            pickedShares={pickedShares}
            setPickedShares={setPickedShares}
            loading={loading}
            busy={busy}
            openSheetPaid={openSheetPaid}
            openSheetPending={openSheetPending}
            onSettleOpenSheet={settleOpenSheet}
            method={method}
            setMethod={setMethod}
            date={date}
            setDate={setDate}
            reference={reference}
            setReference={setReference}
            note={note}
            setNote={setNote}
            total={total}
          />
        ) : (
          payment && <StepScan payment={payment} currency={currency} onFail={setError} />
        )}
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        {step === 1 ? (
          <>
            <button
              onClick={submit}
              disabled={picked.size + pickedShares.size === 0 || busy || loading}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-40"
              style={{ background: ACCENT }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
              إثبات الدفع
              {picked.size + pickedShares.size > 0 && ` — ${money(total, currency)}`}
            </button>

            <button
              onClick={onClose}
              className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20"
            >
              إلغاء
            </button>

            <span className="ms-auto text-[11px] text-white/30">
              الدفع يُجمِّد لقطة الكشفين — لا يُغيّر حضوراً ولا فاتورة
            </span>
          </>
        ) : (
          <>
            <button
              onClick={onClose}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <CircleCheckBig className="h-4 w-4" />
              تمّ
            </button>

            <span className="ms-auto text-[11px] text-white/30">
              يمكن إلحاق الورقة لاحقاً من شاشة الأرشيف
            </span>
          </>
        )}
      </footer>
    </MotionDialog>
  );
}

// --------------------------------------------------
// الخطوة الأولى — المال
// --------------------------------------------------

function StepPay({
  teacherName,
  teacherPhone,
  currency,
  rows,
  picked,
  setPicked,
  shares,
  pickedShares,
  setPickedShares,
  loading,
  busy,
  openSheetPaid,
  openSheetPending,
  onSettleOpenSheet,
  method,
  setMethod,
  date,
  setDate,
  reference,
  setReference,
  note,
  setNote,
  total,
}: {
  teacherName: string;
  teacherPhone?: string | null;
  currency: string;
  rows: SettlementRow[];
  picked: Set<string>;
  setPicked: (next: Set<string>) => void;
  shares: DebtShare[];
  pickedShares: Set<string>;
  setPickedShares: (next: Set<string>) => void;
  loading: boolean;
  busy: boolean;
  /** الكشف المفتوح دُفع — لا يُدفع مرّتين */
  openSheetPaid: boolean;
  /** لم يُخلَّص بعد أو بقي مسوّدة */
  openSheetPending: boolean;
  onSettleOpenSheet: () => void;
  method: TeacherPaymentMethod;
  setMethod: (m: TeacherPaymentMethod) => void;
  date: string;
  setDate: (d: string) => void;
  reference: string;
  setReference: (r: string) => void;
  note: string;
  setNote: (n: string) => void;
  total: number;
}) {
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setPicked(next);
  };

  return (
    <div className="space-y-5">
      {/* ============ الأستاذ ============ */}
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm">
        <span className="flex items-baseline gap-2">
          <span className="text-[11px] text-white/40">الأستاذ:</span>
          <span className="font-black">{teacherName}</span>
        </span>

        {teacherPhone && (
          <span className="flex items-baseline gap-2">
            <span className="text-[11px] text-white/40">الهاتف:</span>
            <span className="font-bold text-white/85" dir="ltr">{teacherPhone}</span>
          </span>
        )}

        <span className="ms-auto flex items-baseline gap-2">
          <span className="text-[11px] text-white/40">المجموع المختار:</span>
          <span className="text-lg font-black" style={{ color: ACCENT }}>
            {money(total, currency)}
          </span>
        </span>
      </div>

      {/*
        الكشف المفتوح غير مخلَّص: يُعرض الطريق بدل الوقوف عند «لا شيء
        ليُدفع» — الحساب والتأكيد خطوتان في الخادم، وزرٌّ واحد هنا.
      */}
      {/*
        الكشفُ المفتوح دُفع: لا يُدفع مرّتين.

        وكان يُعرض عليه «خلّص هذا الكشف» لأنّه ليس بين المؤكَّدة — والمدفوع
        ليس بينها أيضاً. فصار يُقال صريحاً، ويبقى الطريق مفتوحاً لكشوفٍ
        أخرى إن وُجدت.
      */}
      {openSheetPaid && !loading && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-100">
          <CircleCheckBig className="h-4 w-4 shrink-0" />
          <span className="flex-1 leading-relaxed">
            هذا الكشف <span className="font-black">دُفع للأستاذ</span> — ويُقرأ في الأرشيف
            بورقته. والكشفُ التالي يُدفع حين يمتلئ.
          </span>
        </div>
      )}

      {openSheetPending && !loading && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-400/25 bg-amber-500/10 px-4 py-3 text-xs text-amber-100">
          <CircleAlert className="h-4 w-4 shrink-0" />
          <span className="flex-1 leading-relaxed">
            الكشف المفتوح لم يُخلَّص بعد — احسبه وأكّده ليدخل هذه الدفعة.
          </span>
          <button
            onClick={onSettleOpenSheet}
            disabled={busy}
            className="flex items-center gap-1.5 rounded-lg bg-amber-400/20 px-3 py-1.5 font-bold transition hover:bg-amber-400/30 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
            خلّص هذا الكشف
          </button>
        </div>
      )}

      {/* ============ التخليصات ============ */}
      <div className="overflow-hidden rounded-xl border border-white/10">
        <div className="flex items-center justify-between border-b border-white/10 bg-white/[0.03] px-4 py-2.5">
          <span className="text-xs font-bold text-white/60">
            كشوفٌ مؤكَّدة بانتظار الدفع ({rows.length})
          </span>
          <span className="text-[11px] text-white/35">انزع ما لا يدخل هذه الدفعة</span>
        </div>

        {loading ? (
          <div className="grid place-items-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/30" />
          </div>
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-white/45">
            لا تخليصَ مؤكَّداً لهذا الأستاذ في هذه السنة.
          </p>
        ) : (
          <ul className="divide-y divide-white/5">
            {rows.map((row) => {
              const on = picked.has(row.id);

              return (
                <li key={row.id}>
                  <button
                    onClick={() => toggle(row.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-white/[0.03]"
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
                      style={{
                        borderColor: on ? ACCENT : "rgba(255,255,255,0.2)",
                        background: on ? ACCENT : "transparent",
                      }}
                    >
                      {on && <CircleCheckBig className="h-3.5 w-3.5 text-[#04121c]" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{sheetLabel(row)}</span>
                      <span className="mt-0.5 block text-[11px] text-white/40">
                        {row.settlementNumber} · {row.completedSessionsSnapshot} حصة منجزة ·{" "}
                        {row.paidStudentCountSnapshot} من {row.studentCountSnapshot} سدّدوا
                      </span>
                    </span>

                    <span className="shrink-0 text-sm font-black" style={{ color: ACCENT }}>
                      {money(row.teacherAmount, currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/*
        ============ متأخّراتٌ من كشوفٍ سابقة ============

        دَينٌ سُدِّد بعد أن خُلِّص كشفُه. والماضي لا يُعدَّل — ورقةُ الشهر
        الأوّل تبقى كما وُقّع عليها — فتُدفع الحصة **مدموجةً** هنا،
        ومكتوبٌ عليها من أيّ كشفٍ جاءت وبأيّ رمز.
      */}
      {shares.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-amber-400/25">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-400/20 bg-amber-500/10 px-4 py-2.5">
            <span className="text-xs font-bold text-amber-100">
              متأخّرات مُحصَّلة من كشوفٍ سابقة ({shares.length})
            </span>
            <span className="text-[11px] text-amber-100/60">
              سدّدها الطالب بعد التخليص — ولا تُعدّل الورقة القديمة
            </span>
          </div>

          <ul className="divide-y divide-white/5">
            {shares.map((share) => {
              const on = pickedShares.has(share.id);
              const origin = share.originalSettlement;
              const student = share.debtCollection.invoice.studentEnrollment.student;

              return (
                <li key={share.id}>
                  <button
                    onClick={() => {
                      const next = new Set(pickedShares);
                      if (next.has(share.id)) next.delete(share.id);
                      else next.add(share.id);
                      setPickedShares(next);
                    }}
                    className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-white/[0.03]"
                  >
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-md border transition"
                      style={{
                        borderColor: on ? "#fcd34d" : "rgba(255,255,255,0.2)",
                        background: on ? "#fcd34d" : "transparent",
                      }}
                    >
                      {on && <CircleCheckBig className="h-3.5 w-3.5 text-[#241202]" />}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">
                        {student.lastName} {student.firstName}
                        {origin && (
                          <span className="text-white/50">
                            {" "}
                            — {origin.teachingAssignment.subject.name} ·{" "}
                            {origin.teachingAssignment.studyGroup.name}
                          </span>
                        )}
                      </span>

                      <span className="mt-0.5 block text-[11px] text-white/40">
                        {origin && (
                          <>
                            من{" "}
                            {origin.attendanceSheet.label?.trim() ||
                              `كشف الشهر رقم ${origin.attendanceSheet.number}`}
                            {" · رمز الورقة "}
                            <span className="font-mono" dir="ltr">
                              {origin.attendanceSheet.code}
                            </span>
                            {" · "}
                          </>
                        )}
                        حُصّل {money(share.collectedAmount, currency)}
                        {share.attendedUnits !== null && ` · حضر ${share.attendedUnits} حصة`}
                      </span>
                    </span>

                    <span className="shrink-0 text-sm font-black text-amber-200">
                      {money(share.shareAmount, currency)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* ============ تفاصيل الدفعة ============ */}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-white/45">طريقة الدفع</span>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value as TeacherPaymentMethod)}
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30"
          >
            {(Object.keys(TEACHER_PAYMENT_METHOD_LABEL) as TeacherPaymentMethod[]).map((key) => (
              <option key={key} value={key} className="bg-[#0a0f1a]">
                {TEACHER_PAYMENT_METHOD_LABEL[key]}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-white/45">تاريخ التسليم</span>
          <DateField value={date} onChange={setDate} tone={ACCENT} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-white/45">
            مرجع (شيك أو تحويل)
          </span>
          <input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="اختياري"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition placeholder:font-normal placeholder:text-white/25 focus:border-white/30"
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-white/45">ملاحظة</span>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="اختياري"
            className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition placeholder:font-normal placeholder:text-white/25 focus:border-white/30"
          />
        </label>
      </div>
    </div>
  );
}

// --------------------------------------------------
// الخطوة الثانية — الورقة الموقَّعة
// --------------------------------------------------

function StepScan({
  payment,
  currency,
  onFail,
}: {
  payment: TeacherPayment;
  currency: string;
  onFail: (message: string) => void;
}) {
  /* التخليصات المدفوعة — لكلٍّ منها ورقتُه الموقَّعة */
  const targets = payment.allocations
    .map((a) => a.settlement)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  /** ما أُلحق في هذه الجلسة — التخليص لم يُجلب كاملاً بعد */
  const [papers, setPapers] = useState<Record<string, SettlementDocument[]>>({});

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-x-8 gap-y-2 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        <CircleCheckBig className="h-5 w-5 shrink-0" />
        <span className="flex-1">
          دُفع <span className="font-black">{money(payment.amount, currency)}</span> للأستاذ{" "}
          <span className="font-black">
            {payment.teacher.lastName} {payment.teacher.firstName}
          </span>{" "}
          — رقم الدفعة <span className="font-mono" dir="ltr">{payment.paymentNumber}</span>
        </span>
      </div>

      <p className="text-xs leading-relaxed text-white/55">
        اطبع الكشف التقديري، وأمضِه مع الأستاذ، ثمّ امسحه هنا. والوجهُ الخلفي
        يُمسح إن طُبعت الورقة على وجهين — وإلّا تُرك فارغاً. ويمكن إلحاقُها
        لاحقاً من شاشة الأرشيف.
      </p>

      {targets.map((settlement) => (
        <div
          key={settlement.id}
          className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3"
        >
          <p className="mb-2.5 truncate text-xs font-bold text-white/75">
            {settlement.teachingAssignment.subject.name} ·{" "}
            {settlement.teachingAssignment.studyGroup.name} ·{" "}
            {settlement.attendanceSheet.label?.trim() ||
              `الشهر رقم ${settlement.attendanceSheet.number}`}
          </p>

          <PaperSlots
            settlementId={settlement.id}
            documents={papers[settlement.id] ?? []}
            canEdit
            accent={ACCENT}
            onChange={(next) => setPapers((prev) => ({ ...prev, [settlement.id]: next }))}
            onFail={onFail}
          />
        </div>
      ))}
    </div>
  );
}

/** يُلفّ بـ`AnimatePresence` ليعمل خروجُ النافذة */
export function SettlePayment({
  open,
  ...rest
}: { open: boolean } & Parameters<typeof SettlePaymentDialog>[0]) {
  return <AnimatePresence>{open && <SettlePaymentDialog {...rest} />}</AnimatePresence>;
}
