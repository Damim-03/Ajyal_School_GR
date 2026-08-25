import { motion } from "motion/react";
import {
  CalendarRange,
  ChevronDown,
  GitCompareArrows,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { MOTION } from "../../../motion/system";
import type { ReportMeta } from "../reports.api";
import type { UseReportQuery } from "../hooks/use-report-query";

// ======================================================
// شريطُ الفلاتر — §4
//
// القاعدةُ الحاكمة: **لا تعرض ما لا يفهمه التقرير**.
//
// الخادمُ يُرسل `meta.supportedFilters`، ومنه يُبنى الشريط. فشاشةُ
// الحضور لا تعرض «طريقة الدفع» أصلاً، لا تعرضه معطَّلاً ولا تعرضه
// عاملاً وهو مُهمَل.
//
// والبديلُ الشائع — عرضُ كلّ شيء دائماً — يُنتج أسوأَ تجربة: يضبط
// المستخدمُ فلتراً ويرى الرقمَ لا يتغيّر، فيظنّ البياناتِ خاطئة
// والفلترُ لم يُقرأ أصلاً.
//
// ------------------------------------------------------
// الشكل
// ------------------------------------------------------
//
// أزرارٌ وشرائحُ لا قوائمُ منسدلة خام: `<option>` ترسمها المنصّةُ
// ولا تقبل تنسيقاً — تبقى بيضاءَ بخطّ النظام مهما نُسّق الصندوق
// حولها، فتخرج مستطيلاتٌ فاتحة وسط واجهةٍ سوداء.
// ======================================================

const MONTHS = [
  "جانفي",
  "فيفري",
  "مارس",
  "أفريل",
  "ماي",
  "جوان",
  "جويلية",
  "أوت",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const COMPARISONS = [
  { value: "none", label: "بلا مقارنة" },
  { value: "previousMonth", label: "الشهر السابق" },
  { value: "sameMonthLastYear", label: "نفس الشهر السنة الماضية" },
  { value: "previousPeriod", label: "الفترة السابقة" },
];

const FILTER_LABEL: Record<string, string> = {
  academicYearId: "السنة",
  month: "الشهر",
  year: "السنة الميلادية",
  dateFrom: "من",
  dateTo: "إلى",
  educationStageId: "الطور",
  levelId: "المستوى",
  studyGroupId: "الفوج",
  subjectId: "المادة",
  teacherId: "الأستاذ",
  studentId: "الطالب",
  invoiceStatus: "حالة الفاتورة",
  paymentStatus: "حالة الدفعة",
  settlementStatus: "حالة التخليص",
  attendanceStatus: "حالة الحضور",
  paymentMethod: "طريقة الدفع",
};

const STATUS_OPTIONS: Record<string, { value: string; label: string }[]> = {
  invoiceStatus: [
    { value: "PENDING", label: "معلَّقة" },
    { value: "PARTIAL", label: "جزئية" },
    { value: "PAID", label: "مسدَّدة" },
    { value: "CANCELLED", label: "ملغاة" },
  ],
  paymentStatus: [
    { value: "ACTIVE", label: "نشطة" },
    { value: "CANCELLED", label: "ملغاة" },
  ],
  settlementStatus: [
    { value: "DRAFT", label: "مسوّدة" },
    { value: "CONFIRMED", label: "مؤكَّدة" },
    { value: "PAID", label: "مدفوعة" },
    { value: "CANCELLED", label: "ملغاة" },
  ],
  attendanceStatus: [
    { value: "PRESENT", label: "حاضر" },
    { value: "ABSENT", label: "غائب" },
    { value: "LATE", label: "متأخّر" },
    { value: "EXCUSED", label: "معذور" },
  ],
  paymentMethod: [
    { value: "CASH", label: "نقداً" },
    { value: "CARD", label: "بطاقة" },
    { value: "BANK_TRANSFER", label: "تحويل بنكي" },
  ],
};

/**
 * قائمةٌ منسدلة بشكل التطبيق.
 *
 * تُبنى بالأزرار واللوحة لا بـ`<select>`: عناصرُ `<option>` ترسمها
 * المنصّة، فلا يصل إليها تنسيقُ التطبيق مهما نُسّق الصندوق.
 */
const Dropdown = ({
  label,
  value,
  options,
  onSelect,
  icon,
}: {
  label: string;
  value?: string;
  options: { value: string; label: string }[];
  onSelect: (value: string) => void;
  icon?: ReactNode;
}) => {
  const [open, setOpen] = useState(false);

  const selected = options.find((option) => option.value === value);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={[
          "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition",
          selected && selected.value !== "none"
            ? "border-white/25 bg-white/10 text-white"
            : "border-white/10 bg-white/[0.03] text-white/60 hover:border-white/20 hover:text-white/80",
        ].join(" ")}
      >
        {icon}
        <span>{selected ? selected.label : label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open && (
        <>
          {/*
            حجابٌ يلتقط النقرَ خارج اللوحة.
            و`onBlur` وحده لا يكفي: النقرُ على خيارٍ داخل اللوحة
            يُطلق `blur` قبل `click` فتُغلق اللوحةُ ويُهمَل الاختيار.
          */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
            aria-hidden
          />

          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.duration.fast }}
            className="absolute right-0 top-11 z-50 min-w-44 overflow-hidden rounded-xl border border-white/10 bg-[#0a0f1a] p-1 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => {
                onSelect("");
                setOpen(false);
              }}
              className="block w-full rounded-lg px-3 py-2 text-right text-xs text-white/50 transition hover:bg-white/10 hover:text-white"
            >
              {label}
            </button>

            {options
              .filter((option) => option.value !== "none")
              .map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onSelect(option.value);
                    setOpen(false);
                  }}
                  className={[
                    "block w-full rounded-lg px-3 py-2 text-right text-xs transition",
                    option.value === value
                      ? "bg-white/15 font-bold text-white"
                      : "text-white/70 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  {option.label}
                </button>
              ))}
          </motion.div>
        </>
      )}
    </div>
  );
};

