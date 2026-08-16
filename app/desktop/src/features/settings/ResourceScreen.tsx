import { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight,
  Calculator,
  Loader2,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { DateField } from "../../components/DateField";
import { Avatar } from "../../components/shared/Avatar";
import { apiClient } from "../../core/api/client";
import { useAuthStore } from "../../core/stores/auth.store";
import { useSchoolStore } from "../../core/stores/school.store";
import {
  DEFAULT_CURRENCY,
  formatInputAmount,
  formatMoney,
  parseMoney,
} from "../../core/utils/money";
import { MOTION } from "../../motion/system";
import { useScreenExit } from "../../lib/screen-transition";
import { hubOf, type FieldSpec, type ResourceSpec } from "./resource.config";

type Row = Record<string, any>;

const PAGE_SIZE = 20;

const fmtDate = (v?: string | null) =>
  v ? new Date(v).toLocaleDateString("fr-DZ", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

/** رمز العملة من هوية المدرسة — «دج» ما لم يُضبط غيرُه */
const useCurrency = () =>
  useSchoolStore((s) => s.settings["school.currency"] || DEFAULT_CURRENCY);

/** يقرأ مساراً متداخلاً مثل level.name أو _count.levels */
const dig = (row: Row, path: string) =>
  path.split(".").reduce<any>((acc, k) => (acc == null ? acc : acc[k]), row);

/**
 * تسمية خيارٍ في قائمة مرجعية.
 *
 * `name` هو الأصل، و`refLabel` استثناءُ الأشخاص: الأستاذ حقلان لا
 * حقل، فقائمةٌ تقرأ `name` وحده تعرض خياراتٍ فارغة لا يُختار منها.
 */
const optionLabel = (row: Row, refLabel?: string[]) =>
  refLabel
    ? refLabel.map((p) => dig(row, p)).filter(Boolean).join(" ").trim()
    : (row.name ?? "");

/** «اللقب الاسم» — الترتيب المعتمد في الكشوف والقوائم */
const personName = (p: any) =>
  p ? `${p.lastName ?? ""} ${p.firstName ?? ""}`.trim() : "";

const BADGE_LABELS: Record<string, string> = {
  PRIMARY: "ابتدائي", MIDDLE: "متوسط", SECONDARY: "ثانوي",
  NORMAL: "عادي", ELITE: "نخبة", INTENSIVE: "مكثّف", EVENING: "مسائي",
};

/**
 * شاشة موردٍ واحدة لعشرة موارد — موزَّعةٍ على ثلاثة محاور.
 *
 * تُبنى من `ResourceSpec`: الأعمدة والحقول والفلاتر. عشر نسخٍ متطابقة
 * كانت ستفترق عند أوّل تعديل — تُضاف ميزة إلى إحداها وتُنسى في التسع.
 *
 * وزرّ الرجوع يشتقّ محوره من مسار المورد (`hubOf`) لا من ثابتٍ مكتوب،
 * فلا يُخرج المستخدم إلى محورٍ لم يأتِ منه.
 */
export function ResourceScreen({ spec }: { spec: ResourceSpec }) {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);
  const currency = useCurrency();

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({});

  const [editing, setEditing] = useState<Row | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirming, setConfirming] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);

  /** خيارات المراجع — تُجلب مرّة لكل مسار */
  const [refs, setRefs] = useState<Record<string, Row[]>>({});

  useEffect(() => {
    const paths = new Set<string>();
    spec.fields.forEach((f) => f.refPath && paths.add(f.refPath));
    spec.filters?.forEach((f) => paths.add(f.refPath));

    paths.forEach(async (p) => {
      try {
        const { data } = await apiClient.get(p, { params: { limit: 100 } });
        setRefs((r) => ({ ...r, [p]: data.data }));
      } catch {
        setRefs((r) => ({ ...r, [p]: [] }));
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.key]);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => setPage(1), [debounced, filters]);

  const query = useMemo(
    () => ({ page, limit: PAGE_SIZE, ...(debounced && { search: debounced }), ...filters }),
    [page, debounced, filters],
  );

  const fetchRows = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await apiClient.get(spec.api, { params: query });
      setRows(data.data);
      setTotal(data.pagination?.total ?? data.data.length);
      setTotalPages(data.pagination?.totalPages ?? 1);
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, spec.key]);

  const remove = async () => {
    if (!confirming) return;
    setBusy(true);
    try {
      await apiClient.delete(`${spec.api}/${confirming.id}`);
      setConfirming(null);
      await fetchRows();
    } catch (err: any) {
      setError(err?.response?.data?.message ?? "تعذّر الحذف");
      setConfirming(null);
    } finally {
      setBusy(false);
    }
  };

  const cell = (row: Row, col: (typeof spec.columns)[number]) => {
    const raw = dig(row, col.path ?? col.key);

    if (col.kind === "bool")
      return raw ? <span className="text-emerald-300">●</span> : <span className="text-white/15">○</span>;

    if (col.kind === "badge") {
      if (col.key === "isActive")
        return (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-bold"
            style={raw
              ? { background: "rgba(134,239,172,0.14)", color: "#86efac" }
              : { background: "rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.45)" }}
          >
            {raw ? "مفعّل" : "معطّل"}
          </span>
        );
      return (
        <span className="rounded-lg bg-white/8 px-2 py-0.5 text-[11px]">
          {BADGE_LABELS[raw] ?? raw ?? "—"}
        </span>
      );
    }

    if (col.kind === "date") return <span dir="ltr">{fmtDate(raw)}</span>;
    if (col.kind === "time") return <span dir="ltr">{raw ?? "—"}</span>;
    /* المبلغ بأرقامه اللاتينية ومن اليسار — وإلّا انقلب ترتيبه بجوار العربية */
    if (col.kind === "money")
      return (
        <span dir="ltr" className="tabular-nums">
          {formatMoney(raw, currency)}
        </span>
      );
    if (col.kind === "count")
      return <span className="rounded-lg bg-white/5 px-2 py-0.5 text-xs">{raw ?? 0}</span>;

    if (col.kind === "person") {
      const name = personName(raw);
      return name || <span className="text-white/35">{col.emptyLabel ?? "—"}</span>;
    }

    /* الصفُّ كلُّه مصدرُه لا `raw` — انظر تعليق ColumnSpec.kind */
    if (col.kind === "avatar")
      return (
        <Avatar
          src={row.avatar}
          name={personName(row) || row.username || row.name || ""}
          gender={row.gender}
          size={30}
        />
      );

    return raw === null || raw === undefined || raw === ""
      ? (col.emptyLabel ?? "—")
      : String(raw);
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title={spec.label} subtitle={spec.desc}>
        <button
          onClick={() => exitTo(hubOf(spec))}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-325 p-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
          className="mb-5 flex flex-wrap items-center gap-3"
        >
          <div className="relative min-w-65 flex-1">
            <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`ابحث في ${spec.label}…`}
              className="w-full rounded-xl border border-white/10 bg-black/30 py-2.5 pe-4 ps-10 outline-none transition focus:border-white/30"
            />
          </div>

          {spec.filters?.map((f) => (
            <select
              key={f.key}
              value={filters[f.key] ?? ""}
              onChange={(e) =>
                setFilters((prev) => {
                  const next = { ...prev };
                  if (e.target.value) next[f.key] = e.target.value;
                  else delete next[f.key];
                  return next;
                })
              }
              className="rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-xs font-bold outline-none"
              style={{ color: filters[f.key] ? spec.tone : "rgba(255,255,255,0.6)" }}
            >
              <option value="" className="bg-[#0a0f1a] text-white">{f.label}: الكل</option>
              {(refs[f.refPath] ?? []).map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0a0f1a] text-white">
                  {optionLabel(o, f.refLabel)}
                </option>
              ))}
            </select>
          ))}

          {can(`${spec.permission}.create`) && (
            <button
              onClick={() => { setEditing(null); setFormOpen(true); }}
              className="flex items-center gap-2 rounded-xl px-4 py-2.5 font-black text-[#04121c] transition hover:brightness-110"
              style={{ background: spec.tone }}
            >
              <Plus className="h-4.5 w-4.5" />
              {spec.singular} جديد
            </button>
          )}
        </motion.div>

        {error && (
          <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            {error}
            <button onClick={() => setError(null)}><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-xs text-white/50">
                {spec.columns.map((c) => (
                  <th key={c.key} className={`px-4 py-3 font-bold text-${c.align ?? "start"}`}>
                    {c.label}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={spec.columns.length + 1} className="px-4 py-16 text-center text-white/40">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={spec.columns.length + 1} className="px-4 py-16 text-center">
                    <spec.icon className="mx-auto mb-3 h-10 w-10 text-white/15" />
                    <p className="text-white/50">لا {spec.label} بعد</p>
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-b border-white/5 transition last:border-0 hover:bg-white/[0.03]">
                    {spec.columns.map((c) => (
                      <td key={c.key} className={`px-4 py-3 text-${c.align ?? "start"}`}>
                        {cell(row, c)}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {can(`${spec.permission}.update`) && (
                          <button
                            title="تعديل"
                            onClick={() => { setEditing(row); setFormOpen(true); }}
                            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-white/15"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {can(`${spec.permission}.delete`) && (
                          <button
                            title="حذف"
                            onClick={() => setConfirming(row)}
                            className="grid h-8 w-8 place-items-center rounded-lg text-white/60 transition hover:bg-rose-500/20 hover:text-rose-300"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {total > 0 && (
          <div className="mt-4 flex items-center justify-between text-sm text-white/50">
            <span>{total} — صفحة {page} من {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30">السابق</button>
              <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
                className="rounded-lg bg-white/10 px-3 py-1.5 text-xs disabled:opacity-30">التالي</button>
            </div>
          </div>
        )}
      </div>

      {formOpen && (
        <ResourceForm
          spec={spec}
          row={editing}
          refs={refs}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchRows(); }}
        />
      )}

      {confirming && (
        <>
          <div onClick={() => setConfirming(null)} className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm" />
          <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-100 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-[#0a0f1a] p-6">
            <h3 className="mb-2 text-lg font-black">حذف</h3>
            <p className="mb-5 text-sm text-white/60">
              سيُحذف <span className="font-bold text-white">{confirming.name ?? "العنصر"}</span> نهائياً.
            </p>
            <div className="flex gap-3">
              <button onClick={remove} disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-rose-500 px-4 py-2.5 font-bold transition hover:bg-rose-400 disabled:opacity-50">
                {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                حذف
              </button>
              <button onClick={() => setConfirming(null)}
                className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold transition hover:bg-white/20">إلغاء</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------
// النموذج
// --------------------------------------------------

function ResourceForm({
  spec, row, refs, onClose, onSaved,
}: {
  spec: ResourceSpec;
  row: Row | null;
  refs: Record<string, Row[]>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!row;

  const initial = useMemo(() => {
    const o: Record<string, any> = {};
    spec.fields.forEach((f) => {
      const v = row?.[f.key];
      if (f.kind === "date") o[f.key] = v ? String(v).slice(0, 10) : "";
      else if (f.kind === "switch") o[f.key] = v ?? (f.key === "isActive");
      /*
       * التوقيت يبدأ بقيمةٍ لا بفراغ.
       *
       * منتقي التوقيت يعرض 08:00 حين لا قيمة له، فلو بقي الحقل فارغاً
       * في النموذج لأرسل المستخدمُ لا شيء وهو يرى ثمانيةً أمامه —
       * ويُرفض الطلب بـ«الوقت مطلوب» بلا سبب ظاهر. فما يُعرض هو ما
       * يُرسل من اللحظة الأولى.
       */
      else if (f.kind === "time") o[f.key] = v ?? "08:00";
      /*
       * المبلغ يُفتح مكتوباً بمنزلتيه.
       *
       * الخادم يرسل 1500 لسعرٍ مخزَّن `1500.00`، فكان النموذج يعرض
       * «1500» ويعرض الجدولُ خلفه «1500.00 دج» — رقمان لسعرٍ واحد.
       * وكتابتُه هنا كما يُعرض هناك تُنهي السؤال: ما أراه هو ما يُحفظ.
       */
      else if (f.kind === "money") o[f.key] = v === null || v === undefined || v === "" ? "" : formatInputAmount(v);
      else o[f.key] = v ?? "";
    });
    return o;
  }, [row, spec]);

  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = (k: string, v: any) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    /* الفراغ يعني «غير مضبوط» — لا نصّاً فارغاً يرفضه الخادم */
    const payload: Record<string, any> = {};
    let invalid: string | null = null;

    /*
     * الحقول التي لا تستعملها الطريقة المختارة تُفرَّغ ولا تُرسل.
     *
     * وإلّا بقيت قيمتُها في الصفّ بعد تبديل الطريقة: سياسةٌ صارت
     * «نسبة» وفيها «المبلغ لكل طالب = 500» من اختيارٍ سابق. لا يقرؤها
     * الحساب، لكنّ من رآها في الجدول ظنّها داخلةً فيه — وهو اللبس
     * نفسه الذي يُخفيها من النموذج.
     */
    const irrelevant = new Set(
      spec.fields.filter((f) => f.showIf && !f.showIf(form)).map((f) => f.key),
    );

    spec.fields.forEach((f) => {
      const v = form[f.key];

      if (irrelevant.has(f.key)) {
        if (editing) payload[f.key] = null;
        return;
      }

      if (f.kind === "switch") { payload[f.key] = !!v; return; }
      if (v === "" || v === null || v === undefined) {
        /* المطلوب الظاهر لا يُترك فارغاً — والرسالة عربيةٌ هنا لا مرتدّةٌ من الخادم */
        if (f.required) invalid = `«${f.label}» مطلوب`;
        else if (editing) payload[f.key] = null;
        return;
      }

      /*
       * المبلغ يُقرأ لا يُحوَّل بـ`Number` مباشرةً.
       *
       * `Number("1500,50")` = NaN، و`Number("١٥٠٠")` = NaN كذلك —
       * وكلاهما يُكتب في الجزائر. وإرسالُ NaN يرتدّ من الخادم برسالة
       * «Amount is required» لا تشرح شيئاً للذي كتب مبلغاً يراه صحيحاً.
       */
      if (f.kind === "money") {
        const amount = parseMoney(String(v));

        if (amount === null) {
          invalid = `«${f.label}» ليس مبلغاً صحيحاً — اكتب رقماً مثل 1500.00`;
          return;
        }

        payload[f.key] = amount;
        return;
      }

      payload[f.key] = f.kind === "number" ? Number(v) : v;
    });

    if (invalid) {
      setError(invalid);
      setBusy(false);
      return;
    }

    try {
      if (editing) await apiClient.patch(`${spec.api}/${row!.id}`, payload);
      else await apiClient.post(spec.api, payload);
      onSaved();
    } catch (err: any) {
      const d = err?.response?.data;
      setError(d?.errors?.[0]?.message ?? d?.message ?? "تعذّر الحفظ");
    } finally {
      setBusy(false);
    }
  };

  const visible = spec.fields.filter(
    (f) => !(editing && f.createOnly) && (f.showIf?.(form) ?? true),
  );

  /* ما ستفعله القيم المكتوبة — يُقرأ قبل الحفظ لا بعد أن يظهر رقمٌ غريب */
  const explanation = spec.explain?.(form) ?? null;

  return (
    <div className="fixed inset-0 z-40">
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      {/*
        نافذةٌ في الوسط لا درجٌ جانبي.
        الدرج عرضُه 28rem فيصفّ الحقول عموداً واحداً طويلاً، ونماذجُ
        هذا النظام تبلغ خمسةَ عشرَ حقلاً — فيبقى نصفُها تحت خطّ الرؤية
        ومعها لوحةُ الشرح التي لا تُقرأ إن لم تُرَ. والوسطُ يتّسع
        لعمودين فيُرى النموذج كلُّه دفعةً واحدة.
      */}
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
        className="absolute inset-x-4 top-1/2 z-50 mx-auto flex max-h-[90vh] w-auto max-w-4xl -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
      >
        <header
          className="flex items-center gap-3 border-b border-white/10 px-7 py-5"
          style={{ background: `linear-gradient(90deg, ${spec.tone}14, transparent)` }}
        >
          <span className="grid h-11 w-11 place-items-center rounded-xl" style={{ background: `${spec.tone}1f` }}>
            <spec.icon className="h-5.5 w-5.5" style={{ color: spec.tone }} />
          </span>
          <div className="flex-1">
            <h2 className="text-lg font-black leading-tight">
              {editing ? `تعديل ${spec.singular}` : `${spec.singular} جديد`}
            </h2>
            <p className="mt-0.5 text-[11px] text-white/40">{spec.desc}</p>
          </div>
          <button type="button" onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-7 py-6">
          <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
            {visible.map((f) => (
              <div key={f.key} className={f.wide || f.kind === "switch" ? "sm:col-span-2" : ""}>
                <Field spec={f} value={form[f.key]} onChange={(v) => set(f.key, v)} refs={refs} tone={spec.tone} />
              </div>
            ))}
          </div>

          {explanation && (
            <div
              className="mt-5 rounded-2xl border p-5"
              style={{ borderColor: `${spec.tone}33`, background: `${spec.tone}0a` }}
            >
              <div className="mb-3 flex items-center gap-2">
                <Calculator className="h-4 w-4 shrink-0" style={{ color: spec.tone }} />
                <span className="text-sm font-black">كيف يُحسب المبلغ</span>
              </div>

              <p className="mb-4 text-xs leading-relaxed text-white/65">{explanation.intro}</p>

              {explanation.formula && (
                <>
                  <span className="mb-1.5 block text-[10px] font-bold tracking-wide text-white/35">المعادلة</span>
                  <div className="mb-4 space-y-1 rounded-xl bg-black/45 p-3.5">
                    {explanation.formula.map((line) => (
                      <div key={line} className="whitespace-pre font-mono text-[11.5px] leading-relaxed text-white/85">
                        {line}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {explanation.example && (
                <div className="mb-4 rounded-xl border border-white/10 bg-black/25 p-3.5">
                  <span className="mb-2 block text-[10px] font-bold text-white/40">
                    {explanation.example.label}
                  </span>
                  <div className="space-y-1">
                    {explanation.example.lines.map((line) => (
                      <div key={line} className="whitespace-pre font-mono text-[11.5px] leading-relaxed text-white/70">
                        {line}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {explanation.uses && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-white/40">الحقول الداخلة في الحساب:</span>
                  {explanation.uses.map((field) => (
                    <span
                      key={field}
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-bold"
                      style={{ background: `${spec.tone}24`, color: spec.tone }}
                    >
                      {field}
                    </span>
                  ))}
                </div>
              )}

              {explanation.notes && (
                <ul className="space-y-2">
                  {explanation.notes.map((note) => (
                    <li key={note} className="flex gap-2 text-[11.5px] leading-relaxed text-white/50">
                      <span
                        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ background: `${spec.tone}66` }}
                      />
                      {note}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {error && (
            <div className="mt-5 whitespace-pre-line rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm leading-relaxed text-rose-200">
              {error}
            </div>
          )}
        </div>

        <footer className="flex gap-3 border-t border-white/10 px-6 py-4">
          <button type="submit" disabled={busy}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-40"
            style={{ background: spec.tone }}>
            {busy ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <Save className="h-4.5 w-4.5" />}
            {editing ? "حفظ" : "إضافة"}
          </button>
          <button type="button" onClick={onClose}
            className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20">إلغاء</button>
        </footer>
      </motion.form>
    </div>
  );
}

function Field({
  spec, value, onChange, refs, tone,
}: {
  spec: FieldSpec;
  value: any;
  onChange: (v: any) => void;
  refs: Record<string, Row[]>;
  tone: string;
}) {
  const input = "w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 outline-none transition focus:border-white/30";

  /* شرحُ الخيار المختار — يحلّ محلّ التلميح العام لأنّه أخصُّ منه */
  const chosen = spec.options?.find((o) => o.value === value)?.desc;

  if (spec.kind === "switch") {
    return (
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-4 py-3">
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
          className="h-4 w-4" style={{ accentColor: tone }} />
        <span className="text-sm font-bold">{spec.label}</span>
        {spec.hint && <span className="text-[11px] text-white/40">{spec.hint}</span>}
      </label>
    );
  }

  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-bold text-white/60">
        {spec.label}
        {spec.required && <span className="ms-1 text-rose-300">*</span>}
      </span>

      {spec.kind === "reference" ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={input}>
          <option value="" className="bg-[#0a0f1a]">
            {spec.emptyOption ?? "— اختر —"}
          </option>
          {(refs[spec.refPath!] ?? []).map((o) => (
            <option key={o.id} value={o.id} className="bg-[#0a0f1a]">
              {optionLabel(o, spec.refLabel)}
            </option>
          ))}
        </select>
      ) : spec.kind === "select" ? (
        <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={input}>
          <option value="" className="bg-[#0a0f1a]">— اختر —</option>
          {spec.options?.map((o) => (
            <option key={o.value} value={o.value} className="bg-[#0a0f1a]">{o.label}</option>
          ))}
        </select>
      ) : spec.kind === "textarea" ? (
        <textarea value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={2} className={`${input} resize-none`} />
      ) : spec.kind === "money" ? (
        <MoneyField value={value ?? ""} onChange={onChange} tone={tone} min={spec.min} />
      ) : spec.kind === "time" ? (
        <TimeField value={value ?? ""} onChange={onChange} tone={tone} />
      ) : spec.kind === "date" ? (
        <DateField value={value ?? ""} onChange={onChange} tone={tone} />
      ) : spec.kind === "color" ? (
        <div className="flex items-center gap-3">
          <input type="color" value={value || "#3b82f6"} onChange={(e) => onChange(e.target.value)}
            className="h-11 w-16 cursor-pointer rounded-lg border border-white/10 bg-black/30" />
          <input value={value ?? ""} onChange={(e) => onChange(e.target.value)} dir="ltr" className={input} />
        </div>
      ) : (
        <input
          type={
            spec.kind === "number"
              ? "number"
              : spec.kind === "password"
                ? "password"
                : "text"
          }
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={spec.kind === "password" ? "new-password" : undefined}
          dir={
            spec.kind === "number" || spec.kind === "password"
              ? "ltr"
              : undefined
          }
          min={spec.min}
          max={spec.max}
          className={input}
        />
      )}

      {chosen ? (
        <span
          className="mt-1.5 block rounded-lg px-2.5 py-1.5 text-[11px] leading-relaxed"
          style={{ background: `${tone}12`, color: `${tone}` }}
        >
          {chosen}
        </span>
      ) : (
        spec.hint && (
          <span className="mt-1.5 block text-[11px] leading-relaxed text-white/40">{spec.hint}</span>
        )
      )}
    </label>
  );
}

// --------------------------------------------------
// حقل المبلغ
//
// كان `type="number"` مجرّداً، وثلاثةُ أمور فيه تُربك:
//
//   1. لا يقول ما سيُحفظ. المستخدم يكتب «1500» ويرى الجدولَ بعدها
//      يقول «1500.00 دج» فيسأل: أزيدَ شيء؟ وأين ذهبت النقطتان؟
//   2. لا يقبل ما تكتبه اليد فعلاً — الفاصلة العربية «1500,50»
//      والأرقام الهندية «١٥٠٠» يبتلعهما الحقل الرقمي بلا أثر.
//   3. عجلةُ الفأرة فوقه تغيّر السعر صامتةً وهو مركَّز.
//
// فصار حقلاً نصّياً بمعاينةٍ حيّة: ما تحته هو ما يُرسل حرفاً بحرف.
// --------------------------------------------------

function MoneyField({
  value,
  onChange,
  tone,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  tone: string;
  min?: number;
}) {
  const currency = useCurrency();
  const parsed = value.trim() === "" ? null : parseMoney(value);
  const tooSmall = parsed !== null && min !== undefined && parsed < min;

  return (
    <div>
      <div className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            /* الخروج من الحقل يكتبه بمنزلتيه — فلا يبقى «1500» و«1500.00» صورتين لسعر */
            const amount = parseMoney(value);
            if (amount !== null) onChange(formatInputAmount(amount));
          }}
          inputMode="decimal"
          dir="ltr"
          placeholder="0.00"
          className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-2.5 pe-16 text-left font-black tabular-nums outline-none transition focus:border-white/30"
        />
        <span className="pointer-events-none absolute inset-y-0 end-4 flex items-center text-xs font-bold text-white/40">
          {currency}
        </span>
      </div>

      {/* المعاينة: ما سيُحفظ، لا ما كُتب */}
      <div className="mt-1.5 min-h-4.5 text-[11px]">
        {value.trim() === "" ? (
          <span className="text-white/30">اكتب المبلغ — مثال 1500 أو 1500.50</span>
        ) : parsed === null ? (
          <span className="text-rose-300">ليس مبلغاً — أرقامٌ ونقطةٌ واحدة لا غير</span>
        ) : tooSmall ? (
          <span className="text-rose-300">أقلّ من الحدّ الأدنى ({formatMoney(min!, currency)})</span>
        ) : (
          <span className="font-bold" style={{ color: tone }} dir="ltr">
            = {formatMoney(parsed, currency)}
          </span>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------
// حقل التوقيت
//
// كان حقلاً نصّياً بـ placeholder «08:00»، والخادم يفرض HH:mm بأصفارٍ
// بادئة (TIME_PATTERN). فمن كتب «8:» أو «8:30» صحيحاً في ذهنه اصطدم
// برفضٍ لا يفهم سببه — والخطأ ليس منه بل من حقلٍ يقبل ما لا يُقبل.
//
// ثلاثةُ اختياراتٍ مقفلة تُخرج القيمة صحيحةً بالبناء: لا صيغة تُكتب
// خطأً، ولا صفرٌ بادئ يُنسى.
//
// والعرض بنظام 12 ساعة لأنّ المؤسسة تتحدّث به — «الرابعة مساءً» لا
// «16:00» — بينما المحفوظ 24 ساعة كما يطلب الخادم. الترجمة هنا لا في
// رأس المستخدم.
// --------------------------------------------------

const MINUTE_STEPS = ["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"];

/** "16:30" → { hour: 4, minute: "30", pm: true } */
const parse12 = (value: string) => {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);

  if (!match) return { hour: 8, minute: "00", pm: false };

  const h24 = Number(match[1]);

  return {
    hour: h24 % 12 === 0 ? 12 : h24 % 12,
    minute: match[2]!,
    pm: h24 >= 12,
  };
};

/** { 4, "30", pm } → "16:30" */
const to24 = (hour: number, minute: string, pm: boolean) => {
  const h24 = pm ? (hour === 12 ? 12 : hour + 12) : hour === 12 ? 0 : hour;

  return `${String(h24).padStart(2, "0")}:${minute}`;
};

function TimeField({
  value,
  onChange,
  tone,
}: {
  value: string;
  onChange: (v: string) => void;
  tone: string;
}) {
  const { hour, minute, pm } = parse12(value);

  const emit = (h: number, m: string, isPm: boolean) => onChange(to24(h, m, isPm));

  const box =
    "rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm font-bold outline-none transition focus:border-white/30";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <select
          value={hour}
          onChange={(e) => emit(Number(e.target.value), minute, pm)}
          className={`${box} flex-1`}
          dir="ltr"
        >
          {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
            <option key={h} value={h} className="bg-[#0a0f1a]">
              {h}
            </option>
          ))}
        </select>

        <span className="text-lg font-black text-white/30">:</span>

        <select
          value={minute}
          onChange={(e) => emit(hour, e.target.value, pm)}
          className={`${box} flex-1`}
          dir="ltr"
        >
          {MINUTE_STEPS.map((m) => (
            <option key={m} value={m} className="bg-[#0a0f1a]">
              {m}
            </option>
          ))}
        </select>

        {/* صباحاً / مساءً — زرّان لا قائمة، فالخيار ثنائيّ يُرى بلا فتح */}
        <div className="flex overflow-hidden rounded-xl border border-white/10">
          {[
            { label: "صباحاً", isPm: false },
            { label: "مساءً", isPm: true },
          ].map((option) => {
            const active = option.isPm === pm;

            return (
              <button
                key={option.label}
                type="button"
                onClick={() => emit(hour, minute, option.isPm)}
                className="px-3 py-2.5 text-xs font-bold transition"
                style={
                  active
                    ? { background: tone, color: "#04121f" }
                    : { color: "rgba(255,255,255,0.45)" }
                }
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ما سيُحفظ فعلاً — فلا يبقى تحويل 12↔24 مخفيّاً */}
      <p className="text-[11px] text-white/30">
        يُحفظ <span className="font-bold text-white/55" dir="ltr">{to24(hour, minute, pm)}</span>
      </p>
    </div>
  );
}
