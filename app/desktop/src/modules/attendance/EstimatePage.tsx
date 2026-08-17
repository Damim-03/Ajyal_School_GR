import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  CircleCheckBig,
  ClipboardList,
  Info,
  Loader2,
  Printer,
  RefreshCw,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { logoSpec, type LogoSpec } from "../../components/print/logo";
import { SheetPreview } from "../../components/print/SheetPreview";
import { useAcademicYears } from "../../core/api/reference.api";
import { useSchool, useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { money } from "../finance/finance.api";
import {
  BASIS_LABEL,
  METHOD_LABEL,
  bucketByAttendance,
  getEstimate,
  policyValue,
  type BucketSummary,
  type Estimate,
} from "../finance/settlements.api";
import {
  deriveOptions,
  fullName,
  listAssignments,
  listSheets,
  resolveAssignment,
  sheetTitle,
  type Assignment,
  type Sheet,
  type SheetFilters,
} from "./attendance.api";
import { feeDate } from "./fees";

const ACCENT = "#93c5fd";

/**
 * خطوط الجدول — أفقيةٌ ورأسية.
 *
 * الأفقية وحدها لا تكفي في جدولٍ خمسةُ أعمدةٍ عريضة: العين تنزلق بين
 * «قيمة الوحدة» و«المجموع» فتُقرأ قيمةُ صفٍّ في عمود غيره. والخطوط
 * خافتةٌ عمداً — تفصل ولا تُشوّش.
 */
const headCell = "border-white/10 px-4 py-3 text-center font-bold";
const bodyCell = "border-white/5 px-4 py-2.5";

const EMPTY_FILTERS: SheetFilters = {
  stageId: "",
  levelId: "",
  subjectId: "",
  teacherId: "",
  groupId: "",
};

const FILTER_ORDER: (keyof SheetFilters)[] = [
  "stageId",
  "levelId",
  "subjectId",
  "teacherId",
  "groupId",
];

const matchesAll = (a: Assignment, f: SheetFilters) =>
  (!f.stageId || a.studyGroup.level.educationStage.id === f.stageId) &&
  (!f.levelId || a.studyGroup.level.id === f.levelId) &&
  (!f.subjectId || a.subject.id === f.subjectId) &&
  (!f.teacherId || a.teacher.id === f.teacherId) &&
  (!f.groupId || a.studyGroup.id === f.groupId);

/**
 * الكشف التقديري للحصص — §16.
 *
 * يجيب عن سؤالين في ورقةٍ واحدة، وهما سؤالان لا واحد:
 *
 *   • كم يستحقّ الأستاذ عن هذا الكشف؟
 *   • ومَن من الطلبة لم يدفع بعد؟
 *
 * وجمعُهما مقصود. الأستاذ يُخلَّص في وقته سواء دفع الطلبة أم لا — لن
 * ينتظر راتبه حتى يسدّد آخرُ متأخّر. فما لم يُدفع يبقى **ديناً على
 * الطالب** لا خصماً من الأستاذ (§2)، ويُسمّى صاحبُه **مخلَّفاً** حتى
 * يسدّد. وحين يسدّد يُطفأ الدين من نفسه: مصدرُه `Invoice.remaining`،
 * فالدفعة تُنقصه ولا تحتاج خطوةً ثانية تُنسى.
 *
 * والحسابات كلّها من الخادم — لا رقم يُدخله المستخدم هنا (§18).
 */
export default function EstimatePage() {
  const exitTo = useScreenExit();
  const schoolName = useSchool("school.name_ar");
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");
  const logo = logoSpec(useSchoolStore((s) => s.settings));

  const yearsQuery = useAcademicYears();
  const years = yearsQuery.data ?? [];
  const [yearId, setYearId] = useState("");

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetId, setSheetId] = useState("");

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId((years.find((y) => y.isCurrent) ?? years[0]).id);
  }, [years, yearId]);

  useEffect(() => {
    if (!yearId) return;
    let alive = true;
    setFilters(EMPTY_FILTERS);

    listAssignments(yearId)
      .then((rows) => alive && setAssignments(rows))
      .catch((err) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب الإسنادات"));

    return () => { alive = false; };
  }, [yearId]);

  const options = useMemo(() => deriveOptions(assignments, filters), [assignments, filters]);
  const assignment = useMemo(() => resolveAssignment(assignments, filters), [assignments, filters]);

  const setFilter = (key: keyof SheetFilters, value: string) => {
    setFilters((prev) => {
      let next = { ...prev, [key]: value };
      const others = FILTER_ORDER.filter((k) => k !== key);

      while (!assignments.some((a) => matchesAll(a, next))) {
        const drop = [...others].reverse().find((k) => next[k]);
        if (!drop) break;
        next = { ...next, [drop]: "" };
      }

      return next;
    });
  };

  useEffect(() => {
    if (!assignment) {
      setSheets([]);
      setSheetId("");
      return;
    }

    let alive = true;

    listSheets(assignment.id)
      .then((rows) => {
        if (!alive) return;
        setSheets(rows);
        setSheetId(rows.length > 0 ? rows[rows.length - 1].id : "");
      })
      .catch(() => {});

    return () => { alive = false; };
  }, [assignment]);

  const load = useCallback(async () => {
    if (!assignment || !sheetId) {
      setEstimate(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setEstimate(
        await getEstimate({
          teachingAssignmentId: assignment.id,
          attendanceSheetId: sheetId,
        }),
      );
    } catch (err: any) {
      setEstimate(null);
      /* الخادم يشرح السبب: لا سياسة، أو لا سعر، أو لا حصة منجزة */
      setError(err?.response?.data?.message ?? "تعذّر حساب الكشف");
    } finally {
      setLoading(false);
    }
  }, [assignment, sheetId]);

  useEffect(() => { load(); }, [load]);

  const t = estimate?.totals;

  /**
   * التجميع بعدد الحصص — قراءة الورقة اليدوية للكشف نفسه.
   *
   * لا طلبَ ثانياً للخادم: المعطيات كلُّها في `estimate.students`
   * (حضورُ كلِّ طالبٍ وحالتُه المالية)، والتجميع إعادةُ ترتيبٍ لها.
   */
  const buckets = useMemo(
    () => (estimate ? bucketByAttendance(estimate) : null),
    [estimate],
  );

  /** ما يُقرأ قبل إهدار ورقة */
  const printWarning = useMemo(() => {
    if (!t) return null;

    const parts: string[] = [];

    if (t.missingSessions > 0)
      parts.push(`${t.missingSessions} حصة لم تُنجز بعد من ${t.approvedSessions}`);
    if (t.uninvoiced > 0)
      parts.push(`${t.uninvoiced} طالباً بلا فاتورة — ولّد فواتير الشهر أولاً`);

    return parts.length > 0
      ? `الكشف غير مكتمل: ${parts.join("، ")}. المبلغ المحسوب يعكس ما أُنجز فقط.`
      : null;
  }, [t]);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الكشف التقديري للحصص" subtitle="مستحقّ الأستاذ · ديون الطلبة">
        <button
          onClick={() => exitTo(PATHS.attendance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-[1500px] p-6">
        {/* ============ المرشِّحات ============ */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 rounded-2xl border border-white/10 bg-white/[0.02] p-4"
        >
          <div className="flex flex-wrap items-end gap-3">
            <Field label="السنة الدراسية">
              <select value={yearId} onChange={(e) => setYearId(e.target.value)} className={selectClass}>
                {years.map((y) => (
                  <option key={y.id} value={y.id} className="bg-[#0a0f1a]">{y.name}</option>
                ))}
              </select>
            </Field>

            <Field label="الطور">
              <Picker value={filters.stageId} onChange={(v) => setFilter("stageId", v)} items={options.stages} all="كل الأطوار" />
            </Field>
            <Field label="المستوى">
              <Picker value={filters.levelId} onChange={(v) => setFilter("levelId", v)} items={options.levels} all="كل المستويات" />
            </Field>
            <Field label="المادة">
              <Picker value={filters.subjectId} onChange={(v) => setFilter("subjectId", v)} items={options.subjects} all="اختر المادة" />
            </Field>
            <Field label="الأستاذ">
              <Picker
                value={filters.teacherId}
                onChange={(v) => setFilter("teacherId", v)}
                items={options.teachers.map((x) => ({ id: x.id, name: fullName(x) }))}
                all="اختر الأستاذ"
              />
            </Field>
            <Field label="الفوج">
              <Picker value={filters.groupId} onChange={(v) => setFilter("groupId", v)} items={options.groups} all="اختر الفوج" />
            </Field>

            {assignment && (
              <Field label="الكشف">
                <select
                  value={sheetId}
                  onChange={(e) => setSheetId(e.target.value)}
                  className={selectClass}
                  disabled={sheets.length === 0}
                >
                  {sheets.length === 0 ? (
                    <option value="" className="bg-[#0a0f1a]">لا كشوف بعد</option>
                  ) : (
                    sheets.map((s) => (
                      <option key={s.id} value={s.id} className="bg-[#0a0f1a]">{sheetTitle(s)}</option>
                    ))
                  )}
                </select>
              </Field>
            )}

            {loading && <Loader2 className="mb-2.5 h-4 w-4 animate-spin text-white/40" />}
          </div>
        </motion.div>

        {error && (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="whitespace-pre-line leading-relaxed">{error}</span>
            <button onClick={() => setError(null)}>
              <X className="h-4 w-4 shrink-0" />
            </button>
          </div>
        )}

        {!assignment ? (
          <Empty
            title="اختر المادة والأستاذ والفوج"
            hint="الكشف يُحسب على إسنادٍ تدريسي وكشفِ حضورٍ بعينه — منهما تأتي الحصص والطلبة والحقوق."
          />
        ) : !estimate ? (
          !loading && !error && (
            <Empty title="لا كشف محسوب" hint="اختر كشف حضورٍ من القائمة." />
          )
        ) : (
          <>
            {/* ============ الترويسة ============ */}
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <div className="mb-4 flex flex-wrap items-center gap-x-8 gap-y-2.5 text-sm">
                <Meta label="المؤسسة" value={schoolName} strong />
                <Meta label="المادة" value={estimate.header.subject.name} strong />
                <Meta label="الأستاذ" value={fullName(estimate.header.teacher)} />
                <Meta label="المستوى" value={estimate.header.level.name} />
                <Meta label="الفوج" value={estimate.header.studyGroup.name} />
                <Meta
                  label="المدى"
                  value={
                    estimate.header.dateFrom
                      ? `${feeDate(estimate.header.dateFrom)} — ${feeDate(estimate.header.dateTo)}`
                      : "—"
                  }
                />
              </div>

              {/* السياسة المعتمدة — تُقرأ لأنّ المبلغ يتبعها */}
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-4 py-3 text-xs">
                <Wallet className="h-4 w-4 shrink-0" style={{ color: ACCENT }} />
                <span className="text-white/50">السياسة</span>
                <span className="font-black">{estimate.policy.name}</span>
                <span className="rounded-full bg-white/8 px-2.5 py-1 font-bold">
                  {METHOD_LABEL[estimate.policy.method]}
                </span>
                <span className="rounded-full px-2.5 py-1 font-bold" style={{ background: `${ACCENT}1f`, color: ACCENT }}>
                  {policyValue(estimate.policy)}
                </span>
                <span className="text-white/50">
                  أساس العدّ: <span className="font-bold text-white/75">{BASIS_LABEL[estimate.policy.countBasis]}</span>
                </span>
                <span className="text-white/50">
                  الحقّ الشهري: <span className="font-bold text-white/75">{money(estimate.tuition, currency)}</span>
                </span>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat label="الحصص المنجزة" value={`${t!.completedSessions} / ${t!.approvedSessions}`} tone={t!.missingSessions > 0 ? "#fcd34d" : "#86efac"} />
                <Stat label="الطلبة المسجَّلون" value={String(t!.enrolledStudents)} tone="#cbd5e1" />
                <Stat label="المخلَّفون" value={String(t!.defaulters)} tone={t!.defaulters > 0 ? "#fda4af" : "#86efac"} />
                <Stat label="مستحقّ الأستاذ" value={money(t!.teacherAmount, currency)} tone={ACCENT} strong />
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <Stat label="إجمالي الحقوق" value={money(t!.grossTuition, currency)} tone="#cbd5e1" />
                <Stat label="المحصَّل" value={money(t!.collected, currency)} tone="#86efac" />
                <Stat label="الديون المتبقّية" value={money(t!.remaining, currency)} tone={t!.remaining > 0 ? "#fda4af" : "#86efac"} />
              </div>

              {printWarning && (
                <p className="mt-3 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-2.5 text-xs leading-relaxed text-amber-200">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  {printWarning}
                </p>
              )}

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
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#04121f] transition hover:brightness-110"
                  style={{ background: ACCENT }}
                >
                  <Printer className="h-4 w-4" />
                  معاينة وطباعة
                </button>
              </div>
            </div>

            {/* ============ جدول §16 ============
                خمسةُ أعمدة لا تسعُ عرضَ الشاشة كلَّه: تُركت ممدودةً
                فتباعدت الترويسةُ عن قيمتها حتى صار التاريخ في وادٍ
                وعنوانُه في وادٍ. فحُدّ عرضُها وصُفَّت في الوسط. */}
            <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-5 py-3.5">
                <span className="text-xs font-bold text-white/60">
                  الحصص المحتسبة — المبلغ يُحسب ولا يُدخَل
                </span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/35">
                  <span>المحتسب: {BASIS_LABEL[estimate.policy.countBasis]}</span>
                  <span>
                    سعر الحصة للمؤسسة:{" "}
                    <span className="font-bold text-white/60" dir="ltr">
                      {t!.institutionSessionRate}
                    </span>
                  </span>
                  {/* §37: لا يُجمع العمودان — أحدهما مالٌ مستحقّ والآخر مالٌ لم يدخل */}
                  <span className="text-rose-300/50">
                    «غير محصَّل» لا يُضاف إلى مستحقّ الأستاذ
                  </span>
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] text-white/45">
                    {/*
                      نِسَبٌ لا بكسلات — الجدول يأخذ عرض الصفحة كجدول
                      الطلبة تحته، فلو ثُبّتت الأعمدة بالبكسل لابتلع
                      عمودٌ واحدٌ مرنٌ كلَّ الزيادة ووقف رقمُه في فراغ.
                    */}
                    <th style={{ width: "7%" }} className={`${headCell} border-e`}>
                      <Head title="الحصة" gloss="ترتيبها في الكشف" />
                    </th>
                    <th style={{ width: "14%" }} className={`${headCell} border-e`}>
                      <Head title="التاريخ" gloss="يوم إجرائها" />
                    </th>
                    <th style={{ width: "23%" }} className={`${headCell} border-e`}>
                      <Head title="المحتسبون" gloss="حضروا وسدّدوا — من مجموع الحاضرين" />
                    </th>
                    <th style={{ width: "13%" }} className={`${headCell} border-e`}>
                      <Head title="قيمة الوحدة" gloss="نصيب الأستاذ من حضورٍ واحد" />
                    </th>
                    <th style={{ width: "18%" }} className={`${headCell} border-e !text-end px-5`}>
                      <Head title="المجموع" gloss="المحتسبون × قيمة الوحدة" end />
                    </th>
                    {/* قسمُ المخلَّفين — مفصولٌ بخطٍّ أعرض لأنّه لا يُجمع مع ما قبله */}
                    <th
                      style={{ width: "11%" }}
                      className={`${headCell} border-e border-s-2 border-s-rose-300/25`}
                    >
                      <Head title="المخلَّفون" gloss="حضروا ولم يسدّدوا" />
                    </th>
                    <th style={{ width: "14%" }} className={`${headCell} !text-end px-5`}>
                      <Head title="غير محصَّل" gloss="المخلَّفون × سعر الحصة للمؤسسة" end />
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {estimate.rows.map((row) => {
                    const excluded = row.presentStudents - row.countedStudents;

                    return (
                      <tr
                        key={row.lessonNumber}
                        className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                      >
                        <td className={`${bodyCell} border-e text-center font-black`} style={{ color: ACCENT }}>
                          {row.order}
                        </td>
                        <td className={`${bodyCell} border-e text-center text-white/55`}>
                          {/*
                            `dir` على المحتوى لا على الخانة.
                            وضعُه على الخانة يقلب معنى «المحاذاة إلى
                            النهاية»: فتصير نهايةُ الترويسة العربية يساراً
                            ونهايةُ الرقم اللاتيني يميناً، فيفترقان.
                          */}
                          <span dir="ltr" className="tabular-nums">{feeDate(row.sessionDate)}</span>
                        </td>
                        <td className={`${bodyCell} border-e text-center`}>
                          <span className="font-black">{row.countedStudents}</span>
                          {/* الفرق يُقرأ في مكانه: لماذا سبعةٌ ومن حضر أحدَ عشر */}
                          {excluded > 0 && (
                            <span className="ms-1.5 text-[11px] text-white/30">
                              من {row.presentStudents} حاضراً
                            </span>
                          )}
                        </td>
                        <td className={`${bodyCell} border-e text-center text-white/55`}>
                          <span dir="ltr" className="tabular-nums">{row.rate}</span>
                        </td>
                        <td className={`${bodyCell} border-e px-5 text-end font-bold`}>
                          <span dir="ltr" className="tabular-nums">{money(row.lineTotal, currency)}</span>
                        </td>

                        <td className={`${bodyCell} border-e border-s-2 border-s-rose-300/15 text-center`}>
                          {row.outstandingStudents > 0 ? (
                            <span className="font-bold text-rose-300/80">{row.outstandingStudents}</span>
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </td>

                        <td className={`${bodyCell} px-5 text-end font-bold`}>
                          {row.outstandingAmount > 0 ? (
                            <span dir="ltr" className="tabular-nums text-rose-300/80">
                              {money(row.outstandingAmount, currency)}
                            </span>
                          ) : (
                            <span className="text-white/15">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot>
                  <tr className="border-t border-white/15 bg-white/[0.04]">
                    <td colSpan={2} className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
                      {t!.completedSessions} حصص
                    </td>
                    <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
                      {t!.countedUnits} وحدة محتسبة
                    </td>
                    <td className="border-e border-white/10 px-4 py-3.5 text-end font-bold text-white/60">
                      مستحقّ الأستاذ
                    </td>
                    <td
                      className="border-e border-white/10 px-5 py-3.5 text-end text-base font-black"
                      style={{ color: ACCENT }}
                    >
                      <span dir="ltr" className="tabular-nums">{money(t!.teacherAmount, currency)}</span>
                    </td>

                    <td className="border-e border-s-2 border-white/10 border-s-rose-300/25 px-4 py-3.5 text-center text-[11px] text-white/40">
                      {t!.outstandingUnits} وحدة
                    </td>
                    <td className="px-5 py-3.5 text-end">
                      <span dir="ltr" className="block text-base font-black tabular-nums text-rose-300/80">
                        {money(t!.outstandingEstimated, currency)}
                      </span>
                      {/*
                        نصيبُ الأستاذ منها — مؤجَّلٌ لا مدفوع.
                        بغيره يُقرأ 6,000 على أنّه حقُّ الأستاذ الضائع،
                        وحقُّه منها 4,500 والباقي حقُّ المؤسسة.
                      */}
                      {t!.outstandingTeacherShare !== null && (
                        <span className="mt-1 block text-[10px] font-normal leading-tight text-white/35">
                          نصيب الأستاذ المؤجَّل{" "}
                          <span dir="ltr" className="font-bold tabular-nums text-white/55">
                            {money(t!.outstandingTeacherShare, currency)}
                          </span>
                        </span>
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* ============ التجميع بعدد الحصص — ورقة الإدارة ============ */}
            {buckets && buckets.buckets.length > 0 && (
              <BucketTable
                buckets={buckets}
                sessionRate={t!.institutionSessionRate}
                countedUnits={t!.countedUnits}
                currency={currency}
              />
            )}

            {/* ============ الطلبة والديون ============ */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
                <span className="text-xs font-bold text-white/50">
                  الطلبة — الحضور والدَّين
                </span>
                <span className="flex items-center gap-2 text-[11px] text-white/35">
                  <Info className="h-3.5 w-3.5" />
                  الأستاذ يُخلَّص في وقته — وما لم يُدفع يبقى ديناً على الطالب لا خصماً من الأستاذ
                </span>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-xs text-white/50">
                    <th className="w-12 px-3 py-3 text-center font-bold">#</th>
                    <th className="px-4 py-3 text-start font-bold">اللقب والاسم</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">حضر</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">غاب</th>
                    <th className="w-20 px-3 py-3 text-center font-bold">لم يُدوَّن</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">المستحقّ</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">المدفوع</th>
                    <th className="w-28 px-3 py-3 text-center font-bold">الدَّين</th>
                    <th className="w-32 px-3 py-3 text-center font-bold">الحالة</th>
                  </tr>
                </thead>

                <tbody>
                  {estimate.students.map((s, i) => (
                    <tr
                      key={s.studentId}
                      className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
                      style={s.defaulter ? { background: "rgba(253,164,175,0.05)" } : undefined}
                    >
                      <td className="px-3 py-2.5 text-center text-white/40">{i + 1}</td>
                      <td className="px-4 py-2.5 font-bold">
                        {s.lastName} {s.firstName}
                      </td>
                      <td className="px-3 py-2.5 text-center font-black" style={{ color: "#86efac" }}>
                        {s.present || ""}
                      </td>
                      <td className="px-3 py-2.5 text-center font-bold text-rose-300/80">
                        {s.absent || ""}
                      </td>
                      <td className="px-3 py-2.5 text-center text-white/30">{s.blank || ""}</td>
                      <td className="px-3 py-2.5 text-center text-white/70">
                        {s.invoice ? money(s.invoice.total, currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center text-white/70">
                        {s.invoice ? money(s.invoice.paid, currency) : "—"}
                      </td>
                      <td
                        className="px-3 py-2.5 text-center font-black"
                        style={{ color: s.defaulter ? "#fda4af" : "#86efac" }}
                      >
                        {s.invoice ? money(s.invoice.remaining, currency) : "—"}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <StatusBadge student={s} />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="border-t border-white/15 bg-white/[0.03] text-xs">
                    <td colSpan={5} className="px-4 py-3 text-end font-bold text-white/60">
                      المجاميع
                    </td>
                    <td className="px-3 py-3 text-center font-black">{money(t!.grossTuition, currency)}</td>
                    <td className="px-3 py-3 text-center font-black text-emerald-300">{money(t!.collected, currency)}</td>
                    <td className="px-3 py-3 text-center font-black text-rose-300">{money(t!.remaining, currency)}</td>
                    <td className="px-3 py-3 text-center text-white/50">{t!.defaulters} مخلَّف</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        )}
      </div>

      {previewing && estimate && (
        <SheetPreview
          title="الكشف التقديري للحصص"
          subtitle={`${estimate.header.subject.name} · ${estimate.header.level.name} · ${estimate.header.studyGroup.name} · كشف ${estimate.header.sheet.number}`}
          warning={printWarning}
          onClose={() => setPreviewing(false)}
        >
          <EstimatePrint
            schoolName={schoolName}
            estimate={estimate}
            currency={currency}
            logo={logo}
          />
        </SheetPreview>
      )}
    </div>
  );
}

// --------------------------------------------------
// الجدول بالمجموعات
//
// السؤال الذي لا يجيب عنه الجدولُ بالحصص: **كم طالباً أكمل الشهر؟**
// وهو السؤال الذي تُراجَع به الورقة اليدوية — تكتب «5 طلبة × 8 حصص ×
// 187.5 = 7500» فيُصدَّق المبلغ بضربةٍ واحدة على الآلة، بينما تصديقُه
// من ثمانية أسطرٍ يحتاج جمعَها كلِّها.
//
// والمجموع واحدٌ في الجدولين لأنّ الوحدات واحدة:
// Σ (المحتسبون في كل حصة) = Σ (حصصُ كل محتسب).
// --------------------------------------------------

function BucketTable({
  buckets,
  sessionRate,
  countedUnits,
  currency,
}: {
  buckets: BucketSummary;
  sessionRate: number;
  countedUnits: number;
  currency: string;
}) {
  const showTeacher = buckets.teacherTotal !== null;

  return (
    <div className="mb-4 overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-white/10 px-5 py-3.5">
        <span className="text-xs font-bold text-white/60">
          المجموعات — نفس المبلغ مرتَّباً بالطالب لا بالحصة
        </span>
        <span className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-white/35">
          {/* أساسُ العدّ مكتوبٌ في ترويسة الجدول الأعلى — لا يُكرَّر */}
          <span>
            القاعدة:{" "}
            <span className="font-bold text-white/60">
              سعر الحصة × عدد الحصص التي حضرها × عدد المحتسبين
            </span>
          </span>
        </span>
      </div>

      {/*
        الاختلافُ يُعلَن. يقع حين يحضر تسجيلٌ مؤرشفٌ حصةً: الخادم يعدّ
        حضورَه في المجموع ولا يُدرجه في قائمة الطلبة، فيَنقص جدولُ
        المجموعات عن جدول الحصص. وإخفاءُ التعارض في ورقةٍ مالية أسوأ من
        إعلانه.
      */}
      {buckets.inconsistent && (
        <p className="flex items-start gap-2 border-b border-amber-400/20 bg-amber-500/[0.07] px-5 py-2.5 text-[11px] leading-relaxed text-amber-200/85">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          مجموع وحدات المجموعات {buckets.countedUnits} ولا يساوي {countedUnits} في
          جدول الحصص — حضورُ تسجيلٍ لم يظهر في قائمة الطلبة (مؤرشفٌ أو غير
          نشط). المبلغ المعتمد هو مبلغ جدول الحصص.
        </p>
      )}

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/10 bg-white/[0.02] text-[11px] text-white/45">
            <th style={{ width: "16%" }} className={`${headCell} border-e`}>
              <Head title="عدد الحصص" gloss="ما حضره كلُّ طالبٍ في المجموعة" />
            </th>
            <th style={{ width: "18%" }} className={`${headCell} border-e`}>
              <Head title="المحتسبون" gloss="طلبةٌ حضروا هذا العدد وسدّدوا" />
            </th>
            <th style={{ width: "18%" }} className={`${headCell} border-e`}>
              <Head title="الوحدات" gloss="عدد الحصص × المحتسبون" />
            </th>
            <th
              style={{ width: showTeacher ? "24%" : "48%" }}
              className={`${headCell} border-e !text-end px-5`}
            >
              <Head title="قيمة المؤسسة" gloss="الوحدات × سعر الحصة" end />
            </th>
            {showTeacher && (
              <th style={{ width: "24%" }} className={`${headCell} !text-end px-5`}>
                <Head title="نصيب الأستاذ" gloss="الوحدات × قيمة الوحدة" end />
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {buckets.buckets.map((bucket) => (
            <tr
              key={bucket.sessions}
              className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]"
            >
              <td
                className={`${bodyCell} border-e text-center font-black`}
                style={{ color: ACCENT }}
              >
                <span dir="ltr" className="tabular-nums">{bucket.sessions}</span>
              </td>
              <td className={`${bodyCell} border-e text-center font-black`}>
                <span dir="ltr" className="tabular-nums">{bucket.students}</span>
              </td>
              <td className={`${bodyCell} border-e text-center text-white/55`}>
                {/* الضربُ مكتوبٌ لا مُخفىً — منه يُصدَّق الصفّ بلا حساب */}
                <span dir="ltr" className="tabular-nums">
                  {bucket.sessions} × {bucket.students} = {bucket.units}
                </span>
              </td>
              <td className={`${bodyCell} border-e px-5 text-end font-bold text-white/70`}>
                <span dir="ltr" className="tabular-nums">
                  {money(bucket.institutionAmount, currency)}
                </span>
              </td>
              {showTeacher && (
                <td className={`${bodyCell} px-5 text-end font-bold`}>
                  <span dir="ltr" className="tabular-nums">
                    {money(bucket.teacherAmount!, currency)}
                  </span>
                </td>
              )}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr className="border-t border-white/15 bg-white/[0.04]">
            <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
              {buckets.buckets.length} مجموعات
            </td>
            <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
              {buckets.countedStudents} محتسباً
            </td>
            <td className="border-e border-white/10 px-4 py-3.5 text-center text-[11px] text-white/40">
              {buckets.countedUnits} وحدة
            </td>
            <td className="border-e border-white/10 px-5 py-3.5 text-end font-bold text-white/60">
              <span dir="ltr" className="tabular-nums">
                {money(buckets.institutionTotal, currency)}
              </span>
              <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                حقُّ المؤسسة — سعر الحصة {sessionRate}
              </span>
            </td>
            {showTeacher && (
              <td
                className="px-5 py-3.5 text-end text-base font-black"
                style={{ color: ACCENT }}
              >
                <span dir="ltr" className="tabular-nums">
                  {money(buckets.teacherTotal!, currency)}
                </span>
                <span className="mt-0.5 block text-[10px] font-normal text-white/30">
                  مستحقّ الأستاذ — قيمة الوحدة {buckets.unitRate}
                </span>
              </td>
            )}
          </tr>
        </tfoot>
      </table>

      {/*
        الطرائق المسطَّحة لا نصيبَ فيها لمجموعة. المستحقُّ فيها مبلغٌ
        شهريٌّ لا يُشتقّ من الحضور، فقيمةُ المجموعة على المؤسسة تبقى
        صحيحة وحصّةُ الأستاذ منها لا معنى لها — فتُترك ولا تُختلق.
      */}
      {!showTeacher && (
        <p className="border-t border-white/10 px-5 py-2.5 text-[11px] leading-relaxed text-white/35">
          مستحقّ الأستاذ في هذه السياسة لا يُشتقّ من الحضور، فلا نصيبَ
          لمجموعةٍ منه. والعمود المعروض قيمةُ الحصص على الطلبة وحدها.
        </p>
      )}
    </div>
  );
}

// --------------------------------------------------
// الورقة المطبوعة
//
// جدولان لا واحد: التقدير المالي أولاً — وهو ما يُوقَّع عليه الأستاذ —
// ثم قائمة المخلَّفين وحدهم. ومَن دفع لا يُطبع اسمه في القائمة الثانية:
// الورقة تُحمل إلى مَن عليه دَين لا إلى مَن سدَّد.
// --------------------------------------------------

function EstimatePrint({
  schoolName,
  estimate,
  currency,
  logo,
}: {
  schoolName: string;
  estimate: Estimate;
  currency: string;
  logo: LogoSpec;
}) {
  const printedOn = new Date().toLocaleDateString("fr-DZ");
  const logoWidth = Math.max(24, Math.round(logo.widthMm * 1.4));
  const t = estimate.totals;
  const defaulters = estimate.students.filter((s) => s.defaulter || s.uninvoiced);

  /* دالّةٌ خالصة — تُعيد الحساب هنا فتخرج بعينِ ما تراه الشاشة */
  const buckets = bucketByAttendance(estimate);

  return (
    <div className="sheet-print" dir="rtl">
      <section className="sheet-page">
        <header className="sheet-print-top">
          <div className="sheet-print-side">
            <span>المستوى : {estimate.header.level.name}</span>
            <span>الفوج : {estimate.header.studyGroup.name}</span>
            <span className="sheet-print-printed">حُرِّر في {printedOn}</span>
          </div>

          <div className="sheet-print-center">
            {logo.src && (
              <img src={logo.src} alt="" className="sheet-print-logo" style={{ width: `${logoWidth}mm`, filter: logo.filter }} />
            )}
            <h1>{schoolName}</h1>
            <h2>الكشف التقديري للحصص</h2>
          </div>

          <div className="sheet-print-side sheet-print-side-end">
            <span>المادة : {estimate.header.subject.name}</span>
            <span>الأستاذ : {fullName(estimate.header.teacher)}</span>
            <span>الكشف : {estimate.header.sheet.number}</span>
          </div>
        </header>

        <table className="sheet-print-table">
          <thead>
            <tr>
              <th style={{ width: "9%" }}>
                الحصة<PrintGloss text="ترتيبها في الكشف" />
              </th>
              <th style={{ width: "17%" }}>
                التاريخ<PrintGloss text="يوم إجرائها" />
              </th>
              <th style={{ width: "17%" }}>
                المحتسبون<PrintGloss text="حضروا وسدّدوا" />
              </th>
              <th style={{ width: "15%" }}>
                الحاضرون<PrintGloss text="حضروا أو تأخّروا" />
              </th>
              <th style={{ width: "18%" }}>
                قيمة الوحدة<PrintGloss text="نصيب الأستاذ من حضورٍ واحد" />
              </th>
              <th style={{ width: "24%" }}>
                المجموع<PrintGloss text="المحتسبون × قيمة الوحدة" />
              </th>
            </tr>
          </thead>
          <tbody>
            {estimate.rows.map((r) => (
              <tr key={r.lessonNumber}>
                <td className="c">{r.order}</td>
                <td className="c">{feeDate(r.sessionDate)}</td>
                <td className="c b">{r.countedStudents}</td>
                <td className="c">{r.presentStudents}</td>
                <td className="c">{r.rate}</td>
                <td className="c b">{money(r.lineTotal, currency)}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={5} style={{ textAlign: "end", fontWeight: 700 }}>
                مستحقّ الأستاذ
              </td>
              <td className="c b">{money(t.teacherAmount, currency)}</td>
            </tr>
          </tbody>
        </table>

        {/*
            الجدول الثاني — نفسُ المبلغ مرتَّباً بالطالب.
            وهو الذي يُصدَّق بضربةٍ واحدة على الآلة: «5 × 8 × 187.5»،
            فيراجعه الأستاذُ قبل أن يُمضي بلا أن يجمع ثمانية أسطر.
        */}
        {buckets.buckets.length > 0 && (
          <>
            <h3 style={{ margin: "5mm 0 2mm", fontSize: "11pt" }}>
              المجموعات — بعدد الحصص التي حضرها الطالب
            </h3>

            <table className="sheet-print-table">
              <thead>
                <tr>
                  <th style={{ width: "16%" }}>
                    عدد الحصص<PrintGloss text="ما حضره كلُّ طالبٍ في المجموعة" />
                  </th>
                  <th style={{ width: "16%" }}>
                    المحتسبون<PrintGloss text="حضروا هذا العدد وسدّدوا" />
                  </th>
                  <th style={{ width: "22%" }}>
                    الوحدات<PrintGloss text="عدد الحصص × المحتسبون" />
                  </th>
                  <th style={{ width: "23%" }}>
                    قيمة المؤسسة<PrintGloss text="الوحدات × سعر الحصة" />
                  </th>
                  <th style={{ width: "23%" }}>
                    نصيب الأستاذ<PrintGloss text="الوحدات × قيمة الوحدة" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {buckets.buckets.map((bucket) => (
                  <tr key={bucket.sessions}>
                    <td className="c b">{bucket.sessions}</td>
                    <td className="c b">{bucket.students}</td>
                    <td className="c">
                      {bucket.sessions} × {bucket.students} = {bucket.units}
                    </td>
                    <td className="c">{money(bucket.institutionAmount, currency)}</td>
                    <td className="c b">
                      {bucket.teacherAmount === null
                        ? "—"
                        : money(bucket.teacherAmount, currency)}
                    </td>
                  </tr>
                ))}
                <tr>
                  <td className="c b">{buckets.countedStudents}</td>
                  <td className="c" style={{ fontSize: "8pt" }}>
                    محتسباً
                  </td>
                  <td className="c b">{buckets.countedUnits} وحدة</td>
                  <td className="c b">{money(buckets.institutionTotal, currency)}</td>
                  <td className="c b">
                    {buckets.teacherTotal === null
                      ? "—"
                      : money(buckets.teacherTotal, currency)}
                  </td>
                </tr>
              </tbody>
            </table>
          </>
        )}

        <p style={{ margin: "4mm 0 2mm", fontSize: "9pt", lineHeight: 1.7 }}>
          الطريقة: {METHOD_LABEL[estimate.policy.method]} ({policyValue(estimate.policy)}) ·
          أساس العدّ: {BASIS_LABEL[estimate.policy.countBasis]} ·
          الحقّ الشهري: {money(estimate.tuition, currency)} ·
          الحصص المنجزة: {t.completedSessions} من {t.approvedSessions}
          <br />
          {/* السطر الذي يُغني عن السؤال: من أين جاء المبلغ */}
          الوحدات المحتسبة: {t.countedUnits} من {t.attendedUnits} حضوراً ·
          قيمة الوحدة × الوحدات المحتسبة = {money(t.teacherAmount, currency)}
        </p>

        {defaulters.length > 0 && (
          <>
            <h3 style={{ margin: "5mm 0 2mm", fontSize: "11pt" }}>
              المخلَّفون — دَينٌ باقٍ ({defaulters.length})
            </h3>

            <table className="sheet-print-table">
              <thead>
                <tr>
                  <th style={{ width: "8%" }}>الترتيب</th>
                  <th style={{ width: "34%" }}>اللقب والاسم</th>
                  <th style={{ width: "16%" }}>هاتف الوليّ</th>
                  <th style={{ width: "14%" }}>
                    حضر<PrintGloss text="عدد الحصص التي حضرها" />
                  </th>
                  <th style={{ width: "14%" }}>
                    الدَّين<PrintGloss text="ما بقي عليه من حقّ الشهر" />
                  </th>
                  <th style={{ width: "14%" }}>الإمضاء</th>
                </tr>
              </thead>
              <tbody>
                {defaulters.map((s, i) => (
                  <tr key={s.studentId}>
                    <td className="c">{i + 1}</td>
                    <td>{s.lastName} {s.firstName}</td>
                    <td className="c">{s.parentPhone}</td>
                    <td className="c">{s.present}</td>
                    <td className="c b">
                      {s.invoice ? money(s.invoice.remaining, currency) : "بلا فاتورة"}
                    </td>
                    <td />
                  </tr>
                ))}
                <tr>
                  <td colSpan={4} style={{ textAlign: "end", fontWeight: 700 }}>
                    مجموع الديون
                  </td>
                  <td className="c b">{money(t.remaining, currency)}</td>
                  <td />
                </tr>
              </tbody>
            </table>
          </>
        )}

        <footer className="sheet-print-foot">
          إمضاء الأستاذ ................... &nbsp;&nbsp; إمضاء الإدارة ...................
        </footer>
      </section>
    </div>
  );
}

// --------------------------------------------------

function StatusBadge({ student }: { student: Estimate["students"][number] }) {
  const tone = student.uninvoiced
    ? { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d", label: "بلا فاتورة" }
    : student.defaulter
      ? student.invoice!.paid > 0
        ? { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d", label: "جزئي" }
        : { bg: "rgba(253,164,175,0.14)", fg: "#fda4af", label: "مخلَّف" }
      : { bg: "rgba(134,239,172,0.14)", fg: "#86efac", label: "مثبَّت الدفع" };

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
      style={{ background: tone.bg, color: tone.fg }}
    >
      {!student.defaulter && !student.uninvoiced && <CircleCheckBig className="h-3 w-3" />}
      {tone.label}
    </span>
  );
}

/**
 * ترويسةُ عمودٍ بشرحها تحتها.
 *
 * أسماءُ الأعمدة في هذا الكشف اصطلاحاتٌ لا كلماتٌ عامّة: «المحتسبون»
 * غيرُ «الحاضرون»، و«غير محصَّل» يُقوَّم بسعرٍ غير الذي فوقه. ومن قرأ
 * الاسم وحده خمَّن معناه — وتخمينُه في ورقةٍ مالية يُنتج قراءةً خاطئة
 * لا سؤالاً. فالشرح مكتوبٌ في الورقة نفسها لا في ذاكرة من ملأها.
 */
/** الشرح في الورقة المطبوعة — سطرٌ ثانٍ أصغر داخل الترويسة */
function PrintGloss({ text }: { text: string }) {
  return (
    <span style={{ display: "block", fontWeight: 400, fontSize: "6.5pt", marginTop: "0.4mm" }}>
      ({text})
    </span>
  );
}

function Head({
  title,
  gloss,
  end,
}: {
  title: string;
  gloss: string;
  end?: boolean;
}) {
  return (
    <span className={`block leading-tight ${end ? "text-end" : "text-center"}`}>
      <span className="block">{title}</span>
      <span className="mt-0.5 block text-[9.5px] font-normal text-white/25">({gloss})</span>
    </span>
  );
}

const selectClass =
  "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none transition focus:border-white/30";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold text-white/45">{label}</span>
      {children}
    </label>
  );
}

function Picker({
  value, onChange, items, all,
}: {
  value: string;
  onChange: (v: string) => void;
  items: { id: string; name: string }[];
  all: string;
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
      <option value="" className="bg-[#0a0f1a]">{all}</option>
      {items.map((i) => (
        <option key={i.id} value={i.id} className="bg-[#0a0f1a]">{i.name}</option>
      ))}
    </select>
  );
}

function Meta({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[11px] text-white/40">{label}:</span>
      <span className={strong ? "font-black" : "font-bold text-white/85"}>{value || "—"}</span>
    </span>
  );
}

function Stat({
  label, value, tone, strong,
}: {
  label: string;
  value: string;
  tone: string;
  strong?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3">
      <span className="mb-1 block text-[11px] text-white/40">{label}</span>
      <span className={`block font-black ${strong ? "text-xl" : "text-base"}`} style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] px-6 py-20 text-center">
      <ClipboardList className="mb-3 h-11 w-11 text-white/15" />
      <p className="text-white/60">{title}</p>
      <p className="mt-1.5 max-w-md text-xs text-white/35">{hint}</p>
    </div>
  );
}

