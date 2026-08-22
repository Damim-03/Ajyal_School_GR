import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Archive,
  CircleCheckBig,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  TriangleAlert,
  Wallet,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
} from "../../components/shared/FilterPanel";
import { SheetPreview } from "../../components/print/SheetPreview";
import { PrintSignature } from "../../components/print/PrintSignature";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { printedStamp } from "../../components/print/printed-at";
import { usePagedFlow, type PrintBlock } from "../../components/print/paged-flow";
import { useScreenExit } from "../../lib/screen-transition";
import { PATHS } from "../../routes/paths";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { formatMoney, DEFAULT_CURRENCY } from "../../core/utils/money";
import { useAcademicYears } from "../../core/api/reference.api";
import { MONTHS } from "../finance/finance.api";
import {
  getTeacherStatement,
  listAllTeachers,
  type TeacherRow,
  type TeacherStatement,
  type TeacherStatementRow,
  type TeacherStatementShare,
} from "../teachers/teachers.api";

const ACCENT = "#c4b5fd";

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.lastName} ${p.firstName}`.trim();

/** «19/08/2026» — تاريخٌ قصير بأرقامٍ لاتينية */
const dateOf = (value: string) =>
  new Date(value).toLocaleDateString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** «أكتوبر 2026» — الشهر الذي فُتح فيه الكشف */
const periodOf = (row: TeacherStatementRow) =>
  row.month && row.year ? `${MONTHS[row.month - 1]} ${row.year}` : "—";

const STATUS: Record<string, { label: string; tone: string }> = {
  PAID: { label: "مدفوع", tone: "#86efac" },
  CONFIRMED: { label: "مؤكَّد — لم يُدفع", tone: "#fcd34d" },
  DRAFT: { label: "مسوّدة", tone: "#93c5fd" },
};

/** الصفةُ في الورقة — قصيرةٌ لأنّ عمودها ضيّق */
const SHORT: Record<string, string> = {
  PAID: "مدفوع",
  CONFIRMED: "مؤكَّد",
  DRAFT: "مسوّدة",
};

const shortStatusOf = (row: TeacherStatementRow) =>
  row.settlement ? (SHORT[row.settlement.status] ?? row.settlement.status) : "لم يُخلَّص";

const statusOf = (row: TeacherStatementRow) =>
  row.settlement
    ? (STATUS[row.settlement.status] ?? { label: row.settlement.status, tone: "#cbd5e1" })
    : { label: "لم يُخلَّص", tone: "rgba(255,255,255,0.35)" };

/**
 * كشفُ حساب الأستاذ.
 *
 * سؤالاه: «كم استحققتُ هذه السنة؟» و«ماذا قبضتُ منه؟». وكان جوابُهما
 * يُجمع من ثلاث شاشات — الكشف التقديري لكلّ شهر، والأرشيف لكلّ دفعة،
 * وقائمةُ المتأخّرات — فيُقرأ عشرَ مرّاتٍ لأستاذٍ له فوجان.
 *
 * فهذه ورقةٌ واحدة: كشوفُه شهراً شهراً بمستحقّها ورقمِ الدفعة التي
 * حملته، ومتأخّراتُه منسوبةً إلى أصلها، ومجموعٌ يقول ما بقي له.
 */
export default function TeacherAccountPage() {
  const navigate = useNavigate();
  const exitTo = useScreenExit();
  const settings = useSchoolStore((s) => s.settings);

  const schoolName = useSchool("school.name_ar");
  const currency = settings["school.currency"] || DEFAULT_CURRENCY;
  const logo = useMemo<LogoSpec>(() => logoSpec(settings), [settings]);
  const money = useCallback(
    (value: number) => formatMoney(value, currency),
    [currency],
  );

  const yearsQuery = useAcademicYears();
  const years = useMemo(() => yearsQuery.data ?? [], [yearsQuery.data]);

  const [yearId, setYearId] = useState("");
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [teacherId, setTeacherId] = useState("");

  const [statement, setStatement] = useState<TeacherStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]!).id);
  }, [years, yearId]);

  useEffect(() => {
    listAllTeachers({ isActive: true })
      .then(setTeachers)
      .catch(() => setTeachers([]));
  }, []);

  /* القدوم برابطٍ يحمل الأستاذ — `?y=سنة&t=أستاذ` */
  const [params, setParams] = useSearchParams();
  const linkYear = params.get("y");
  const linkTeacher = params.get("t");

  useEffect(() => {
    if (linkYear) setYearId(linkYear);
  }, [linkYear]);

  useEffect(() => {
    if (!linkTeacher) return;

    setTeacherId(linkTeacher);
    setParams({}, { replace: true });
  }, [linkTeacher, setParams]);

  const load = useCallback(async () => {
    if (!yearId || !teacherId) {
      setStatement(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setStatement(await getTeacherStatement(teacherId, yearId));
    } catch (err: any) {
      setStatement(null);
      setError(err?.response?.data?.message ?? "تعذّر جلب كشف الحساب");
    } finally {
      setLoading(false);
    }
  }, [yearId, teacherId]);

  useEffect(() => {
    load();
  }, [load]);

  const chips = useMemo(
    () =>
      statement
        ? [
            { label: "الأستاذ", value: fullName(statement.teacher) },
            { label: "السنة", value: statement.academicYear.name },
          ]
        : [],
    [statement],
  );

  const t = statement?.totals;
  const pending = useMemo(
    () => statement?.arrears.filter((a) => a.status !== "PAID") ?? [],
    [statement],
  );

  /**
   * متأخّراتُ كلِّ كشفٍ منسوبةً إليه.
   *
   * وهي التي تُجيب السؤال الذي يقع كلَّ مرّة: «الكشف يقول دُفع، فما
   * هذا الباقي؟». الجواب أنّ التخليص حسب مَن سدَّد **يومئذ** وحدهم،
   * ومن سدَّد بعده مالٌ جديد لم يكن موجوداً حين وُقّع. فيُكتب الرقمان
   * في السطر الواحد: ما قُبض وقتها، وما نشأ بعده.
   */
  const laterBySettlement = useMemo(() => {
    const map = new Map<string, { count: number; paid: number; pending: number }>();

    for (const share of statement?.arrears ?? []) {
      const id = share.originalSettlement?.id;

      if (!id) continue;

      const at = map.get(id) ?? { count: 0, paid: 0, pending: 0 };

      at.count += 1;
      if (share.status === "PAID") at.paid += share.shareAmount;
      else at.pending += share.shareAmount;

      map.set(id, at);
    }

    return map;
  }, [statement]);

  /** عددُ الدفعات التي حملت متأخّراته — لا عددُ الحصص */
  const payments = useMemo(
    () =>
      new Set(
        (statement?.arrears ?? [])
          .map((a) => a.teacherPayment?.id)
          .filter(Boolean) as string[],
      ).size,
    [statement],
  );

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="كشف حساب الأستاذ" subtitle="كشوفُه ومستحقُّه وما قُبض — سنةً كاملة">
        <button
          onClick={() => exitTo(PATHS.attendance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-320 space-y-4 p-6">
        <FilterPanel
          accent={ACCENT}
          storageKey="attendance.teacher-account"
          collapseKey={teacherId}
          busy={loading}
          chips={chips}
          onReset={() => setTeacherId("")}
        >
          <FilterField label="السنة الدراسية">
            <FilterSelect
              value={yearId}
              onChange={setYearId}
              items={years.map((y) => ({ id: y.id, name: y.name }))}
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الأستاذ" span>
            <FilterSelect
              value={teacherId}
              onChange={setTeacherId}
              items={teachers.map((teacher) => ({
                id: teacher.id,
                name: fullName(teacher),
              }))}
              placeholder="اختر أستاذاً"
              accent={ACCENT}
            />
          </FilterField>
        </FilterPanel>

        {error && (
          <p className="flex items-start gap-2 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </p>
        )}

        {!teacherId && !loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/45">
              اختر أستاذاً لتُعرض سنتُه كاملةً — كشفاً كشفاً بمستحقّه ودفعته.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            يُجمع كشف الحساب...
          </div>
        )}

        {statement && t && !loading && (
          <>
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="text-base font-black" style={{ color: ACCENT }}>
                  {fullName(statement.teacher)}
                </span>

                {statement.teacher.specialization && (
                  <Meta label="التخصّص" value={statement.teacher.specialization} />
                )}
                {statement.teacher.phone && (
                  <Meta label="الهاتف" value={statement.teacher.phone} mono />
                )}
                <Meta label="السنة" value={statement.academicYear.name} />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="الكشوف"
                  value={`${t.settled} / ${t.sheets}`}
                  hint="المخلَّصة من المجموع"
                  tone="#cbd5e1"
                />
                <Stat label="مستحقّ الكشوف" value={money(t.due)} tone="#cbd5e1" />
                <Stat
                  label="المتأخّرات"
                  value={money(t.arrearsPaid + t.arrearsPending)}
                  hint={
                    t.arrearsPending > 0
                      ? `منها ${money(t.arrearsPending)} لم تُقبض بعد`
                      : "كلُّها قُبضت"
                  }
                  tone="#fcd34d"
                />
                <Stat
                  label="ما بقي له"
                  value={money(t.grandUnpaid)}
                  tone={t.grandUnpaid > 0 ? "#fda4af" : "#86efac"}
                  strong
                />
              </div>

              <p className="mt-3 text-[11px] leading-relaxed text-white/35">
                المبالغ مجمَّدةٌ كما أُقرّت يوم التخليص — لا تُعاد حسابُها اليوم.
                وما سدَّده المخلَّفون بعدها يظهر في «المتأخّرات» لا بتعديل ما وُقّع.
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-2.5">
                <button
                  onClick={load}
                  disabled={loading}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  تحديث
                </button>

                <button
                  onClick={() => setPreviewing(true)}
                  disabled={statement.rows.length === 0}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-white/10 disabled:opacity-35"
                >
                  <Printer className="h-4 w-4" />
                  معاينة وطباعة
                </button>

                <button
                  onClick={() => navigate(PATHS.settlementArchive)}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-violet-500/15 hover:text-violet-200"
                >
                  <Archive className="h-4 w-4" />
                  أرشيف دفعاته
                </button>
              </div>
            </section>

            {/* ============ الكشوف ============ */}
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
                <h2 className="text-sm font-black">الكشوف — مستحقٌّ ودفعة</h2>
                <span className="text-[11px] text-white/40">
                  سطرٌ لكلّ فوجٍ في كلّ شهر — لا سطرٌ للشهر كلِّه
                </span>
              </header>

              {/*
                القاعدةُ تُكتب مرّةً هنا بدل أن تُستنتج في كلّ سطر.
              */}
              <p className="border-b border-white/10 px-5 py-2.5 text-[11px] leading-relaxed text-white/40">
                المبلغ محسوبٌ على الطلبة الذين <span className="font-bold text-white/70">سدَّدوا
                يوم التخليص</span> وحدهم — لا على المسجَّلين كلِّهم. فمن سدَّد بعده يُنشئ
                للأستاذ نصيباً جديداً يظهر في «المتأخّرات» أدناه، ولا يُعدَّل به
                مبلغٌ وُقّع عليه.
              </p>

              {statement.rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-white/40">
                  لا كشوفَ لهذا الأستاذ في هذه السنة.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-225 text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/45">
                        <th className="px-4 py-3 text-start font-bold">الشهر</th>
                        <th className="w-20 px-2 py-3 text-center font-bold">الكشف</th>
                        <th className="px-4 py-3 text-start font-bold">المادة والفوج</th>
                        <th className="w-20 px-2 py-3 text-center font-bold">الحصص</th>
                        <th className="w-28 px-2 py-3 text-center font-bold">
                          المحتسبون
                          <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                            سدَّدوا عند التخليص
                          </span>
                        </th>
                        <th className="w-32 px-2 py-3 text-center font-bold">
                          المستحقّ عند التخليص
                          <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                            مجمَّدٌ كما وُقّع
                          </span>
                        </th>
                        <th className="w-32 px-2 py-3 text-center font-bold">
                          نشأ بعده
                          <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                            سدَّده مخلَّفوه لاحقاً
                          </span>
                        </th>
                        <th className="w-32 px-2 py-3 text-center font-bold">
                          مجموع الكشف
                        </th>
                        <th className="w-28 px-2 py-3 text-center font-bold">الحالة</th>
                        <th className="px-4 py-3 text-start font-bold">الدفعة</th>
                      </tr>
                    </thead>

                    <tbody>
                      {statement.rows.map((row) => {
                        const status = statusOf(row);
                        const later = row.settlement
                          ? laterBySettlement.get(row.settlement.id)
                          : undefined;

                        return (
                          <tr
                            key={`${row.sheetId}-${row.studyGroup.id}`}
                            className="border-b border-white/5 last:border-0"
                          >
                            <td className="px-4 py-3 font-bold">{periodOf(row)}</td>

                            <td className="px-2 py-3 text-center text-white/70">
                              {row.sheetNumber}
                            </td>

                            <td className="px-4 py-3">
                              <span className="block font-bold">{row.subject.name}</span>
                              <span className="mt-0.5 block text-[11px] text-white/40">
                                {row.studyGroup.name}
                              </span>
                            </td>

                            <td className="px-2 py-3 text-center text-white/70">
                              {row.completedSessions}
                            </td>

                            <td className="px-2 py-3 text-center text-white/70">
                              {row.settlement
                                ? `${row.settlement.paidStudents} / ${row.settlement.students}`
                                : "—"}
                            </td>

                            {/*
                              ثلاثةُ أعمدةٍ لا عمودٌ واحد بحاشية.
                              كانا مجموعين في خانةٍ واحدة فيُقرأ الرقمُ
                              الأوّل على أنّه الكلّ، ويُظنّ ما تحته زيادةً
                              عليه أو تكراراً له. والفصلُ يُنهي الجدل:
                              هذا ما وُقّع عليه، وهذا ما نشأ بعده،
                              وهذا مجموعُهما — وكلٌّ في خانته.
                            */}
                            <td className="px-2 py-3 text-center font-black">
                              {row.settlement ? money(row.settlement.teacherAmount) : "—"}
                            </td>

                            <td className="px-2 py-3 text-center">
                              {later ? (
                                <span className="flex flex-col gap-0.5">
                                  <span className="font-black text-amber-200">
                                    {money(later.paid + later.pending)}
                                  </span>
                                  <span className="text-[10px] leading-tight text-white/40">
                                    {later.pending > 0 && later.paid > 0
                                      ? `قُبض ${money(later.paid)} · بقي ${money(later.pending)}`
                                      : later.pending > 0
                                        ? "لم يُقبض بعد"
                                        : "قُبض كلُّه"}
                                  </span>
                                </span>
                              ) : (
                                <span className="text-white/25">—</span>
                              )}
                            </td>

                            <td className="px-2 py-3 text-center font-black text-sky-200">
                              {row.settlement
                                ? money(
                                    row.settlement.teacherAmount +
                                      (later ? later.paid + later.pending : 0),
                                  )
                                : "—"}
                            </td>

                            <td className="px-2 py-3 text-center">
                              <span
                                className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                                style={{ background: `${status.tone}1f`, color: status.tone }}
                              >
                                {status.label}
                              </span>
                            </td>

                            <td className="px-4 py-3">
                              {row.payment ? (
                                <span
                                  className="block font-mono text-[11px] text-white/60"
                                  dir="ltr"
                                >
                                  {row.payment.paymentNumber}
                                </span>
                              ) : (
                                <span className="text-white/25">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>

                    <tfoot>
                      <tr className="border-t border-white/15 bg-white/[0.03] text-sm font-black">
                        <td className="px-4 py-3" colSpan={5}>
                          المجموع — {t.sheets} كشفاً ({t.completedSessions} حصة)
                        </td>
                        <td className="px-2 py-3 text-center">{money(t.due)}</td>
                        <td className="px-2 py-3 text-center text-amber-200">
                          {money(t.arrearsPaid + t.arrearsPending)}
                        </td>
                        <td className="px-2 py-3 text-center text-sky-200">
                          {money(t.grandDue)}
                        </td>
                        <td colSpan={2} />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>

            {/*
              ============ خلاصة الحساب ============

              معادلةٌ مكتوبةٌ لا مستنتَجة. كلُّ سطرٍ منها يُقابل عموداً في
              الجدول أعلاه أو الجدول أسفله، فمن شكّ في رقمٍ تتبّعه إلى
              مصدره — ولا يبقى في الورقة موضعٌ للجدل.
            */}
            <section className="overflow-hidden rounded-2xl border border-sky-400/25 bg-sky-500/[0.04]">
              <header className="border-b border-sky-400/20 px-5 py-3.5">
                <h2 className="text-sm font-black text-sky-100">
                  خلاصة الحساب — من أين جاء كلُّ رقم
                </h2>
              </header>

              <dl className="divide-y divide-white/5">
                <Line
                  label="مستحقُّ الكشوف عند تخليصها"
                  hint="مجموع عمود «المستحقّ عند التخليص» أعلاه"
                  value={money(t.due)}
                />
                <Line
                  label="+ ما نشأ بعدها من متأخّرات"
                  hint="مجموع عمود «نشأ بعده» — وهو جدول المتأخّرات أدناه"
                  value={money(t.arrearsPaid + t.arrearsPending)}
                  tone="#fcd34d"
                />
                <Line
                  label="= الإجمالي المستحقّ في السنة"
                  value={money(t.grandDue)}
                  tone="#7dd3fc"
                  strong
                />
                <Line
                  label="− المقبوض فعلاً"
                  hint={`${money(t.paid)} من الكشوف + ${money(t.arrearsPaid)} من المتأخّرات`}
                  value={money(t.grandPaid)}
                  tone="#86efac"
                />
                <Line
                  label="= الباقي له"
                  hint={
                    t.grandUnpaid > 0
                      ? "يُدفع في دفعته القادمة مع كشفٍ جديد"
                      : "لا شيءَ في ذمّة المؤسسة"
                  }
                  value={money(t.grandUnpaid)}
                  tone={t.grandUnpaid > 0 ? "#fda4af" : "#86efac"}
                  strong
                />
              </dl>
            </section>

            {/* ============ المتأخّرات ============ */}
            {statement.arrears.length > 0 && (
              <section className="overflow-hidden rounded-2xl border border-amber-400/25 bg-amber-500/[0.04]">
                <header className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-400/20 px-5 py-3.5">
                  <span className="flex items-center gap-2 text-sm font-black text-amber-100">
                    <Wallet className="h-4 w-4" />
                    متأخّرات — سدَّدها الطلبة، وتُدفع للأستاذ في دفعته القادمة
                  </span>

                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                    <span className="font-bold text-emerald-300">
                      قُبض {money(t.arrearsPaid)}
                      {payments > 0 && ` في ${payments} ${payments === 1 ? "دفعة" : "دفعات"}`}
                    </span>

                    {pending.length > 0 && (
                      <span className="font-bold text-amber-300">
                        وبقي {money(t.arrearsPending)} في {pending.length} متأخّرة
                      </span>
                    )}
                  </span>
                </header>

                {/*
                  الالتباسُ الذي وقع فعلاً: «بانتظار الدفع» تُقرأ كأنّ
                  الطالبَ لم يدفع — وهو قد دفع، والمنتظِرُ نصيبُ الأستاذ.
                */}
                <p className="border-b border-amber-400/10 px-5 py-2 text-[11px] leading-relaxed text-amber-100/50">
                  كلُّ سطرٍ هنا سدَّده طالبٌ فعلاً بدفعةٍ مسجَّلة — والمعلَّق هو
                  نصيبُ الأستاذ منه، لم يُقبض بعدُ لأنّ الدفعة نشأت بعد آخر
                  تخليصٍ له.
                </p>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-200 text-sm">
                    <thead>
                      <tr className="border-b border-amber-400/15 text-xs text-amber-100/50">
                        <th className="px-4 py-2.5 text-start font-bold">الطالب</th>
                        <th className="px-4 py-2.5 text-start font-bold">من كشف</th>
                        <th className="w-24 px-3 py-2.5 text-center font-bold">حضر</th>
                        <th className="w-32 px-3 py-2.5 text-center font-bold">المحصَّل</th>
                        <th className="w-32 px-3 py-2.5 text-center font-bold">نصيبه</th>
                        <th className="w-44 px-3 py-2.5 text-start font-bold">
                          قُبضت بدفعة
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {statement.arrears.map((share) => (
                        <ArrearsRow key={share.id} share={share} money={money} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>

      {previewing && statement && (
        <SheetPreview
          title="كشف حساب الأستاذ"
          subtitle={`${fullName(statement.teacher)} — ${statement.academicYear.name}`}
          onRefresh={load}
          onClose={() => setPreviewing(false)}
        >
          <StatementPrint
            schoolName={schoolName}
            statement={statement}
            currency={currency}
            logo={logo}
          />
        </SheetPreview>
      )}
    </div>
  );
}

// --------------------------------------------------
// عناصر صغيرة
// --------------------------------------------------

function ArrearsRow({
  share,
  money,
}: {
  share: TeacherStatementShare;
  money: (value: number) => string;
}) {
  const student = share.debtCollection.invoice.studentEnrollment.student;
  const origin = share.originalSettlement;

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="px-4 py-2.5 font-bold">{fullName(student)}</td>

      <td className="px-4 py-2.5 text-white/70">
        {origin ? (
          <>
            <span className="block text-xs font-bold">
              {origin.teachingAssignment.subject.name} ·{" "}
              {origin.teachingAssignment.studyGroup.name} ·{" "}
              {origin.attendanceSheet.label?.trim() ||
                `الشهر رقم ${origin.attendanceSheet.number}`}
            </span>
            <span className="mt-0.5 block text-[11px] text-white/35">
              رمز الورقة{" "}
              <span className="font-mono" dir="ltr">
                {origin.attendanceSheet.code}
              </span>
              {" · سُدّد بدفعة "}
              <span className="font-mono" dir="ltr">
                {share.debtCollection.payment.paymentNumber}
              </span>
            </span>
          </>
        ) : (
          "—"
        )}
      </td>

      <td className="px-3 py-2.5 text-center text-white/70">
        {share.attendedUnits ?? "—"}
      </td>

      <td className="px-3 py-2.5 text-center text-white/70">
        {money(share.collectedAmount)}
      </td>

      <td className="px-3 py-2.5 text-center font-black text-amber-200">
        {money(share.shareAmount)}
      </td>

      {/*
        السندُ لا الصفة: «قُبضت» وحدها دعوى، ورقمُ الدفعة وتاريخُها
        يُثبتانها — ومن سأل «متى قبضتُ نصيبَ هذا المخلَّف؟» وجد جوابه
        في السطر نفسه.
      */}
      <td className="px-3 py-2.5">
        {share.teacherPayment ? (
          <span className="flex flex-col gap-0.5">
            <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-300">
              <CircleCheckBig className="h-3 w-3" />
              قُبضت
            </span>
            <span className="font-mono text-[11px] text-white/60" dir="ltr">
              {share.teacherPayment.paymentNumber}
            </span>
            <span className="text-[10px] text-white/30">
              {dateOf(share.teacherPayment.paymentDate)}
            </span>
          </span>
        ) : (
          <span className="text-[11px] font-bold text-amber-300">
            لم تُدفع للأستاذ بعد
          </span>
        )}
      </td>
    </tr>
  );
}

/** سطرٌ في خلاصة الحساب — عنوانٌ وشرحٌ ومبلغ */
function Line({
  label,
  hint,
  value,
  tone = "#cbd5e1",
  strong = false,
}: {
  label: string;
  hint?: string;
  value: string;
  tone?: string;
  strong?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-5 py-3">
      <span>
        <span className={`block ${strong ? "font-black" : "font-bold"} text-sm`}>
          {label}
        </span>
        {hint && <span className="mt-0.5 block text-[11px] text-white/35">{hint}</span>}
      </span>

      <span
        className={`${strong ? "text-xl" : "text-base"} font-black`}
        style={{ color: tone }}
      >
        {value}
      </span>
    </div>
  );
}

function Meta({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-white/35">{label}:</span>
      <span
        className={`font-bold text-white/85 ${mono ? "font-mono text-xs" : ""}`}
        dir={mono ? "ltr" : undefined}
      >
        {value}
      </span>
    </span>
  );
}

function Stat({
  label,
  value,
  hint,
  tone,
  strong = false,
}: {
  label: string;
  value: string;
  hint?: string;
  tone: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] px-4 py-3">
      <span className="block text-[11px] text-white/40">{label}</span>
      <span
        className={`mt-1 block ${strong ? "text-xl" : "text-lg"} font-black`}
        style={{ color: tone }}
      >
        {value}
      </span>
      {hint && <span className="mt-0.5 block text-[10px] text-white/30">{hint}</span>}
    </div>
  );
}

// --------------------------------------------------
// الورقة المطبوعة
// --------------------------------------------------

/*
 * نسبُ الأعمدة — مجموعها مئةٌ بالضبط.
 *
 * وهي أوسعُ من نسب كشف حساب الطالب لأنّ أعمدتها ثمانيةٌ لا عشرة،
 * والورقة أفقيّةٌ عرضُها 285مم بعد الحشوة.
 */
/*
 * عشرةُ أعمدةٍ لا ثمانية — والزيادةُ مقصودة.
 *
 * كان المستحقُّ ومَا نشأ بعده في خانةٍ واحدة، فيُقرأ الأوّل على أنّه
 * الكلّ ويُظنّ الثاني زيادةً عليه أو تكراراً له. فصار لكلٍّ عمودُه
 * ومجموعُه في الذيل، ومعهما عمودُ المجموع — فيُجمع أمام القارئ ولا
 * يُطالَب بأن يجمعه في رأسه.
 */
const COLUMN = {
  period: 11,
  sheet: 6,
  subject: 15,
  sessions: 6,
  counted: 8,
  frozen: 12,
  later: 12,
  total: 12,
  status: 9,
  payment: 9,
} as const;

/**
 * ورقةُ كشف الحساب — تُسلَّم للأستاذ أو تُحفظ في ملفّه.
 *
 * الترويسة تتكرّر على كلّ ورقة، والمجاميع والإمضاء على الأخيرة وحدها.
 * وخانتا إمضاءٍ لا واحدة: الأستاذ يُقرّ بما قبض والإدارة بما دفعت.
 */
function StatementPrint({
  schoolName,
  statement,
  currency,
  logo,
}: {
  schoolName: string;
  statement: TeacherStatement;
  currency: string;
  logo: LogoSpec;
}) {
  const money = (value: number) => formatMoney(value, currency);
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));
  const printedOn = printedStamp();

  const { teacher, academicYear, rows, arrears, totals } = statement;

  /* متأخّراتُ كلِّ كشفٍ منسوبةً إليه — تُكتب تحت مبلغه في سطره */
  const laterOf = (settlementId: string) => {
    const mine = arrears.filter((a) => a.originalSettlement?.id === settlementId);

    return {
      count: mine.length,
      total: mine.reduce((sum, a) => sum + a.shareAmount, 0),
    };
  };

  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        <span>الأستاذ : {fullName(teacher)}</span>
        {teacher.specialization && <span>التخصّص : {teacher.specialization}</span>}
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
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
        <h2>كشف حساب الأستاذ</h2>
      </div>

      <div className="sheet-print-side sheet-print-side-end">
        <span>السنة الدراسية : {academicYear.name}</span>
        <span>الكشوف : {totals.settled} من {totals.sheets}</span>
        {teacher.phone && <span>الهاتف : {teacher.phone}</span>}
      </div>
    </header>
  );

  const blocks: PrintBlock[] = [
    {
      kind: "table",
      key: "sheets",
      head: (
        <thead data-flow-head="">
          <tr>
            <th style={{ width: `${COLUMN.period}%` }}>الشهر</th>
            <th style={{ width: `${COLUMN.sheet}%` }}>الكشف</th>
            <th style={{ width: `${COLUMN.subject}%` }}>المادة والفوج</th>
            <th style={{ width: `${COLUMN.sessions}%` }}>الحصص</th>
            <th style={{ width: `${COLUMN.counted}%` }}>المحتسبون</th>
            <th style={{ width: `${COLUMN.frozen}%` }}>المستحقّ</th>
            <th style={{ width: `${COLUMN.later}%` }}>نشأ بعده</th>
            <th style={{ width: `${COLUMN.total}%` }}>المجموع</th>
            <th style={{ width: `${COLUMN.status}%` }}>الحالة</th>
            <th style={{ width: `${COLUMN.payment}%` }}>الدفعة</th>
          </tr>
        </thead>
      ),
      rows: rows.map((row) => {
        const later = row.settlement ? laterOf(row.settlement.id) : null;

        return (
        <tr key={`${row.sheetId}-${row.studyGroup.id}`} data-flow-row="">
          <td className="c">{periodOf(row)}</td>
          <td className="c">{row.sheetNumber}</td>
          <td>
            <span style={{ fontWeight: 700 }}>{row.subject.name}</span>
            <span style={{ display: "block", fontSize: "2.6mm" }}>
              {row.studyGroup.name}
            </span>
          </td>
          <td className="c">{row.completedSessions}</td>
          <td className="c">
            {row.settlement
              ? `${row.settlement.paidStudents} / ${row.settlement.students}`
              : "—"}
          </td>
          <td className="c b">
            {row.settlement ? money(row.settlement.teacherAmount) : "—"}
          </td>
          <td className="c">{later && later.total > 0 ? money(later.total) : "—"}</td>
          <td className="c b">
            {row.settlement
              ? money(row.settlement.teacherAmount + (later?.total ?? 0))
              : "—"}
          </td>
          <td className="c">{shortStatusOf(row)}</td>
          <td className="c" style={{ fontSize: "2.6mm" }} dir="ltr">
            {row.payment?.paymentNumber ?? "—"}
          </td>
        </tr>
        );
      }),
      tail: (
        <tr data-flow-tail="">
          <td colSpan={5} style={{ textAlign: "end", fontWeight: 700 }}>
            مجموع الكشوف — {totals.sheets} كشفاً
          </td>
          <td className="c b">{money(totals.due)}</td>
          <td className="c b">{money(totals.arrearsPaid + totals.arrearsPending)}</td>
          <td className="c b">{money(totals.grandDue)}</td>
          <td className="c" colSpan={2} />
        </tr>
      ),
    },
  ];

  if (arrears.length > 0) {
    blocks.push({
      kind: "table",
      key: "arrears",
      title: (
        <h3 data-flow-title="" style={{ margin: "5mm 0 2mm", fontSize: "11pt" }}>
          متأخّرات — سدَّدها الطلبة بعد تخليص كشوفها، ونصيبُ الأستاذ منها ({arrears.length})
        </h3>
      ),
      head: (
        <thead data-flow-head="">
          <tr>
            <th style={{ width: "20%" }}>الطالب</th>
            <th style={{ width: "30%" }}>الكشف الأصلي</th>
            <th style={{ width: "15%" }}>رمز الورقة</th>
            <th style={{ width: "8%" }}>حضر</th>
            <th style={{ width: "14%" }}>نصيبه</th>
            <th style={{ width: "13%" }}>قُبضت بدفعة</th>
          </tr>
        </thead>
      ),
      rows: arrears.map((share) => {
        const student = share.debtCollection.invoice.studentEnrollment.student;
        const origin = share.originalSettlement;

        return (
          <tr key={share.id} data-flow-row="">
            <td>{fullName(student)}</td>
            <td>
              {origin
                ? `${origin.teachingAssignment.subject.name} · ${origin.teachingAssignment.studyGroup.name} · ${
                    origin.attendanceSheet.label?.trim() ||
                    `الشهر رقم ${origin.attendanceSheet.number}`
                  }`
                : "—"}
            </td>
            <td className="c" style={{ fontSize: "2.6mm" }} dir="ltr">
              {origin?.attendanceSheet.code ?? "—"}
            </td>
            <td className="c">{share.attendedUnits ?? "—"}</td>
            <td className="c b">{money(share.shareAmount)}</td>
            <td className="c" style={{ fontSize: "2.6mm" }} dir="ltr">
              {share.teacherPayment?.paymentNumber ?? "—"}
            </td>
          </tr>
        );
      }),
      tail: (
        <tr data-flow-tail="">
          <td colSpan={4} style={{ textAlign: "end", fontWeight: 700 }}>
            مجموع المتأخّرات
          </td>
          <td className="c b">{money(totals.arrearsPaid + totals.arrearsPending)}</td>
          <td className="c">
            {totals.arrearsPending > 0
              ? `${money(totals.arrearsPending)} لم تُقبض`
              : "قُبضت كلُّها"}
          </td>
        </tr>
      ),
    });
  }

  /*
   * خلاصةُ الحساب — معادلةٌ مكتوبةٌ لا مستنتَجة.
   *
   * كلُّ سطرٍ يُقابل عموداً في جدولٍ فوقه، فمن شكّ في رقمٍ تتبّعه إلى
   * مصدره ولم يبقَ للجدل موضع.
   */
  blocks.push({
    kind: "keep",
    key: "grand",
    node: (
      <table
        className="sheet-print-table"
        style={{ marginTop: "5mm", width: "60%", marginInlineStart: "auto" }}
      >
        <tbody>
          {[
            ["مستحقُّ الكشوف عند تخليصها", money(totals.due), false],
            ["+ ما نشأ بعدها من متأخّرات", money(totals.arrearsPaid + totals.arrearsPending), false],
            ["= الإجمالي المستحقّ في السنة", money(totals.grandDue), true],
            ["− المقبوض فعلاً", money(totals.grandPaid), false],
            ["= الباقي له", money(totals.grandUnpaid), true],
          ].map(([label, value, strong]) => (
            <tr key={label as string}>
              <td style={{ textAlign: "start", fontWeight: strong ? 800 : 600 }}>
                {label}
              </td>
              <td
                className="c"
                style={{
                  width: "40%",
                  fontWeight: 800,
                  textDecoration: strong ? "underline" : undefined,
                }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    ),
  });

  blocks.push({
    kind: "keep",
    key: "signatures",
    node: (
      <div
        style={{
          marginTop: "16mm",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <PrintSignature role="الأستاذ" seal={false} />
        <PrintSignature role="مدير المؤسسة" />
      </div>
    ),
  });

  const signature = [
    teacher.id,
    academicYear.id,
    rows.length,
    arrears.length,
    totals.grandUnpaid,
    printedOn,
  ].join("|");

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
