import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  BadgeDollarSign,
  Loader2,
  Printer,
  RefreshCw,
  Search,
  TriangleAlert,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
} from "../../components/shared/FilterPanel";
import { BarcodeScanner } from "../../components/shared/BarcodeScanner";
import { SheetBarcode } from "../../components/print/SheetBarcode";
import { SheetPreview } from "../../components/print/SheetPreview";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { printedStamp } from "../../components/print/printed-at";
import { PrintSignature } from "../../components/print/PrintSignature";
import { usePagedFlow, type PrintBlock } from "../../components/print/paged-flow";
import { useScreenExit } from "../../lib/screen-transition";
import { PATHS } from "../../routes/paths";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { formatMoney, DEFAULT_CURRENCY } from "../../core/utils/money";
import { useAcademicYears } from "../../core/api/reference.api";
import { MONTHS } from "../finance/finance.api";
import {
  getStudent,
  getStudentStatement,
  listStudents,
  type Student,
  type StatementRow,
  type StudentStatement,
} from "../students/student.api";
import { StudentPickerField } from "../students/StudentPickerField";
import { Avatar } from "../../components/shared/Avatar";

const ACCENT = "#93c5fd";

const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.lastName} ${p.firstName}`.trim();

/** «أكتوبر 2026» — الشهر الذي فُتح فيه الكشف */
const periodOf = (row: StatementRow) =>
  row.month && row.year ? `${MONTHS[row.month - 1]} ${row.year}` : "—";

/**
 * كشفُ حساب الطالب.
 *
 * سؤالُ الوليّ واحد: «ماذا على ابني وماذا دفع؟» وكان جوابُه يُجمع من
 * ثلاث شاشات — الحضور من كشفه، والحقّ من الفواتير، والإيصال من المالية.
 * فتُقرأ ثلاثاً ويُخطأ فيها مرّة، ويبقى الوليُّ واقفاً.
 *
 * فهذه ورقةٌ واحدة: سطرٌ لكلّ شهرٍ برقم كشفه، وحضورُه وغيابُه فيه، وحقُّ
 * الشهر وما سُدّد منه وما بقي، ورقمُ الإيصال الذي يُثبت السداد، والأستاذ
 * والفوج. تُطبع وتُمضى من الإدارة وتُسلَّم بيده.
 */
export default function StudentAccountPage() {
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

  const [studentId, setStudentId] = useState("");

  /* حقلان مستقلّان: الاسمُ يُكتب حروفاً والرقمُ يُكتب خاناتٍ */
  const [nameText, setNameText] = useState("");
  const [numberText, setNumberText] = useState("");

  /** المختارُ نفسُه — منه يُعرض اسمُه وصورتُه فوق الورقة */
  const [picked, setPicked] = useState<Student | null>(null);

  const [statement, setStatement] = useState<StudentStatement | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  // --------------------------------------------------
  // السنة ثمّ الطلبة
  // --------------------------------------------------

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]!).id);
  }, [years, yearId]);

  /**
   * ما يقع عند اختيار طالبٍ من القائمة المنسدلة — من أيّ الحقلين كان.
   *
   * ويُملأ الحقلان معاً: من بحث بالاسم يرى رقمَه فيتأكّد أنّه المقصود،
   * ومن بحث بالرقم يرى اسمَه. والتطابقُ بينهما هو ما يمنع فتح حساب
   * «محمد أمين» غيرِ المقصود.
   */
  const pick = useCallback((student: Student) => {
    setPicked(student);
    setStudentId(student.id);
    setNameText(`${student.lastName} ${student.firstName}`);
    setNumberText(student.studentNumber);
  }, []);

  /*
   * القدوم برابطٍ يحمل الطالب — `?y=سنة&st=طالب`.
   *
   * من بطاقة الطالب أو من مسح رقمه، فتفتح الورقة على صاحبها مباشرة.
   */
  const [params, setParams] = useSearchParams();
  const linkYear = params.get("y");
  const linkStudent = params.get("st");

  useEffect(() => {
    if (linkYear) setYearId(linkYear);
  }, [linkYear]);

  useEffect(() => {
    if (!linkStudent) return;

    setStudentId(linkStudent);
    setParams({}, { replace: true });

    /* القادمُ برابطٍ لا يمرّ بالقائمة — فيُجلب ليُملأ به الحقلان */
    getStudent(linkStudent)
      .then(pick)
      .catch(() => setPicked(null));
  }, [linkStudent, setParams, pick]);

  // --------------------------------------------------
  // الكشف
  // --------------------------------------------------

  const load = useCallback(async () => {
    if (!yearId || !studentId) {
      setStatement(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setStatement(await getStudentStatement(studentId, yearId));
    } catch (err: any) {
      setStatement(null);
      setError(err?.response?.data?.message ?? "تعذّر جلب كشف الحساب");
    } finally {
      setLoading(false);
    }
  }, [yearId, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * ما يُبحث عنه بالمسح: **رقم تسجيل الطالب** كما تحمله بطاقتُه.
   *
   * ومطابقتُه تامّةٌ لا احتواء: الخادم يقبل الرقم بحثاً حرّاً فيُرجع معه
   * مَن يحوي رقمُ هاتفه تلك الأرقام، وفتحُ حسابِ طالبٍ آخر بمسحةٍ خطأٌ
   * صامت. فيُختار من الجواب صاحبُ الرقم عينِه أو لا أحد.
   */
  const resolveStudent = useCallback(async (text: string) => {
    const code = text.trim();

    const { students: found } = await listStudents({ search: code, limit: 20 });

    return found.find((row) => row.studentNumber === code) ?? null;
  }, []);

  const chips = useMemo(
    () =>
      statement
        ? [
            { label: "الطالب", value: fullName(statement.student) },
            { label: "السنة", value: statement.academicYear.name },
          ]
        : [],
    [statement],
  );

  const student = statement?.student;
  const t = statement?.totals;

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="كشف حساب الطالب" subtitle="الحضور والحقوق والإيصالات — سنةً كاملة">
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
          storageKey="attendance.student-account"
          collapseKey={studentId}
          busy={loading}
          chips={chips}
          extra={
            <BarcodeScanner<Student>
              accent={ACCENT}
              onFound={pick}
              copy={{
                button: "مسح بطاقة الطالب",
                buttonTitle: "افتح حساب طالبٍ بمسح باركود بطاقته",
                title: "مسح رقم تسجيل الطالب",
                subtitle: "البطاقة تفتح حساب صاحبها — بلا بحثٍ في القائمة",
                placeholder: "امسح باركود البطاقة، أو اكتب رقم التسجيل…",
                action: "افتح الحساب",
                notFound: "لا وجود لطالبٍ بهذا الكود بار — الرجاء التحقّق منه.",
                hint: "الرقم مكتوبٌ تحت الباركود",
                steps: [
                  <>
                    وجّه القارئ إلى{" "}
                    <span className="font-bold text-white/85">باركود بطاقة الطالب</span>، أو
                    إلى الباركود المطبوع على ورقة حسابه.
                  </>,
                  <>القارئ يكتب الرقم في الحقل أدناه من نفسه ثمّ يُرسله — لا تضغط شيئاً.</>,
                  <>تُغلق هذه النافذة ويُفتح حسابُ الطالب: سنتُه كاملةً بحضوره وحقّه وإيصالاته.</>,
                ],
              }}
              resolve={resolveStudent}
            />
          }
          onReset={() => {
            setStudentId("");
            setPicked(null);
            setNameText("");
            setNumberText("");
          }}
        >
          <FilterField label="السنة الدراسية">
            <FilterSelect
              value={yearId}
              onChange={setYearId}
              items={years.map((y) => ({ id: y.id, name: y.name }))}
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="الاسم واللقب" span>
            <StudentPickerField
              mode="name"
              value={nameText}
              onChange={(text) => {
                setNameText(text);
                /* الكتابةُ من جديد تُلغي الاختيار — لا يبقى كشفٌ لاسمٍ مُسح */
                if (!text.trim()) {
                  setStudentId("");
                  setPicked(null);
                }
              }}
              onPick={pick}
              scope={{ academicYearId: yearId, isActive: true }}
              placeholder="اكتب حرفاً أو حرفين من الاسم أو اللقب…"
              accent={ACCENT}
            />
          </FilterField>

          <FilterField label="رقم التسجيل">
            <StudentPickerField
              mode="number"
              value={numberText}
              onChange={(text) => {
                setNumberText(text);
                if (!text.trim()) {
                  setStudentId("");
                  setPicked(null);
                }
              }}
              onPick={pick}
              scope={{ academicYearId: yearId, isActive: true }}
              placeholder="2026000…"
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

        {!studentId && !loading && (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-center">
            <Search className="mx-auto mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/45">
              اختر طالباً لتُعرض سنتُه كاملةً — شهراً شهراً بحضوره وحقّه وإيصاله.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.02] p-10 text-sm text-white/50">
            <Loader2 className="h-4 w-4 animate-spin" />
            يُجمع كشف الحساب...
          </div>
        )}

        {statement && student && t && !loading && (
          <>
            {/* ============ الترويسة ============ */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-2.5 text-base font-black">
                  <Avatar
                    src={picked?.avatar}
                    name={fullName(student)}
                    gender={picked?.gender}
                    size={34}
                  />
                  {fullName(student)}
                </span>

                <Meta label="رقم المؤسسة" value={student.studentNumber} mono />
                {student.level && <Meta label="المستوى" value={student.level.name} />}
                <Meta label="السنة" value={statement.academicYear.name} />
                <Meta label="هاتف الوليّ" value={student.parentPhone} mono />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="الكشوف" value={String(t.sheets)} tone="#cbd5e1" />
                <Stat
                  label="حضر / غاب"
                  value={`${t.attended} / ${t.absent}`}
                  tone={t.absent > 0 ? "#fcd34d" : "#86efac"}
                />
                <Stat label="إجمالي الحقوق" value={money(t.due)} tone="#cbd5e1" />
                <Stat
                  label="المتبقّي"
                  value={money(t.remaining)}
                  tone={t.remaining > 0 ? "#fda4af" : "#86efac"}
                  strong
                />
              </div>

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
                  onClick={() => navigate(PATHS.studentDetail(student.id))}
                  className="flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-bold text-white/70 transition hover:bg-sky-500/15 hover:text-sky-200"
                >
                  <BadgeDollarSign className="h-4 w-4" />
                  ملفّ الطالب
                </button>
              </div>
            </section>

            {/* ============ الجدول ============ */}
            <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-3.5">
                <h2 className="text-sm font-black">الشهور — حضورٌ وحقٌّ وإيصال</h2>
                <span className="text-[11px] text-white/40">
                  سطرٌ لكلّ مادةٍ في كلّ شهر — لا سطرٌ للشهر كلِّه
                </span>
              </header>

              {statement.rows.length === 0 ? (
                <p className="p-8 text-center text-sm text-white/40">
                  لا كشوفَ لهذا الطالب في هذه السنة.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-250 text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-xs text-white/45">
                        <th className="px-4 py-3 text-start font-bold">الشهر</th>
                        <th className="w-20 px-2 py-3 text-center font-bold">الكشف</th>
                        <th className="px-4 py-3 text-start font-bold">المادة والأستاذ</th>
                        <th className="w-24 px-2 py-3 text-center font-bold">الفوج</th>
                        <th className="w-20 px-2 py-3 text-center font-bold">حضر</th>
                        <th className="w-20 px-2 py-3 text-center font-bold">غاب</th>
                        <th className="w-28 px-2 py-3 text-center font-bold">الحقّ</th>
                        <th className="w-28 px-2 py-3 text-center font-bold">المدفوع</th>
                        <th className="w-28 px-2 py-3 text-center font-bold">المتبقّي</th>
                        <th className="px-4 py-3 text-start font-bold">الإيصال</th>
                      </tr>
                    </thead>

                    <tbody>
                      {statement.rows.map((row) => (
                        <tr
                          key={`${row.sheetId}-${row.subject.id}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="px-4 py-3 font-bold">{periodOf(row)}</td>

                          <td className="px-2 py-3 text-center text-white/70">
                            {row.sheetLabel?.trim() || row.sheetNumber}
                          </td>

                          <td className="px-4 py-3">
                            <span className="block font-bold">{row.subject.name}</span>
                            <span className="mt-0.5 block text-[11px] text-white/40">
                              {fullName(row.teacher)}
                            </span>
                          </td>

                          <td className="px-2 py-3 text-center text-white/70">
                            {row.studyGroup.name}
                          </td>

                          <td className="px-2 py-3 text-center font-bold text-emerald-300">
                            {row.attended}
                          </td>

                          <td
                            className={`px-2 py-3 text-center font-bold ${row.absent > 0 ? "text-rose-300" : "text-white/25"}`}
                          >
                            {row.absent || "—"}
                          </td>

                          <td className="px-2 py-3 text-center text-white/70">
                            {row.invoice ? money(row.invoice.total) : "—"}
                          </td>

                          <td className="px-2 py-3 text-center text-emerald-300">
                            {row.invoice ? money(row.invoice.paid) : "—"}
                          </td>

                          <td
                            className={`px-2 py-3 text-center font-black ${
                              row.invoice && row.invoice.remaining > 0
                                ? "text-rose-300"
                                : "text-white/25"
                            }`}
                          >
                            {row.invoice && row.invoice.remaining > 0
                              ? money(row.invoice.remaining)
                              : "—"}
                          </td>

                          <td className="px-4 py-3">
                            {row.receipts.length === 0 ? (
                              <span className="text-white/25">—</span>
                            ) : (
                              row.receipts.map((r) => (
                                <span
                                  key={r.receiptNumber}
                                  className="mb-0.5 block font-mono text-[11px] text-white/60"
                                  dir="ltr"
                                >
                                  {r.receiptNumber}
                                </span>
                              ))
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>

                    <tfoot>
                      <tr className="border-t border-white/15 bg-white/[0.03] text-sm font-black">
                        <td className="px-4 py-3" colSpan={4}>
                          المجموع — {t.sheets} كشفاً
                        </td>
                        <td className="px-2 py-3 text-center text-emerald-300">{t.attended}</td>
                        <td className="px-2 py-3 text-center text-rose-300">{t.absent || "—"}</td>
                        <td className="px-2 py-3 text-center">{money(t.due)}</td>
                        <td className="px-2 py-3 text-center text-emerald-300">{money(t.paid)}</td>
                        <td
                          className="px-2 py-3 text-center"
                          style={{ color: t.remaining > 0 ? "#fda4af" : "#86efac" }}
                        >
                          {money(t.remaining)}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {previewing && statement && (
        <SheetPreview
          title="كشف حساب الطالب"
          subtitle={`${fullName(statement.student)} — ${statement.academicYear.name}`}
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
  tone,
  strong = false,
}: {
  label: string;
  value: string;
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
    </div>
  );
}

// --------------------------------------------------
// الورقة المطبوعة
// --------------------------------------------------

/*
 * نسبُ الأعمدة — مقيسةٌ لا مقدَّرة، ومجموعها مئةٌ بالضبط.
 *
 * وضِيقُ عمودٍ لا يُخفي شيئاً بل يلفّه سطرين: «الكشف» كانت تُقرأ
 * «الكش/ف» في ترويسته، وهو أسوأُ من عمودٍ أعرض بنقطتين.
 *
 * والنسب أُثبتت بالقياس على أضيق ما تكون الورقة (عموديّةً، 198مم)
 * وبأسوأِ ما يقع فيها فعلاً — «الرياضيات التطبيقية» مادّةً، و«بن عبد
 * الله محمد الأمين» أستاذاً، و«12,500.00 دج» مبلغاً، وثلاثَ عشرة
 * خانةً إيصالاً. فهي على الأفقيّة (285مم) أوسعُ من أن تلتفّ.
 */
const COLUMN = {
  period: 12,
  sheet: 8,
  subject: 17,
  group: 9,
  attended: 5,
  absent: 5,
  due: 11,
  paid: 11,
  remaining: 11,
  receipt: 11,
} as const;

/**
 * ورقةُ كشف الحساب — تُسلَّم بيد الوليّ.
 *
 * الترويسة تتكرّر على كلّ ورقة (من حمل الثانية وحدها يجب أن يعرف لِمَن
 * هي)، والمجموع والإمضاء على الأخيرة وحدها — يُوقَّع على آخر الوثيقة
 * لا على كلّ ورقةٍ منها.
 *
 * والباركود يشفّر **رقم الطالب في المؤسسة** لا معرّفاً داخلياً: هو نفسه
 * ما تحمله بطاقتُه، فمسحةٌ واحدة من البطاقة أو من هذه الورقة تفتح
 * حسابَه — والرقم مكتوبٌ تحته مخرجاً حين يعجز الماسح.
 */
function StatementPrint({
  schoolName,
  statement,
  currency,
  logo,
}: {
  schoolName: string;
  statement: StudentStatement;
  currency: string;
  logo: LogoSpec;
}) {
  const money = (value: number) => formatMoney(value, currency);
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));
  const printedOn = printedStamp();

  const { student, academicYear, rows, totals } = statement;

  const header = (
    <header className="sheet-print-top">
      <div className="sheet-print-side">
        <span>الطالب : {fullName(student)}</span>
        <span>رقم المؤسسة : {student.studentNumber}</span>
        <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
        <SheetBarcode code={student.studentNumber} />
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
        <h2>كشف حساب الطالب</h2>
      </div>

      <div className="sheet-print-side sheet-print-side-end">
        <span>السنة الدراسية : {academicYear.name}</span>
        {student.level && <span>المستوى : {student.level.name}</span>}
        <span>هاتف الوليّ : {student.parentPhone}</span>
      </div>
    </header>
  );

  /*
   * الكتل — بترتيب قراءتها.
   *
   * والتقسيم بالتدفّق لا بالأسطر وحدها: تحت الجدول سطرُ ذمّةٍ وإمضاء،
   * وهما كتلتان لا تُشطران ولا تُتركان تتدلّيان خارج الورقة. انظر
   * `components/print/paged-flow`.
   */
  const blocks: PrintBlock[] = [
    {
      kind: "table",
      key: "months",
      head: (
        <thead data-flow-head="">
          <tr>
            <th style={{ width: `${COLUMN.period}%` }}>الشهر</th>
            <th style={{ width: `${COLUMN.sheet}%` }}>الكشف</th>
            <th style={{ width: `${COLUMN.subject}%` }}>المادة والأستاذ</th>
            <th style={{ width: `${COLUMN.group}%` }}>الفوج</th>
            <th style={{ width: `${COLUMN.attended}%` }}>حضر</th>
            <th style={{ width: `${COLUMN.absent}%` }}>غاب</th>
            <th style={{ width: `${COLUMN.due}%` }}>الحقّ</th>
            <th style={{ width: `${COLUMN.paid}%` }}>المدفوع</th>
            <th style={{ width: `${COLUMN.remaining}%` }}>المتبقّي</th>
            <th style={{ width: `${COLUMN.receipt}%` }}>الإيصال</th>
          </tr>
        </thead>
      ),
      rows: rows.map((row) => (
        <tr key={`${row.sheetId}-${row.subject.id}`} data-flow-row="">
          <td className="c">{periodOf(row)}</td>
          {/*
            رقمُ الكشف لا تسميتُه: التسمية حرّةٌ («الشهر رقم 2») وتكرّر
            ما يقوله عمود الشهر إلى يمينها، وتلفّ العمودَ سطرين.
          */}
          <td className="c">{row.sheetNumber}</td>
          <td>
            <span style={{ fontWeight: 700 }}>{row.subject.name}</span>
            <span style={{ display: "block", fontSize: "2.6mm" }}>
              {fullName(row.teacher)}
            </span>
          </td>
          <td className="c">{row.studyGroup.name}</td>
          <td className="c b">{row.attended}</td>
          <td className="c">{row.absent || "—"}</td>
          <td className="c">{row.invoice ? money(row.invoice.total) : "—"}</td>
          <td className="c">{row.invoice ? money(row.invoice.paid) : "—"}</td>
          <td className="c b">
            {row.invoice && row.invoice.remaining > 0 ? money(row.invoice.remaining) : "—"}
          </td>
          <td className="c" style={{ fontSize: "2.6mm" }} dir="ltr">
            {row.receipts.map((r) => r.receiptNumber).join(" · ") || "—"}
          </td>
        </tr>
      )),
      tail: (
        <tr data-flow-tail="">
          <td colSpan={4} style={{ textAlign: "end", fontWeight: 700 }}>
            المجموع — {totals.sheets} كشفاً
          </td>
          <td className="c b">{totals.attended}</td>
          <td className="c b">{totals.absent || "—"}</td>
          <td className="c b">{money(totals.due)}</td>
          <td className="c b">{money(totals.paid)}</td>
          <td className="c b">{money(totals.remaining)}</td>
          <td />
        </tr>
      ),
    },
    {
      kind: "keep",
      key: "verdict",
      node: (
        <p
          style={{
            margin: "3mm 0 0",
            fontSize: "11pt",
            fontWeight: 800,
            textAlign: "center",
          }}
        >
          {totals.remaining > 0 ? (
            <>
              الباقي في ذمّة الطالب:{" "}
              <span style={{ textDecoration: "underline" }}>{money(totals.remaining)}</span>
            </>
          ) : (
            "لا شيءَ في ذمّة الطالب — الحساب مسدَّدٌ كاملاً."
          )}
        </p>
      ),
    },
    {
      kind: "keep",
      key: "signature",
      node: (
        /*
         * الإمضاء أسفلَ يسارِ الورقة — لا في وسطها.
         *
         * وهو موضعُه في المراسلة الإدارية الجزائرية. والورقة عربيةٌ
         * اتّجاهها من اليمين، فاليسار طرفُها الأخير — `flex-end`.
         *
         * وواحدةٌ لا اثنتان: كشفُ الحساب تُصدره الإدارة ويُسلَّم للوليّ،
         * ولا طرفَ ثانيَ يُقرّ فيه.
         */
        <div
          style={{
            marginTop: "14mm",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <PrintSignature role="مدير المؤسسة" />
        </div>
      ),
    },
  ];

  /* بصمةُ ما يغيّر الارتفاعات — تبدّلُها يُعيد القياس */
  const signature = [
    student.id,
    academicYear.id,
    rows.length,
    totals.remaining,
    printedOn,
  ].join("|");

  const { measureRef, pages } = usePagedFlow(signature, blocks.length);

  /*
   * طورُ القياس — ورقةٌ خفيّة فيها كلُّ الكتل بعلاماتها.
   *
   * ولا تحمل صنف `.sheet-page` فلا تعدّها المعاينة ورقةً.
   */
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

          {/* الفراغ الذي ينزل بالتذييل إلى أسفل الورقة — محسوبٌ لا مفروض */}
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
