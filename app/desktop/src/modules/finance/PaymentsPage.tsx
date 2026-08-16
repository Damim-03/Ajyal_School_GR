import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Ban,
  Check,
  ChevronLeft,
  Loader2,
  Plus,
  Printer,
  Search,
  UserSearch,
  Wallet,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { PrintPreview } from "../../components/print/PrintPreview";
import { Avatar } from "../../components/shared/Avatar";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchoolStore } from "../../core/stores/school.store";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { listStudents, type Student } from "../students/student.api";
import { ReceiptDoc } from "./PrintDocs";
import {
  cancelPayment,
  createPayment,
  getPayment,
  listInvoices,
  listPayments,
  markReceiptPrinted,
  money,
  METHOD_LABEL,
  MONTHS,
  type Invoice,
  type Pagination,
  type Payment,
  type PaymentMethod,
} from "./finance.api";

const ACCENT = "#ff8fb1";
const PAGE_SIZE = 15;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("fr-DZ");

export default function PaymentsPage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);
  const currency = useSchoolStore((s) => s.settings["school.currency"] ?? "دج");

  const [rows, setRows] = useState<Payment[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [method, setMethod] = useState<PaymentMethod | "">("");
  const [page, setPage] = useState(1);

  const [creating, setCreating] = useState(false);
  const [printing, setPrinting] = useState<Payment | null>(null);
  const [confirming, setConfirming] = useState<Payment | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, method]);

  const query = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      ...(debounced && { search: debounced }),
      ...(method && { paymentMethod: method }),
    }),
    [page, debounced, method],
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await listPayments(query);
      setRows(r.payments);
      setPagination(r.pagination);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب المدفوعات");
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
      await cancelPayment(confirming.id);
      setConfirming(null);
      await fetchRows();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الإلغاء");
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const openPrint = async (row: Payment) => {
    try {
      setPrinting(await getPayment(row.id));
    } catch {
      setPrinting(row);
    }
  };

  const dayTotal = rows
    .filter((p) => p.status === "ACTIVE")
    .reduce((s, p) => s + p.amount, 0);

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="المدفوعات" subtitle="التحصيل وإيصالاته">
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
              placeholder="ابحث برقم الدفعة أو الإيصال…"
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 outline-none transition focus:border-white/30"
            />
          </div>

          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 p-1">
            {([
              { v: "", label: "الكل" },
              { v: "CASH", label: "نقداً" },
              { v: "CARD", label: "بطاقة" },
              { v: "BANK_TRANSFER", label: "تحويل" },
            ] as const).map((o) => (
              <button
                key={o.v}
                onClick={() => setMethod(o.v as PaymentMethod | "")}
                className="rounded-lg px-3 py-1.5 text-xs font-bold transition"
                style={method === o.v ? { background: `${ACCENT}22`, color: ACCENT } : { color: "rgba(255,255,255,0.5)" }}
              >
                {o.label}
              </button>
            ))}
          </div>

          {can("payment.create") && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-black text-[#1a0410] transition hover:brightness-110"
              style={{ background: ACCENT }}
            >
              <Plus className="h-4.5 w-4.5" />
              تسجيل دفعة
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
          <div className="mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5">
            <div className="text-[11px] text-white/40">محصَّل هذه الصفحة</div>
            <div className="font-black text-emerald-200">{money(dayTotal, currency)}</div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/50">
                <th className="px-4 py-3 text-start font-bold">الإيصال</th>
                <th className="px-4 py-3 text-start font-bold">الطالب</th>
                <th className="px-4 py-3 text-start font-bold">التاريخ</th>
                <th className="px-4 py-3 text-start font-bold">الطريقة</th>
                <th className="px-4 py-3 text-start font-bold">المبلغ</th>
                <th className="px-4 py-3 text-center font-bold">الفواتير</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-16 text-center text-white/40"><Loader2 className="mx-auto h-6 w-6 animate-spin" /></td></tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <Wallet className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/50">
                      {debounced || method ? "لا دفعة تطابق هذه التصفية" : "لا مدفوعات بعد"}
                    </p>
                  </td>
                </tr>
              ) : (
                rows.map((p) => {
                  const st = p.paymentInvoices[0]?.invoice.studentEnrollment.student;
                  const cancelled = p.status === "CANCELLED";
                  return (
                    <tr key={p.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]" style={cancelled ? { opacity: 0.45 } : undefined}>
                      <td className="px-4 py-3 text-white/60" dir="ltr">
                        {p.receipt?.receiptNumber ?? p.paymentNumber}
                        {p.receipt?.printed && (
                          <span className="ms-2 text-[10px] text-emerald-300/70">مطبوع</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold">
                        {st ? `${st.firstName} ${st.lastName}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-white/60" dir="ltr">{fmtDate(p.paymentDate)}</td>
                      <td className="px-4 py-3 text-white/70">{METHOD_LABEL[p.paymentMethod]}</td>
                      <td className="px-4 py-3 font-black">{money(p.amount, currency)}</td>
                      <td className="px-4 py-3 text-center text-white/50">{p.paymentInvoices.length}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            title="طباعة الإيصال"
                            onClick={() => openPrint(p)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/15"
                          >
                            <Printer className="h-4 w-4" />
                          </button>
                          {can("payment.cancel") && !cancelled && (
                            <button
                              title="إلغاء الدفعة"
                              onClick={() => setConfirming(p)}
                              className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300"
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {pagination && pagination.total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>{pagination.total} دفعة · صفحة {pagination.page} من {pagination.totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30">السابق</button>
              <button disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30">التالي</button>
            </div>
          </div>
        )}
      </div>

      {creating && (
        <NewPaymentDialog
          currency={currency}
          onClose={() => setCreating(false)}
          onDone={(p) => {
            setCreating(false);
            fetchRows();
            /* الطباعة تتبع التسجيل مباشرة — هذا ما يفعله المحصِّل فعلاً */
            setPrinting(p);
          }}
        />
      )}

      {printing && (
        <PrintPreview
          doc={{
            title: `إيصال ${printing.receipt?.receiptNumber ?? printing.paymentNumber}`,
            render: () => <ReceiptDoc payment={printing} />,
            onPrinted: async () => {
              const r = printing.receipt;
              if (!r) return;
              /*
               * الإيصال المطبوع سابقاً يُسجَّل «إعادة طباعة» لا طباعة أولى:
               * الخادم يرفض الطباعة الأولى مرّتين، والفرق نفسه يُحاسَب عليه.
               */
              if (!can(r.printed ? "receipt.reprint" : "receipt.print")) return;
              try {
                await markReceiptPrinted(r.id, r.printed);
                fetchRows();
              } catch {
                /* الورقة خرجت فعلاً — فشل التعليم لا يُبطلها */
              }
            },
          }}
          onClose={() => setPrinting(null)}
        />
      )}

      {confirming && (
        <>
          <div onClick={() => setConfirming(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-105 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">إلغاء الدفعة</h3>
            <p className="mb-5 text-sm text-white/60">
              يُعاد المبلغ إلى متبقّي الفواتير التي غطّتها هذه الدفعة، وتُلغى معها
              الإيصال. السجلّ يبقى.
            </p>
            <div className="flex gap-3">
              <button onClick={doCancel} disabled={busy} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                إلغاء الدفعة
              </button>
              <button onClick={() => setConfirming(null)} className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/20">تراجع</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------
// تسجيل دفعة — طالب ← فواتيره غير المسدَّدة ← توزيع المبلغ
// --------------------------------------------------

function NewPaymentDialog({
  currency, onClose, onDone,
}: {
  currency: string;
  onClose: () => void;
  onDone: (payment: Payment) => void;
}) {
  const [student, setStudent] = useState<Student | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loadingInv, setLoadingInv] = useState(false);
  /** invoiceId → المبلغ المخصَّص (نصّ لأنّ الحقل قيد التحرير) */
  const [alloc, setAlloc] = useState<Record<string, string>>({});

  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* فواتير الطالب غير المسدَّدة — الدفع لا يمسّ سواها */
  useEffect(() => {
    if (!student) { setInvoices([]); setAlloc({}); return; }
    let alive = true;
    setLoadingInv(true);
    listInvoices({ studentId: student.id, limit: 100 })
      .then((r) => {
        if (!alive) return;
        const open = r.invoices.filter((i) => i.status !== "CANCELLED" && i.remaining > 0);
        setInvoices(open);
        setAlloc({});
      })
      .catch((err: any) => alive && setError(err?.response?.data?.message ?? "تعذّر جلب فواتير الطالب"))
      .finally(() => alive && setLoadingInv(false));
    return () => { alive = false; };
  }, [student]);

  const total = Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0);

  const overpaid = invoices.some(
    (i) => (Number(alloc[i.id]) || 0) > i.remaining,
  );

  const payAll = () =>
    setAlloc(Object.fromEntries(invoices.map((i) => [i.id, String(i.remaining)])));

  const submit = async () => {
    const allocations = Object.entries(alloc)
      .map(([invoiceId, v]) => ({ invoiceId, paidAmount: Number(v) || 0 }))
      .filter((a) => a.paidAmount > 0);

    if (allocations.length === 0) { setError("حدّد مبلغاً على فاتورة واحدة على الأقلّ"); return; }

    setBusy(true);
    setError(null);
    try {
      const created = await createPayment({
        allocations,
        paymentMethod: method,
        ...(note.trim() && { note: note.trim() }),
      });
      /* القائمة لا تحمل الإيصال كاملاً — نجلبه لأجل الطباعة */
      try { onDone(await getPayment(created.id)); }
      catch { onDone(created); }
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر تسجيل الدفعة");
      setBusy(false);
    }
  };

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: MOTION.duration.fast }}
        className="fixed left-1/2 top-1/2 z-50 flex max-h-[90vh] w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
      >
        <header
          className="flex items-center gap-3 border-b border-white/10 px-7 py-5"
          style={{ background: `linear-gradient(90deg, ${ACCENT}14, transparent)` }}
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${ACCENT}1f` }}>
            <Wallet className="h-5.5 w-5.5" style={{ color: ACCENT }} />
          </span>
          <div className="flex-1">
            <h3 className="text-lg font-black leading-tight">تسجيل دفعة</h3>
            <p className="mt-0.5 text-[11px] text-white/40">
              ابحث عن الطالب، ثمّ وزّع المبلغ على فواتيره المستحقّة
            </p>
          </div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </header>

        {/*
          البحث في شريطٍ ثابت أعلى الجسم لا داخل الحقول.
          كان حقلاً في قائمةٍ منسدلة داخل نموذجٍ ضيّق، فالنتائج تُغطّي ما
          تحتها وتختفي بأوّل نقرة. وهو أوّلُ ما يفعله الموظّف في كل دفعة،
          فمحلُّه الصدارة.
        */}
        <div className="border-b border-white/10 px-7 py-4">
          <StudentPicker value={student} onChange={setStudent} />
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-7">
          {/* بلا طالبٍ لا شيء يُعرض — فالجسمُ يقول ما ينتظره بدل أن يفرغ */}
          {!student && (
            <div className="grid place-items-center py-16 text-center">
              <UserSearch className="mb-3 h-12 w-12 text-white/12" />
              <p className="text-white/45">ابحث عن الطالب أعلاه</p>
              <p className="mt-1.5 max-w-sm text-xs leading-relaxed text-white/30">
                اكتب حرفين من اسمه أو لقبه، ثمّ اختره من القائمة — فتظهر فواتيره
                المستحقّة وتوزّع المبلغ عليها.
              </p>
            </div>
          )}

          {student && (
            loadingInv ? (
              <div className="py-8 text-center text-white/40"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
            ) : invoices.length === 0 ? (
              <div className="rounded-xl border border-emerald-400/25 bg-emerald-500/[0.08] px-4 py-5 text-center text-sm text-emerald-200">
                لا فواتير مستحقّة على هذا الطالب
              </div>
            ) : (
              <section>
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-sm font-black text-white/70">الفواتير المستحقّة</h4>
                  <button onClick={payAll} className="rounded-lg bg-white/10 px-3 py-1.5 text-[11px] font-bold transition hover:bg-white/20">
                    سدّد الكلّ
                  </button>
                </div>

                <div className="space-y-2">
                  {invoices.map((i) => {
                    const v = Number(alloc[i.id]) || 0;
                    const over = v > i.remaining;
                    return (
                      <div
                        key={i.id}
                        className="flex items-center gap-3 rounded-xl border px-4 py-2.5"
                        style={{ borderColor: over ? "rgba(251,113,133,0.5)" : v > 0 ? `${ACCENT}55` : "rgba(255,255,255,0.1)" }}
                      >
                        <div className="flex-1">
                          <div className="text-sm font-bold">
                            {i.studentEnrollment.teachingAssignment.subject.name}
                            <span className="ms-2 text-[11px] font-normal text-white/40">
                              {MONTHS[i.month - 1]} {i.year}
                            </span>
                          </div>
                          <div className="text-[11px] text-white/40">
                            متبقٍّ {money(i.remaining, currency)} من {money(i.total, currency)}
                          </div>
                        </div>

                        <input
                          type="number"
                          min={0}
                          max={i.remaining}
                          value={alloc[i.id] ?? ""}
                          onChange={(e) => setAlloc((p) => ({ ...p, [i.id]: e.target.value }))}
                          placeholder="0"
                          dir="ltr"
                          className="w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-center outline-none focus:border-white/30"
                        />

                        <button
                          title="المتبقّي كاملاً"
                          onClick={() => setAlloc((p) => ({ ...p, [i.id]: String(i.remaining) }))}
                          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white/50 transition hover:bg-white/15"
                        >
                          <Check className="h-4 w-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {overpaid && (
                  <p className="mt-2 text-xs text-rose-300">
                    مبلغ يتجاوز متبقّي فاتورته — الخادم سيرفض الدفعة.
                  </p>
                )}
              </section>
            )
          )}

          {student && invoices.length > 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-white/60">طريقة الدفع</span>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
                >
                  {(Object.keys(METHOD_LABEL) as PaymentMethod[]).map((m) => (
                    <option key={m} value={m} className="bg-[#0a0f1a]">{METHOD_LABEL[m]}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-white/60">ملاحظة (اختياري)</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none"
                />
              </label>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>
          )}
        </div>

        <footer className="flex items-center gap-4 border-t border-white/10 px-6 py-4">
          <div>
            <div className="text-[11px] text-white/40">إجمالي الدفعة</div>
            <div className="text-xl font-black" style={{ color: ACCENT }}>{money(total, currency)}</div>
          </div>

          <button
            onClick={submit}
            disabled={busy || total <= 0 || overpaid}
            className="ms-auto flex items-center gap-2 rounded-xl px-6 py-3 font-black text-[#1a0410] transition hover:brightness-110 disabled:opacity-40"
            style={{ background: ACCENT }}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Printer className="h-5 w-5" />}
            تسجيل وطباعة الإيصال
          </button>
        </footer>
      </motion.div>
    </>
  );
}

// --------------------------------------------------
// اختيار الطالب — بحث حيّ بدل قائمة بكلّ الطلبة
// --------------------------------------------------

function StudentPicker({
  value, onChange,
}: {
  value: Student | null;
  onChange: (s: Student | null) => void;
}) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const q = term.trim();
    if (q.length < 2) { setResults([]); return; }
    let alive = true;
    const t = window.setTimeout(() => {
      listStudents({ search: q, limit: 8, isActive: true })
        .then((r) => alive && setResults(r.students))
        .catch(() => alive && setResults([]));
    }, 300);
    return () => { alive = false; window.clearTimeout(t); };
  }, [term]);

  /* المختارُ يحلّ محلّ الحقل — فلا يبقى بحثٌ مفتوحٌ بلا معنى */
  if (value) {
    return (
      <div
        className="flex items-center gap-3 rounded-xl border px-4 py-3"
        style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}0f` }}
      >
        <Avatar
          src={value.avatar}
          name={`${value.lastName} ${value.firstName}`}
          gender={value.gender}
          size={40}
        />
        <div className="flex-1">
          <div className="font-black">{value.lastName} {value.firstName}</div>
          <div className="text-[11px] text-white/45" dir="ltr">{value.parentPhone}</div>
        </div>
        <button
          onClick={() => { onChange(null); setTerm(""); }}
          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3.5 py-2 text-xs font-bold transition hover:bg-white/20"
        >
          <Search className="h-3.5 w-3.5" />
          طالبٌ آخر
        </button>
      </div>
    );
  }

  const short = term.trim().length > 0 && term.trim().length < 2;

  return (
    <div>
      <div className="relative">
        <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/35" />
        <input
          autoFocus
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          placeholder="ابحث عن الطالب — اسمه أو لقبه…"
          className="w-full rounded-xl border border-white/10 bg-black/35 py-3.5 pe-4 ps-12 text-[15px] outline-none transition focus:border-white/30"
        />
      </div>

      {/*
        النتائج **في مكانها** لا في قائمةٍ منسدلة.
        المنسدلةُ تُغطّي ما تحتها وتختفي بأوّل نقرة خارجها، وهذا نموذجٌ
        عملُه كلُّه اختيارُ طالب — فالنتائج محتواه لا زائدةٌ عليه.
      */}
      {short && (
        <p className="mt-2.5 text-[11px] text-white/30">اكتب حرفين على الأقلّ.</p>
      )}

      {open && !short && results.length > 0 && (
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto pe-1">
          {results.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => { onChange(s); setOpen(false); }}
                className="flex w-full items-center gap-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-2.5 text-right transition hover:border-white/20 hover:bg-white/[0.06]"
              >
                <Avatar
                  src={s.avatar}
                  name={`${s.lastName} ${s.firstName}`}
                  gender={s.gender}
                  size={36}
                />
                <span className="flex-1">
                  <span className="block font-bold">{s.lastName} {s.firstName}</span>
                  <span className="block text-[11px] text-white/35" dir="ltr">{s.parentPhone}</span>
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-white/25" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !short && term.trim().length >= 2 && results.length === 0 && (
        <p className="mt-3 rounded-xl border border-white/8 bg-white/[0.02] px-4 py-5 text-center text-sm text-white/40">
          لا طالب بهذا الاسم
        </p>
      )}
    </div>
  );
}
