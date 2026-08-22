import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Ban,
  ChevronDown,
  ChevronLeft,
  FolderOpen,
  GraduationCap,
  Layers,
  Loader2,
  Printer,
  Receipt,
  Search,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { PrintPreview } from "../../components/print/PrintPreview";
import { BarcodeScanner } from "../../components/shared/BarcodeScanner";
import {
  FilterField,
  FilterPanel,
  FilterSelect,
  type FilterChip,
} from "../../components/shared/FilterPanel";
import {
  groupLabel,
  useAcademicYears,
  useStudyGroups,
} from "../../core/api/reference.api";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchoolStore } from "../../core/stores/school.store";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { InvoiceDoc } from "./PrintDocs";
import {
  cancelInvoice,
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

/**
 * الحالات — و«المتأخرة» بينها لا زرّاً مستقلاً إلى جانبها.
 *
 * كانت خارج المجموعة فبدت شرطاً يُضاف إلى الحالة، وليست كذلك: الخادم
 * يرشّح بـ`overdue` أو بـ`status` لا بهما معاً، وكان كلٌّ منهما يُفرغ
 * الآخر عند الضغط بلا ما يدلّ عليه. فصارت الخيارَ الخامس في الصفّ —
 * ومن الصفّ وحده يُقرأ أنّ الواحد يُبطل ما قبله.
 */
const STATES = [
  { key: "", label: "الكل" },
  { key: "PENDING", label: "معلّقة" },
  { key: "PARTIAL", label: "جزئية" },
  { key: "PAID", label: "مسدَّدة" },
  { key: "OVERDUE", label: "المتأخرة" },
] as const;

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
  /** الفوجُ والشهر — يرشّحهما الخادم أصلاً ولم تكن الشاشة تعرضهما */
  const [groupId, setGroupId] = useState("");
  const [month, setMonth] = useState("");
  const [page, setPage] = useState(1);

  const [printing, setPrinting] = useState<Invoice | null>(null);
  const [confirming, setConfirming] = useState<Invoice | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, status, overdue, yearId, groupId, month]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(status && { status }),
      ...(overdue && { overdue: true }),
      ...(yearId && { academicYearId: yearId }),
      ...(groupId && { studyGroupId: groupId }),
      ...(month && { month: Number(month) }),
    }),
    [page, debounced, status, overdue, yearId, groupId, month],
  );

  /** إفراغُ المرشِّحات — ويُستعمل قبل المسح أيضاً كي لا يحجب مرشِّحٌ ما مُسح */
  const clearFilters = () => {
    setSearch("");
    setStatus("");
    setOverdue(false);
    setYearId("");
    setGroupId("");
    setMonth("");
  };

  /** ما يُقرأ حين يُطوى اللوح — إخفاءُ الحقول لا يجوز أن يُخفي ما اختير */
  const chips = useMemo(() => {
    const out: FilterChip[] = [];

    if (debounced) out.push({ label: "بحث", value: debounced });

    const year = (years.data ?? []).find((y) => y.id === yearId);
    if (year) out.push({ label: "السنة", value: year.name });

    const group = (groups.data ?? []).find((g) => g.id === groupId);
    if (group) out.push({ label: "الفوج", value: group.name });

    if (month) out.push({ label: "الشهر", value: MONTHS[Number(month) - 1] ?? month });

    const state = STATES.find((s) => s.key === (overdue ? "OVERDUE" : status));
    if (state && state.key) out.push({ label: "الحالة", value: state.label });

    return out;
  }, [debounced, yearId, groupId, month, status, overdue, years.data, groups.data]);

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
        <FilterPanel
          accent={ACCENT}
          storageKey="invoices"
          busy={loading}
          chips={chips}
          onReset={clearFilters}
          extra={
            <InvoiceScanner
              accent={ACCENT}
              onFound={(invoice) => {
                /*
                  المُفرِغُ قبل الوضع: لو بقي المرشِّح على «معلّقة» ومُسحت
                  ورقةٌ مسدَّدة لارتدّت الشاشة بـ«لا فواتير» والفاتورةُ في
                  يد الماسح — فلا يُصدَّق أنّ المسح عمل.
                */
                clearFilters();
                setSearch(invoice.invoiceNumber);
              }}
            />
          }
        >
          <FilterField label="بحث" span>
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="رقم الفاتورة أو اسم الطالب…"
                className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-3 ps-9 text-xs font-bold outline-none transition hover:bg-black/40 focus:border-white/35"
              />
            </div>
          </FilterField>

          <FilterField label="السنة الدراسية">
            <FilterSelect
              value={yearId}
              onChange={setYearId}
              placeholder="الكل"
              accent={ACCENT}
              items={(years.data ?? []).map((y) => ({ id: y.id, name: y.name }))}
            />
          </FilterField>

          <FilterField label="الفوج">
            <FilterSelect
              value={groupId}
              onChange={setGroupId}
              placeholder="الكل"
              accent={ACCENT}
              items={(groups.data ?? []).map((g) => ({ id: g.id, name: groupLabel(g) }))}
            />
          </FilterField>

          <FilterField label="الشهر">
            <FilterSelect
              value={month}
              onChange={setMonth}
              placeholder="الكل"
              accent={ACCENT}
              items={MONTHS.map((name, index) => ({ id: String(index + 1), name }))}
            />
          </FilterField>

          <FilterField label="الحالة" span>
            <div className="flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
              {STATES.map((option) => {
                const active = (overdue ? "OVERDUE" : status) === option.key;

                return (
                  <button
                    key={option.key || "all"}
                    onClick={() => {
                      setOverdue(option.key === "OVERDUE");
                      setStatus(option.key === "OVERDUE" ? "" : (option.key as InvoiceStatus | ""));
                    }}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition"
                    style={
                      active
                        ? { background: `${ACCENT}22`, color: ACCENT }
                        : { color: "rgba(255,255,255,0.5)" }
                    }
                  >
                    {option.key === "OVERDUE" && <AlertTriangle className="h-3.5 w-3.5" />}
                    {option.label}
                  </button>
                );
              })}
            </div>
          </FilterField>
        </FilterPanel>

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
                      {chips.length > 0
                        ? "لا فاتورة تطابق هذه التصفية"
                        : "لا فواتير بعد — تُولَّد من كشف دفع الحقوق الشهري"}
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
// مسحُ باركود الفاتورة المطبوعة
// --------------------------------------------------

