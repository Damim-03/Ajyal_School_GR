/**
 * أرشيف تخليص الأساتذة — ما دُفع، ولمن، وبأيّ ورقة.
 *
 * الكشف التقديري يُحسب ولا يُحفظ: يعرض مستحقَّ الأستاذ ليُقرأ قبل أن
 * يُلتزم به. وهذه الشاشة الطرفُ الآخر — ما التُزم به وسُلّم:
 *
 *   • **الدفعة**: رقمُها وتاريخُها ومبلغُها ومن سلّمها.
 *   • **التخليصات** التي غطّتها: مادةٌ وفوجٌ وكشفٌ لكلٍّ منها.
 *   • **اللقطة المجمَّدة**: كشف الحضور وكشف الحقوق كما كانا لحظة
 *     الدفع — لا كما صارا بعده.
 *   • **الورقة الموقَّعة** ممسوحةً: الإقرار الذي يُخرَج عند النزاع.
 *
 * والإلغاء لا يمحو: الدفعة تبقى بسببِ إلغائها، وتعود تخليصاتُها
 * «مؤكَّدة» تنتظر دفعاً جديداً، واللقطة تبقى — أثرُ ما وُقّع عليه لا
 * يُمحى بتراجعٍ بعده.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Archive,
  ArrowRight,
  BadgeCheck,
  CircleAlert,
  ClipboardCheck,
  Wallet,
  Loader2,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MotionDialog } from "../../motion/MotionDialog";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
  type FilterChip,
} from "../../components/shared/FilterPanel";
import { BarcodeScanner } from "../../components/shared/BarcodeScanner";
import { useScreenExit } from "../../lib/screen-transition";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useAcademicYears, fullName } from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchoolStore } from "../../core/stores/school.store";
import { formatMoney as money } from "../../core/utils/money";
import { listTeachers, type TeacherRow } from "../teachers/teachers.api";
import { PaperSlots, SnapshotDialog } from "./settlement-papers";
import {
  cancelTeacherPayment,
  getSettlement,
  listTeacherPayments,
  SETTLEMENT_STATUS_LABEL,
  SETTLEMENT_STATUS_TONE,
  TEACHER_PAYMENT_METHOD_LABEL,
  type SettlementDetail,
  type TeacherPayment,
} from "./teacher-payments.api";

const ACCENT = "#c4b5fd";

const dateOf = (iso: string) => new Date(iso).toLocaleDateString("fr-DZ");

/** «الإنجليزية · الفوج 1 · الشهر رقم 1» — عنوانُ الورقة في نافذة اللقطة */
const sheetTitleOf = (row: SettlementDetail) =>
  `${row.teachingAssignment.subject.name} · ${row.teachingAssignment.studyGroup.name} · ` +
  (row.attendanceSheet.label?.trim() || `الشهر رقم ${row.attendanceSheet.number}`);

