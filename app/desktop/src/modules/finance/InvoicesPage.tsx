import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  Check,
  ChevronDown,
  ChevronLeft,
  FolderOpen,
  GraduationCap,
  Layers,
  Loader2,
  Printer,
  Receipt,
  Search,
  Sparkles,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { PrintPreview } from "../../components/print/PrintPreview";
import { FormDialog, FormGrid, FormRow } from "../../components/shared/FormDialog";
import {
  groupLabel,
  useAcademicYears,
  useStudyGroups,
  type GroupOption,
} from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { InvoiceDoc } from "./PrintDocs";
import {
  cancelInvoice,
  generateInvoices,
  getInvoice,
  listInvoices,
  money,
  INVOICE_TONE,
  MONTHS,
  type Invoice,
  type InvoiceStatus,
  type Pagination,
} from "./finance.api";

const ACCENT = "#ff8fb1";
const PAGE_SIZE = 15;

export default function InvoicesPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");

  const years = useAcademicYears();
  const groups = useStudyGroups();

  const [rows, setRows] = useState<Invoice[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState<InvoiceStatus | "">("");
  const [overdue, setOverdue] = useState(false);
  const [yearId, setYearId] = useState("");
  const [page, setPage] = useState(1);

  const [genOpen, setGenOpen] = useState(false);
  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [confirming, setConfirming] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, status, overdue, yearId]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(status && { status }),
      ...(overdue && { overdue: true }),
      ...(yearId && { academicYearId: yearId }),
    }),
    [page, debounced, status, overdue, yearId],
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listInvoices(query);
      setRows(r.invoices);
      setPagination(r.pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب الفواتير");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const doCancel = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await cancelInvoice(confirming.id);
      setConfirming(null);
      await fetchRows();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الإلغاء");
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  /* الطباعة تحتاج الفاتورة بتفصيلها الكامل — القائمة لا تحمل الدفعات */
  const openPrint = async (row: Invoice) => {
    try {
      setPrinting(await getInvoice(row.id));
    } catch {
      setPrinting(row);
    }
  };

  /**
   * الفواتير مجمَّعةً بـ(الشهر · المادة · الفوج) — وهي وحدةُ العمل.
   *
   * الفوترة تجري لفوجٍ في مادةٍ في شهر، فالقائمة المسطَّحة تُخفي ذلك:
   * مركزٌ بعشر موادّ وثلاثين فوجاً يُخرج مئات السطور المتشابهة، فلا
   * يُعرف أين انتهى فوجٌ وبدأ آخر ولا كم بقي على كلٍّ منها.
   *
   * والمجاميع في رأس كل مجموعة لا في أسفل الصفحة: من يسأل «كم على فوج
   * الإنجليزية؟» يجد الجواب في سطرٍ واحد بلا جمعٍ يدويّ.
   */
  const buckets = useMemo(() => {
    const map = new Map<
      string,
      {
        key: string;
        month: number;
        year: number;
        subject: string;
        studyGroup: string;
        /** الطور والمستوى — موضعُ الفوج في السلّم الدراسي */
        stage: string;
        level: string;
        /** الأستاذ المسؤول — من الإسناد نفسه لا من حقلٍ مكرَّر */
        teacher: string;
        /** رقم الكشف — فارغٌ حين لم يُحدَّد بلا لبس */
        sheet: { number: number; label: string | null } | null;
        rows: typeof rows;
        total: number;
        remaining: number;
      }
    >();

    for (const inv of rows) {
      const ta = inv.studentEnrollment.teachingAssignment;
      /* الكشف جزءٌ من المفتاح: كشفان في شهرٍ واحد مجموعتان لا واحدة */
      const key = `${inv.year}-${inv.month}|${ta.subject.id}|${ta.studyGroup.id}|${inv.attendanceSheet?.id ?? "-"}`;

      let entry = map.get(key);

      if (!entry) {
        entry = {
          key,
          month: inv.month,
          year: inv.year,
          subject: ta.subject.name,
          studyGroup: ta.studyGroup.name,
          stage: ta.studyGroup.level.educationStage.name,
          level: ta.studyGroup.level.name,
          teacher: `${ta.teacher.lastName} ${ta.teacher.firstName}`.trim(),
          sheet: inv.attendanceSheet
            ? { number: inv.attendanceSheet.number, label: inv.attendanceSheet.label }
            : null,
          rows: [],
          total: 0,
          remaining: 0,
        };
        map.set(key, entry);
      }

      entry.rows.push(inv);

      if (inv.status !== "CANCELLED") {
        entry.total += inv.total;
        entry.remaining += inv.remaining;
      }
    }

    // الأحدث أوّلاً، ثمّ المادة فالفوج
    return [...map.values()].sort(
      (a, b) =>
        b.year - a.year ||
        b.month - a.month ||
        a.subject.localeCompare(b.subject, "ar") ||
        a.studyGroup.localeCompare(b.studyGroup, "ar"),
    );
  }, [rows]);

  /**
   * المطويّة صراحةً — والباقي مفتوح.
   *
   * الفتحُ افتراضاً لأنّ الغالب مجموعةٌ أو مجموعتان بعد الفوترة، وطيُّ
   * الكلّ يُخفي ما جاء المستخدم لأجله. ومن كثرت عنده يطوي ما لا يريد.
   */
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggle = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const totals = rows.reduce(
    (a, i) => {
      if (i.status !== "CANCELLED") {
        a.total += i.total;
        a.remaining += i.remaining;
      }
      return a;
    },
    { total: 0, remaining: 0 },
  );

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="الفواتير" subtitle="التوليد الشهري والتحصيل">
        <button
          onClick={() => exitTo(PATHS.finance)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-350 p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <div className="relative min-w-60 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الفاتورة…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 outline-none transition focus:border-white/30"
            />
          </div>

          <select
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
            className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none"
          >
            <option value="" className="bg-[#0a0f1a]">السنة: الكل</option>
            {(years.data ?? []).map((y) => (
              <option key={y.id} value={y.id} className="bg-[#0a0f1a]">{y.name}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {([
              { v: "", label: "الكل" },
              { v: "PENDING", label: "معلّقة" },
              { v: "PARTIAL", label: "جزئية" },
              { v: "PAID", label: "مسدَّدة" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => { setStatus(o.v as InvoiceStatus | ""); setOverdue(false); }}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={status === o.v && !overdue ? { background: `${ACCENT}22`, color: ACCENT } : { color: "rgba(255,255,255,0.5)" }}
              >
                {o.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setOverdue((v) => !v); setStatus(""); }}
            className="flex items-center gap-1.5 rounded-xl border px-3 py-2.5 text-xs font-bold transition"
            style={overdue
              ? { borderColor: "rgba(252,211,77,0.5)", background: "rgba(252,211,77,0.12)", color: "#fcd34d" }
              : { borderColor: "rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            المتأخرة
          </button>

          {can("invoice.create") && (
            <button
              onClick={() => setGenOpen(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-black text-[#1a0410] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <Sparkles className="h-4.5 w-4.5" />
              توليد فواتير الشهر
            </button>
          )}
        </motion.div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        {rows.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-3">
            <Stat label="إجمالي الصفحة" value={money(totals.total, currency)} />
            <Stat label="المتبقّي" value={money(totals.remaining, currency)} tone="#fcd34d" />
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            {/*
              لا ترويسةَ أعلى الجدول.
              كانت تصفّ «الرقم · الطالب · المادة…» فوق **رأس مجموعة** لا
              فوق فواتير، فتصف أعمدةً لا يملؤها الصفُّ الذي تحتها. ومحلُّها
              الطبيعيّ داخل كل مجموعة، ملتصقةً بالسطور التي تشرحها.
            */}
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-16 text-center text-white/40"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <Receipt className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    {/* الرسالة تتبع الفلتر: «لا نتائج» غير «لا فواتير بعد» */}
                    <p className="text-white/50">
                      {debounced || status || overdue || yearId
                        ? "لا فاتورة تطابق هذه التصفية"
                        : "لا فواتير — ابدأ بتوليد فواتير الشهر"}
                    </p>
                  </td>
                </tr>
              ) : (
                buckets.flatMap((group) => {
                  const shut = collapsed.has(group.key);

                  const header = (
                    <tr
                      key={group.key}
                      onClick={() => toggle(group.key)}
                      className="cursor-pointer border-b border-white/10 bg-white/[0.04] transition hover:bg-white/[0.07]"
                    >
                      {/*
                        سطران لا سطر: الأوّل هويّةُ الفوج، والثاني موضعُه
                        ومسؤولُه. وحشرُ ستّ معلومات في سطرٍ واحد يجعلها
                        كلَّها بحجمٍ واحد فلا تُقرأ أولاها من آخرها.
                      */}
                      <td colSpan={4} className="px-4 py-3">
                        <div className="flex items-start gap-2.5">
                          {shut ? (
                            <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                          ) : (
                            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-white/40" />
                          )}
                          <FolderOpen className="mt-0.5 h-4 w-4 shrink-0" style={{ color: ACCENT }} />

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                              <span className="text-[15px] font-black">{group.subject}</span>
                              <span className="text-white/25">·</span>
                              <span className="font-bold text-white/75">{group.studyGroup}</span>

                              {/* الكشف قبل الشهر: هو وحدةُ العمل، والشهر ظرفُه */}
                              {group.sheet && (
                                <span
                                  className="rounded-full px-2.5 py-0.5 text-[11px] font-black"
                                  style={{ background: `${ACCENT}22`, color: ACCENT }}
                                >
                                  {group.sheet.label?.trim() || `الكشف ${group.sheet.number}`}
                                </span>
                              )}
                              <span className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] font-bold text-white/60">
                                {MONTHS[group.month - 1]} {group.year}
                              </span>
                            </div>

                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-white/40">
                              <span className="flex items-center gap-1.5">
                                <Layers className="h-3.5 w-3.5" />
                                {group.stage}
                                <span className="text-white/20">›</span>
                                <span className="text-white/60">{group.level}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <GraduationCap className="h-3.5 w-3.5" />
                                <span className="text-white/60">{group.teacher}</span>
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Receipt className="h-3.5 w-3.5" />
                                {group.rows.length} فاتورة
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <span className="block text-[10px] text-white/35">الإجمالي</span>
                        <span className="font-bold text-white/80">{money(group.total, currency)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="block text-[10px] text-white/35">المتبقّي</span>
                        <span
                          className="font-black"
                          style={{ color: group.remaining > 0 ? "#fcd34d" : "#86efac" }}
                        >
                          {group.remaining > 0 ? money(group.remaining, currency) : "خالص"}
                        </span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  );

                  if (shut) return [header];

                  /* أسماءُ الأعمدة داخل المجموعة — فوق السطور التي تشرحها */
                  const labels = (
                    <tr
                      key={`${group.key}:labels`}
                      className="border-b border-white/10 bg-black/25 text-[11px] text-white/35"
                    >
                      <th className="px-4 py-2 text-start font-bold">الرقم</th>
                      <th className="px-4 py-2 text-start font-bold">الطالب</th>
                      <th className="px-4 py-2 text-start font-bold">المادة</th>
                      <th className="px-4 py-2 text-start font-bold">الشهر</th>
                      <th className="px-4 py-2 text-start font-bold">الإجمالي</th>
                      <th className="px-4 py-2 text-start font-bold">المتبقّي</th>
                      <th className="px-4 py-2 text-center font-bold">الحالة</th>
                      <th className="px-4 py-2" />
                    </tr>
                  );

                  return [
                    header,
                    labels,
                    ...group.rows.map((inv) => {
                      const tone = INVOICE_TONE[inv.status];
                      const st = inv.studentEnrollment;
                      return (
                    <tr key={inv.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                      <td className="px-4 py-3 text-white/60" dir="ltr">{inv.invoiceNumber}</td>
                      <td className="px-4 py-3 font-bold">{st.student.firstName} {st.student.lastName}</td>
                      <td className="px-4 py-3 text-white/70">{st.teachingAssignment.subject.name}</td>
                      <td className="px-4 py-3 text-white/60" dir="ltr">
                        {String(inv.month).padStart(2, "0")}/{inv.year}
                      </td>
                      <td className="px-4 py-3">{money(inv.total, currency)}</td>
                      <td className="px-4 py-3 font-bold">
                        {inv.remaining > 0 ? money(inv.remaining, currency) : "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ background: tone.bg, color: tone.fg }}>
                          {tone.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="طباعة الفاتورة"
                            onClick={() => openPrint(inv)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/15"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {can("invoice.cancel") && inv.status !== "CANCELLED" && (
                            <button
                              title="إلغاء الفاتورة"
                              onClick={() => setConfirming(inv)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                      );
                    }),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>{pagination.total} فاتورة · صفحة {pagination.page} من {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30">السابق</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30">التالي</button>
            </div>
          </div>
        )}
      </div>

      {genOpen && (
        <GenerateDialog
          years={years.data ?? []}
          groups={groups.data ?? []}
          onClose={() => setGenOpen(false)}
          onDone={() => { setGenOpen(false); fetchRows(); }}
        />
      )}

      {printing && (
        <PrintPreview
          doc={{
            title: `فاتورة رقم ${printing.invoiceNumber}`,
            render: () => <InvoiceDoc invoice={printing} />,
          }}
          onClose={() => setPrinting(null)}
        />
      )}

      {confirming && (
        <>
          <div onClick={() => setConfirming(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-105 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">إلغاء الفاتورة</h3>
            <p className="mb-5 text-sm text-white/60">
              ستُلغى <span className="font-bold text-white" dir="ltr">{confirming.invoiceNumber}</span>.
              الفاتورة لا تُحذف — تبقى في السجل بحالة «ملغاة».
            </p>
            <div className="flex gap-3">
              <button onClick={doCancel} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                إلغاء الفاتورة
              </button>
              <button onClick={() => setConfirming(null)} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/20">تراجع</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
      <div className="text-[11px] text-white/40">{label}</div>
      <div className="font-black" style={{ color: tone }}>{value}</div>
    </div>
  );
}

// --------------------------------------------------
// توليد فواتير الشهر
// --------------------------------------------------

function GenerateDialog({
  years, groups, onClose, onDone,
}: {
  years: { id: string; name: string }[];
  groups: GroupOption[];
  onClose: () => void;
  onDone: () => void;
}) {
  const now = new Date();

  const [yearId, setYearId] = useState(years[0]?.id ?? "");
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [dueDate, setDueDate] = useState("");
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof generateInvoices>> | null>(null);

  const run = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      setResult(await generateInvoices({
        academicYearId: yearId,
        month, year,
        ...(dueDate && { dueDate }),
        ...(groupIds.length > 0 && { studyGroupIds: groupIds }),
      }));
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر التوليد");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog
      icon={Sparkles}
      title="توليد فواتير الشهر"
      subtitle="تُنشأ فاتورة لكل تسجيل نشط بسعر حقّ الاشتراك الساري. الموجود مسبقاً يُتخطّى، فإعادة التشغيل آمنة."
      tone={ACCENT}
      width="md"
      /* بعد التوليد لا رجعة: الإغلاق يُنعش القائمة كي تظهر الفواتير الجديدة */
      onClose={result ? onDone : onClose}
      onSubmit={result ? (e) => { e.preventDefault(); onDone(); } : run}
      busy={busy}
      submitDisabled={!result && !yearId}
      submitLabel={result ? "تمّ" : "توليد"}
      submitIcon={result ? <Check className="h-4.5 w-4.5" /> : <Sparkles className="h-4.5 w-4.5" />}
      error={result ? null : error}
    >
        {!result ? (
          <>
            <FormGrid>
              <FormRow wide>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-white/60">السنة الدراسية</span>
                  <select value={yearId} onChange={(e) => setYearId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none">
                    <option value="" className="bg-[#0a0f1a]">— اختر —</option>
                    {years.map((y) => <option key={y.id} value={y.id} className="bg-[#0a0f1a]">{y.name}</option>)}
                  </select>
                </label>
              </FormRow>

              <FormRow>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-white/60">الشهر</span>
                  <select value={month} onChange={(e) => setMonth(Number(e.target.value))}
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none">
                    {MONTHS.map((m, i) => <option key={m} value={i + 1} className="bg-[#0a0f1a]">{m}</option>)}
                  </select>
                </label>
              </FormRow>

              <FormRow>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-white/60">السنة</span>
                  <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value))} dir="ltr"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none" />
                </label>
              </FormRow>

              <FormRow wide>
                <label className="block">
                  <span className="mb-1.5 block text-xs font-bold text-white/60">تاريخ الاستحقاق</span>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} dir="ltr"
                    className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none" />
                  <span className="mt-1 block text-[11px] text-white/40">اتركه فارغاً ليكون آخر يوم في الشهر</span>
                </label>
              </FormRow>
            </FormGrid>

            <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-xs font-bold text-white/60">
                تحديد أفواج بعينها (اختياري)
              </summary>
              <div className="mt-3 max-h-40 space-y-1.5 overflow-y-auto">
                {groups.map((g) => (
                  <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={groupIds.includes(g.id)}
                      onChange={(e) =>
                        setGroupIds((prev) => e.target.checked ? [...prev, g.id] : prev.filter((x) => x !== g.id))
                      }
                      className="h-4 w-4 accent-pink-400"
                    />
                    {groupLabel(g)}
                  </label>
                ))}
              </div>
            </details>
          </>
        ) : (
          <div className="space-y-4">
            <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-3">
              <div className="text-2xl font-black text-emerald-200">{result.created}</div>
              <div className="text-xs text-white/60">فاتورة أُنشئت</div>
            </div>

            {result.skippedExisting > 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-white/60">
                {result.skippedExisting} فاتورة موجودة مسبقاً — تُخطّيت.
              </div>
            )}

            {result.skippedNoFee.length > 0 && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/[0.08] p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-bold text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  {result.skippedNoFee.length} تسجيلاً بلا حقّ اشتراك
                </div>
                <ul className="max-h-32 space-y-1 overflow-y-auto text-[11px] text-white/55">
                  {result.skippedNoFee.map((s, i) => (
                    <li key={i}>{s.student} — {s.subject} ({s.studyGroup})</li>
                  ))}
                </ul>
                <p className="mt-2 text-[11px] text-white/40">
                  اضبط سعرها في الإعدادات ← حقوق الاشتراك ثم أعد التوليد.
                </p>
              </div>
            )}
          </div>
        )}
    </FormDialog>
  );
}