/**
 * الورقة تحمل باركود رقمها ورقمَه مكتوباً تحته (`InvoiceDoc`)، فمن
 * جاءه وليٌّ بورقته في يده لا يقرأ ثلاثةَ عشرَ رقماً ويكتبها — يمسحها.
 *
 * والبحثُ يقبل الاسمَ والرقم معاً، فقد يرجع أكثرَ من صفّ. والمعتمَدُ
 * المطابقةُ التامّة وحدها، وإلّا فصفٌّ واحدٌ لا ثاني له. وما عدا ذلك
 * «لا وجود» — فورقةٌ خطأ أهونُ من ورقةٍ تُفتح على فاتورة غيرها ويُقبض
 * عليها.
 */
function InvoiceScanner({
  accent,
  onFound,
}: {
  accent: string;
  onFound: (invoice: Invoice) => void;
}) {
  return (
    <BarcodeScanner<Invoice>
      accent={accent}
      onFound={onFound}
      copy={{
        button: "مسح الفاتورة",
        buttonTitle: "اعثر على فاتورة بمسح الباركود المطبوع عليها",
        title: "مسح باركود الفاتورة",
        subtitle: "الورقة تدلّ على فاتورتها — بلا بحثٍ ولا مرشِّحات",
        placeholder: "امسح الباركود، أو اكتب رقم الفاتورة…",
        action: "اعرض الفاتورة",
        notFound: "لا وجود لفاتورة بهذا الكود بار — الرجاء التحقّق منه.",
        hint: "الرقم مكتوبٌ تحت الباركود في أسفل الورقة",
        steps: [
          <>
            وجّه القارئ إلى <span className="font-bold text-white/85">الباركود المطبوع</span> في
            أسفل ورقة الفاتورة.
          </>,
          <>القارئ يكتب الرقم في الحقل أدناه من نفسه ثمّ يُرسله — لا تضغط شيئاً.</>,
          <>
            تُغلق هذه النافذة وتُفرَغ المرشِّحات، فتبقى في القائمة فاتورتُها وحدها بحالتها
            وما بقي عليها.
          </>,
        ],
      }}
      resolve={async (text) => {
        const { invoices } = await listInvoices({ search: text, limit: 5 });

        return (
          invoices.find((invoice) => invoice.invoiceNumber === text) ??
          (invoices.length === 1 ? invoices[0]! : null)
        );
      }}
    />
  );
}