export default function SettlementArchivePage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");

  const years = useAcademicYears().data ?? [];
  const [yearId, setYearId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [status, setStatus] = useState<"" | "ACTIVE" | "CANCELLED">("");

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [payments, setPayments] = useState<TeacherPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [open, setOpen] = useState<TeacherPayment | null>(null);

  /* السنة الجارية أوّلاً — الأرشيف يُفتح على أقرب ما يُسأل عنه */
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  /* قائمةُ الأساتذة للمرشِّح — النشطون وحدهم، فالأرشيف يُقرأ بأسمائهم */
  useEffect(() => {
    listTeachers({ limit: 100, isActive: true })
      .then(({ teachers: rows }) => setTeachers(rows))
      .catch(() => setTeachers([]));
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);

    listTeacherPayments({
      ...(yearId ? { academicYearId: yearId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(status ? { status } : {}),
    })
      .then(({ payments: rows }) => alive && setPayments(rows))
      .catch(
        (err) =>
          alive &&
          setError(
            (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
              "تعذّر جلب الدفعات",
          ),
      )
      .finally(() => alive && setLoading(false));

    return () => {
      alive = false;
    };
  }, [yearId, teacherId, status]);

  /**
   * ما يُبحث عنه بالمسح: **رقمُ الدفعة** أو **رمزُ ورقة الكشف** الموقَّعة.
   *
   * وكلاهما ثلاث عشرة خانة، فلا يُفرَّق بينهما بالشكل بل بالمطابقة:
   * يُجرَّب رقمُ الدفعة أوّلاً ثمّ رموزُ الكشوف المخلَّصة فيها.
   *
   * والبحث يتعدّى المعروض: الورقة التي عادت من الأستاذ قد تكون من سنةٍ
   * أخرى أو من أستاذٍ غير المختار في المرشِّح، ومن مسحها يريد فتحها لا
   * أن يُقال له «وسّع المرشِّحات». فإن لم تكن في القائمة الحاضرة
   * جُلبت دفعاتُ الأرشيف كلُّها مرّةً واحدة وبُحث فيها.
   */
  const resolvePayment = useCallback(
    async (text: string) => {
      const code = text.trim();

      const matches = (payment: TeacherPayment) =>
        payment.paymentNumber === code ||
        payment.allocations.some(
          (a) =>
            a.settlement?.attendanceSheet.code === code ||
            a.teacherDebtShare?.originalSettlement?.attendanceSheet.code === code,
        );

      const here = payments.find(matches);

      if (here) return here;

      const { payments: all } = await listTeacherPayments({ limit: 200 });

      return all.find(matches) ?? null;
    },
    [payments],
  );

  const chips = useMemo<FilterChip[]>(() => {
    const year = years.find((y) => y.id === yearId);
    const teacher = teachers.find((t) => t.id === teacherId);

    return [
      ...(year ? [{ label: "السنة", value: year.name }] : []),
      ...(teacher ? [{ label: "الأستاذ", value: fullName(teacher) }] : []),
      ...(status
        ? [{ label: "الحالة", value: status === "ACTIVE" ? "سارية" : "ملغاة" }]
        : []),
    ];
  }, [years, yearId, teachers, teacherId, status]);

  const total = useMemo(
    () =>
      payments
        .filter((p) => p.status === "ACTIVE")
        .reduce((sum, p) => sum + p.amount, 0),
    [payments],
  );

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="أرشيف تخليص الأساتذة" subtitle="ما دُفع · لمن · وبأيّ ورقة">
        <button
          onClick={() => exitTo(PATHS.attendance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1500px] p-6">
        <FilterPanel
          accent={ACCENT}
          storageKey="finance.archive"
          busy={loading}
          chips={chips}
          extra={
            <BarcodeScanner<TeacherPayment>
              accent={ACCENT}
              onFound={setOpen}
              copy={{
                button: "مسح الباركود",
                buttonTitle: "افتح دفعةً بمسح باركود ورقتها أو برقمها",
                title: "مسح رمز الورقة أو رقم الدفعة",
                subtitle: "الورقة الموقَّعة تفتح دفعتَها — بلا بحثٍ في القائمة",
                placeholder: "امسح الباركود، أو اكتب رقم الدفعة…",
                action: "افتح الدفعة",
                notFound:
                  "لا وجود لدفعةٍ بهذا الكود بار — الرجاء التحقّق منه.",
                hint: "الرقم مكتوبٌ تحت الباركود",
                steps: [
                  <>
                    وجّه القارئ إلى{" "}
                    <span className="font-bold text-white/85">باركود الكشف التقديري</span>{" "}
                    الموقَّع، أو اكتب رقم الدفعة كما في العمود الأوّل.
                  </>,
                  <>القارئ يكتب الرمز في الحقل أدناه من نفسه ثمّ يُرسله — لا تضغط شيئاً.</>,
                  <>
                    تُفتح الدفعة بكشوفها ولقطتِها وورقتها الممسوحة — ولو كانت خارج
                    المرشِّحات المعروضة.
                  </>,
                ],
              }}
              resolve={resolvePayment}
            />
          }
          onReset={() => {
            setTeacherId("");
            setStatus("");
          }}
        >
          <FilterField label="السنة الدراسية">
            <FilterSelect value={yearId} onChange={setYearId} items={years} accent={ACCENT} />
          </FilterField>

          <FilterField label="الأستاذ">
            <FilterSelect
              value={teacherId}
              onChange={setTeacherId}
              items={teachers.map((t) => ({ id: t.id, name: fullName(t) }))}
              placeholder="كل الأساتذة"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الحالة">
            <FilterSelect
              value={status}
              onChange={(v) => setStatus(v as "" | "ACTIVE" | "CANCELLED")}
              items={[
                { id: "ACTIVE", name: "سارية" },
                { id: "CANCELLED", name: "ملغاة" },
              ]}
              placeholder="الكل"
              accent={ACCENT}
            />
          </FilterField>
        </FilterPanel>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span>{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <span className="text-xs font-bold text-white/55">
              {payments.length} دفعة
            </span>
            <span className="text-xs text-white/50">
              مجموع السارية:{" "}
              <span className="font-black" style={{ color: ACCENT }}>
                {money(total, currency)}
              </span>
            </span>
          </div>

          {loading ? (
            <div className="grid place-items-center py-20">
              <Loader2 className="h-7 w-7 animate-spin text-white/25" />
            </div>
          ) : payments.length === 0 ? (
            <div className="grid place-items-center px-6 py-20 text-center">
              <Archive className="mb-3 h-11 w-11 text-white/15" />
              <p className="text-white/60">لا دفعةَ في هذا النطاق</p>
              <p className="mt-1.5 max-w-md text-xs text-white/35">
                الدفعُ يقع من «الكشف التقديري للحصص» — ومنه يدخل الأرشيف.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10 text-xs text-white/50">
                  <th className="px-4 py-3 text-start font-bold">رقم الدفعة</th>
                  <th className="px-4 py-3 text-start font-bold">الأستاذ</th>
                  <th className="w-28 px-3 py-3 text-center font-bold">التاريخ</th>
                  <th className="w-24 px-3 py-3 text-center font-bold">الكشوف</th>
                  <th className="w-32 px-3 py-3 text-center font-bold">المبلغ</th>
                  <th className="w-28 px-3 py-3 text-center font-bold">الطريقة</th>
                  <th className="w-28 px-3 py-3 text-center font-bold">الحالة</th>
                </tr>
              </thead>

              <tbody>
                {payments.map((payment) => (
                  <tr
                    key={payment.id}
                    onClick={() => setOpen(payment)}
                    className="cursor-pointer border-b border-white/5 transition last:border-0 hover:bg-white/[0.04]"
                  >
                    <td className="px-4 py-2.5 font-mono text-xs font-bold" dir="ltr">
                      {payment.paymentNumber}
                    </td>
                    <td className="px-4 py-2.5 font-bold">
                      {payment.teacher.lastName} {payment.teacher.firstName}
                    </td>
                    <td className="px-3 py-2.5 text-center text-white/60" dir="ltr">
                      {dateOf(payment.paymentDate)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-white/70">
                      {payment.allocations.length}
                    </td>
                    <td className="px-3 py-2.5 text-center font-black" style={{ color: ACCENT }}>
                      {money(payment.amount, currency)}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-white/60">
                      {TEACHER_PAYMENT_METHOD_LABEL[payment.paymentMethod]}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span
                        className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                        style={
                          payment.status === "ACTIVE"
                            ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
                            : { background: "rgba(253,164,175,0.12)", color: "#fda4af" }
                        }
                      >
                        {payment.status === "ACTIVE" ? "سارية" : "ملغاة"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </motion.div>
      </div>

      <AnimatePresence>
        {open && (
          <PaymentDetail
            payment={open}
            currency={currency}
            canDocument={can("settlement.document")}
            canCancel={can("teacher-payment.cancel")}
            onClose={() => setOpen(null)}
            onChanged={(next) => {
              setPayments((prev) => prev.map((p) => (p.id === next.id ? next : p)));
              setOpen(next);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// --------------------------------------------------
// تفصيل الدفعة — الكشوف وأوراقها
// --------------------------------------------------

function PaymentDetail({
  payment,
  currency,
  canDocument,
  canCancel,
  onClose,
  onChanged,
}: {
  payment: TeacherPayment;
  currency: string;
  canDocument: boolean;
  canCancel: boolean;
  onClose: () => void;
  onChanged: (next: TeacherPayment) => void;
}) {
  const [details, setDetails] = useState<Record<string, SettlementDetail>>({});
  const [busy, setBusy] = useState<string | null>(null);
  /** اللقطة المعروضة — الكشف اليومي أو كشف الحقوق لتخليصٍ بعينه */
  const [showing, setShowing] = useState<{
    kind: "daily" | "fees";
    settlementId: string;
  } | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const settlements = payment.allocations
    .map((a) => a.settlement)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  /** حصصُ الديون المحصَّلة التي حملتها هذه الدفعة */
  const arrears = payment.allocations
    .map((a) => a.teacherDebtShare)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  /* التفاصيل عند الفتح — الأوراق واللقطة لا تأتيان مع القائمة */
  useEffect(() => {
    let alive = true;

    Promise.all(settlements.map((s) => getSettlement(s.id)))
      .then((rows) => {
        if (!alive) return;
        setDetails(Object.fromEntries(rows.map((row) => [row.id, row])));
      })
      .catch(() => {});

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payment.id]);

  /** الأوراق تُدار في `PaperSlots` — وهذا يحفظ ما عادت به */
  const setPapers = (settlementId: string, documents: SettlementDetail["documents"]) =>
    setDetails((prev) => {
      const row = prev[settlementId];
      if (!row) return prev;
      return { ...prev, [settlementId]: { ...row, documents } };
    });

  const cancel = async () => {
    if (reason.trim().length < 3) return;

    setBusy("cancel");

    try {
      onChanged(await cancelTeacherPayment(payment.id, reason.trim()));
      setCancelling(false);
      setReason("");
    } catch (err) {
      setError(
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
          "تعذّر إلغاء الدفعة",
      );
    } finally {
      setBusy(null);
    }
  };

  return (
    /*
      على `MotionDialog` لا على موضعٍ مكتوب باليد.

      كانت اللوحة `fixed inset-4` ثمّ `inset-x-1/2` مع إزاحة — وهي حسبةٌ
      تنقلب في RTL: خرجت اللوحة إلى طرف الشاشة وضاق محتواها. والنافذة
      الموحَّدة تُوسّط بـflex، ومعها حبسُ التركيز وEscape والحجاب.
    */
    <MotionDialog
      onClose={onClose}
      className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header
        className="flex flex-wrap items-center gap-3 px-6 py-4"
        style={{ background: `linear-gradient(120deg, ${ACCENT}22, transparent)` }}
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
          style={{ background: `${ACCENT}1f`, color: ACCENT }}
        >
          <BadgeCheck className="h-5 w-5" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-black leading-tight">
            {payment.teacher.lastName} {payment.teacher.firstName}
          </h3>
          <p className="text-[11px] text-white/45">
            دفعة <span className="font-mono" dir="ltr">{payment.paymentNumber}</span> ·{" "}
            {dateOf(payment.paymentDate)} ·{" "}
            {TEACHER_PAYMENT_METHOD_LABEL[payment.paymentMethod]}
            {payment.paidBy && ` · سلّمها ${fullName(payment.paidBy)}`}
          </p>
        </div>

        <span className="text-lg font-black" style={{ color: ACCENT }}>
          {money(payment.amount, currency)}
        </span>

        <button
          onClick={onClose}
          aria-label="إغلاق"
          className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {payment.status === "CANCELLED" && (
          <div className="flex items-start gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-100">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              دفعةٌ ملغاة{payment.cancelReason && ` — ${payment.cancelReason}`}. وتخليصاتُها
              عادت «مؤكَّدة» تنتظر دفعاً جديداً، واللقطة باقية.
            </span>
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-100">
            <CircleAlert className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

          {/*
            متأخّراتٌ دُفعت مع هذا الراتب.

            دَينٌ سُدِّد بعد تخليص كشفه، فحصةُ الأستاذ منه لا تُعاد إلى
            الورقة القديمة — تُدفع هنا ويُقيَّد أصلُها: أيُّ كشفٍ وأيُّ
            طالبٍ وبأيّ رمزِ ورقة.
          */}
          {arrears.length > 0 && (
            <div className="overflow-hidden rounded-xl border border-amber-400/25">
              <div className="border-b border-amber-400/20 bg-amber-500/10 px-4 py-2.5 text-xs font-bold text-amber-100">
                متأخّرات من كشوفٍ سابقة ({arrears.length})
              </div>

              <ul className="divide-y divide-white/5">
                {arrears.map((share) => {
                  const origin = share.originalSettlement;
                  const student = share.debtCollection.invoice.studentEnrollment.student;

                  return (
                    <li key={share.id} className="flex items-center gap-3 px-4 py-2.5">
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
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

        {settlements.map((settlement) => {
          const detail = details[settlement.id];

          return (
            <div
              key={settlement.id}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.02]"
            >
              <div className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">
                    {settlement.teachingAssignment.subject.name} ·{" "}
                    {settlement.teachingAssignment.studyGroup.name} ·{" "}
                    {settlement.attendanceSheet.label?.trim() ||
                      `الشهر رقم ${settlement.attendanceSheet.number}`}
                  </p>
                  <p className="mt-0.5 text-[11px] text-white/40">
                    {settlement.settlementNumber}
                    {settlement.attendanceSheet.code && (
                      <>
                        {" · رمز الورقة "}
                        <span className="font-mono" dir="ltr">
                          {settlement.attendanceSheet.code}
                        </span>
                      </>
                    )}
                    {detail?.snapshot && " · لقطةٌ محفوظة"}
                  </p>
                </div>

                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background: SETTLEMENT_STATUS_TONE[settlement.status].bg,
                    color: SETTLEMENT_STATUS_TONE[settlement.status].fg,
                  }}
                >
                  {SETTLEMENT_STATUS_LABEL[settlement.status]}
                </span>

                <span className="text-sm font-black" style={{ color: ACCENT }}>
                  {money(settlement.teacherAmount, currency)}
                </span>
              </div>

              <div className="space-y-3 px-4 py-3">
                {!detail ? (
                  <div className="grid place-items-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-white/25" />
                  </div>
                ) : (
                  <>
                    {/*
                      الكشفان من اللقطة لا من القاعدة: الحضورُ يُصحَّح
                      والدَّينُ يُسدَّد بعد الدفع، والورقة الموقَّعة لا تتبع
                      ذلك. فما يُفتح هنا هو ما رآه الأستاذ حين أمضى.
                    */}
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => setShowing({ kind: "daily", settlementId: settlement.id })}
                        disabled={!detail.snapshot}
                        title={detail.snapshot ? undefined : "لا لقطة لهذا التخليص"}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-35"
                      >
                        <ClipboardCheck className="h-3.5 w-3.5" />
                        كشف الحضور اليومي
                      </button>

                      <button
                        onClick={() => setShowing({ kind: "fees", settlementId: settlement.id })}
                        disabled={!detail.snapshot}
                        title={detail.snapshot ? undefined : "لا لقطة لهذا التخليص"}
                        className="flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-[11px] font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-35"
                      >
                        <Wallet className="h-3.5 w-3.5" />
                        كشف دفع الحقوق
                      </button>
                    </div>

                    <PaperSlots
                      settlementId={settlement.id}
                      documents={detail.documents}
                      canEdit={canDocument}
                      accent={ACCENT}
                      onChange={(next) => setPapers(settlement.id, next)}
                      onFail={setError}
                    />
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <footer className="flex flex-wrap items-center gap-3 border-t border-white/10 px-6 py-4">
        {payment.status === "ACTIVE" && canCancel && !cancelling && (
          <button
            onClick={() => setCancelling(true)}
            className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/60 transition hover:bg-rose-500/15 hover:text-rose-300"
          >
            <X className="h-4 w-4" />
            إلغاء الدفعة
          </button>
        )}

        {cancelling && (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="سبب الإلغاء — يبقى في السجلّ"
              className="min-w-0 flex-1 rounded-xl border border-rose-400/30 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition placeholder:font-normal placeholder:text-white/25 focus:border-rose-400/60"
            />
            <button
              onClick={cancel}
              disabled={reason.trim().length < 3 || busy === "cancel"}
              className="flex items-center gap-2 rounded-xl bg-rose-500/20 px-4 py-2.5 text-sm font-black text-rose-100 transition hover:bg-rose-500/30 disabled:opacity-40"
            >
              {busy === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الإلغاء
            </button>
            <button
              onClick={() => setCancelling(false)}
              className="rounded-xl bg-white/10 px-3 py-2.5 text-xs font-bold transition hover:bg-white/20"
            >
              تراجع
            </button>
          </div>
        )}

        <button
          onClick={onClose}
          className="ms-auto rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20"
        >
          إغلاق
        </button>
      </footer>

      <AnimatePresence>
        {showing && details[showing.settlementId]?.snapshot && (
          <SnapshotDialog
            kind={showing.kind}
            snapshot={details[showing.settlementId]!.snapshot!}
            title={sheetTitleOf(details[showing.settlementId]!)}
            currency={currency}
            accent={ACCENT}
            onClose={() => setShowing(null)}
          />
        )}
      </AnimatePresence>
    </MotionDialog>
  );
}