interface Props {
  meta?: ReportMeta;
  state: UseReportQuery;
}

export const FilterBar = ({ meta, state }: Props) => {
  const [advanced, setAdvanced] = useState(false);

  const supported = new Set(meta?.supportedFilters ?? []);
  const supports = (key: string) => supported.has(key);

  const { filters, setFilter, setFilters, setComparison, reset } = state;

  /*
   * الشهرُ والسنةُ يُضبطان معاً.
   *
   * الخادمُ يرفض شهراً بلا سنة (§58) وذلك صواب. فالواجهةُ لا تُرسل
   * الشهرَ وحده أصلاً: اختيارُه يُكمَل بسنة الفترة الحالية.
   */
  const currentYear = meta?.period.year ?? new Date().getFullYear();

  const advancedKeys = Object.keys(STATUS_OPTIONS).filter(supports);

  return (
    <div className="border-b border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-2 px-6 py-3">
        {/* السنة الدراسية — شارةٌ لا فلتر: يحدّدها الخادم */}
        {meta?.academicYear && (
          <span className="inline-flex h-9 items-center gap-2 rounded-xl bg-white/10 px-3 text-xs font-bold text-white">
            <CalendarRange className="h-3.5 w-3.5 text-white/50" aria-hidden />
            {meta.academicYear.name}
          </span>
        )}

        {supports("month") && (
          <Dropdown
            label="كل الأشهر"
            value={filters.month ? String(filters.month) : undefined}
            options={MONTHS.map((label, index) => ({
              value: String(index + 1),
              label,
            }))}
            onSelect={(value) =>
              value
                ? setFilters({ month: Number(value), year: currentYear })
                : setFilters({ month: undefined, year: undefined })
            }
          />
        )}

        {supports("dateFrom") && (
          <div className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-2.5">
            {/*
              `color-scheme: dark` يجعل المتصفّح يرسم أيقونةَ التقويم
              ولوحتَه بالسمة الداكنة. وبدونها تخرج أيقونةٌ سوداء على
              خلفيةٍ سوداء فلا تُرى.
            */}
            <input
              type="date"
              className="bg-transparent text-xs text-white/80 outline-none [color-scheme:dark]"
              value={String(filters.dateFrom ?? "")}
              onChange={(event) => setFilter("dateFrom", event.target.value)}
              aria-label="من تاريخ"
            />
            <span className="text-white/25">←</span>
            <input
              type="date"
              className="bg-transparent text-xs text-white/80 outline-none [color-scheme:dark]"
              value={String(filters.dateTo ?? "")}
              onChange={(event) => setFilter("dateTo", event.target.value)}
              aria-label="إلى تاريخ"
            />
          </div>
        )}

        {meta && (
          <Dropdown
            label="بلا مقارنة"
            value={meta.comparison?.mode ?? "none"}
            options={COMPARISONS}
            onSelect={(value) => setComparison(value || "none")}
            icon={
              <GitCompareArrows
                className="h-3.5 w-3.5 text-white/40"
                aria-hidden
              />
            }
          />
        )}

        <div className="flex-1" />

        {advancedKeys.length > 0 && (
          <button
            type="button"
            className={[
              "inline-flex h-9 items-center gap-2 rounded-xl border px-3 text-xs font-bold transition",
              advanced
                ? "border-white/25 bg-white/10 text-white"
                : "border-white/10 bg-white/[0.03] text-white/60 hover:text-white/80",
            ].join(" ")}
            onClick={() => setAdvanced((open) => !open)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
            مرشّحات متقدّمة
          </button>
        )}

        {state.activeCount > 0 && (
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-white/60 transition hover:border-rose-400/30 hover:text-rose-300"
            onClick={reset}
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
            تصفير
          </button>
        )}
      </div>

      {advanced && advancedKeys.length > 0 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: MOTION.duration.fast }}
          className="flex flex-wrap items-center gap-2 border-t border-white/10 px-6 py-3"
        >
          {advancedKeys.map((key) => (
            <Dropdown
              key={key}
              label={FILTER_LABEL[key]}
              value={String(filters[key as keyof typeof filters] ?? "")}
              options={STATUS_OPTIONS[key]}
              onSelect={(value) => setFilter(key, value)}
            />
          ))}

          {/*
            فلاترُ الكيانات (فوج، مادة، أستاذ) تُضبط بالتنقيب من
            الرسوم — §40 — لا بقوائمَ منسدلة.

            وقوائمُها تحتاج جلبَ كلّ الأفواج والمواد والأساتذة:
            ثلاثةُ نداءاتٍ على كلّ شاشة لملء قوائمَ قد لا تُفتح.
            والضبطُ يجيء من حيث يكون للمستخدم سياق — رسمٌ ينقره.
          */}
          <p className="text-[11px] text-white/30">
            فلاتر الفوج والمادة والأستاذ تُضبط بالنقر على الرسوم
          </p>
        </motion.div>
      )}

      {/* شرائحُ الفلاتر النشطة — §69 */}
      {state.activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/10 px-6 py-2.5">
          {Object.entries(filters).map(([key, value]) => (
            <motion.button
              key={key}
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: MOTION.duration.fast }}
              type="button"
              className="group inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] py-1 pl-2 pr-3 text-[11px] transition hover:border-rose-400/30 hover:bg-rose-400/10"
              onClick={() => setFilter(key, undefined)}
              aria-label={`إزالة فلتر ${FILTER_LABEL[key] ?? key}`}
            >
              <span className="text-white/40">{FILTER_LABEL[key] ?? key}</span>
              <span className="font-bold text-white">
                {key === "month" ? MONTHS[Number(value) - 1] : String(value)}
              </span>
              <X
                className="h-3 w-3 text-white/30 transition group-hover:text-rose-300"
                aria-hidden
              />
            </motion.button>
          ))}
        </div>
      )}
    </div>
  );
};
