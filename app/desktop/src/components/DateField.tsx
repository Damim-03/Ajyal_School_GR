import { MONTHS } from "../modules/finance/finance.api";

/**
 * حقل تاريخ — يوم · شهر · سنة.
 *
 * بديلٌ عن `<input type="date">` لسببين، كلاهما وقع فعلاً:
 *
 * **الصيغة تتبع لغة النظام لا لغة التطبيق.** فعلى ويندوز إنجليزي
 * يظهر الحقل `mm/dd/yyyy` داخل واجهةٍ عربية بالكامل. ومن أراد
 * «13 فيفري» كتب 13 في خانة الشهر فرُفض، وهو لا يعلم لماذا.
 *
 * **والكتابة تُنتج تواريخ وسيطة صالحة.** كاتبُ سنة 2026 يمرّ على
 * 0002 ثمّ 0020 ثمّ 0202 — وكلُّها تواريخ سليمة يقبلها الحقل ويُطلق
 * لها حدث تغيير. فمن ربط الحفظ بالتغيير حفظ أربع مرّات بأربعة
 * تواريخ خاطئة قبل أن يبلغ الصحيح.
 *
 * ثلاثُ قوائم مقفلة تُنهي الأمرين: لا صيغة تُقرأ خطأً، ولا قيمة
 * وسيطة تُلتقط. والقيمة المخرَجة `YYYY-MM-DD` دائماً.
 */

/** عدد أيام الشهر — فيفري يتبع الكبس */
const daysInMonth = (year: number, month: number) =>
  new Date(Date.UTC(year, month, 0)).getUTCDate();

const pad = (n: number) => String(n).padStart(2, "0");

export function DateField({
  value,
  onChange,
  tone = "#7dd3fc",
  yearsBack = 15,
  yearsAhead = 5,
  compact,
}: {
  /** `YYYY-MM-DD` أو فراغ */
  value: string;
  onChange: (value: string) => void;
  tone?: string;
  yearsBack?: number;
  yearsAhead?: number;
  compact?: boolean;
}) {
  const now = new Date();

  const parsed = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  const year = parsed ? Number(parsed[1]) : now.getFullYear();
  const month = parsed ? Number(parsed[2]) : now.getMonth() + 1;
  const day = parsed ? Number(parsed[3]) : now.getDate();

  /**
   * 31 جانفي ثمّ اختيار فيفري = 31 فيفري.
   * يُقصّ اليوم إلى آخر الشهر بدل أن يُنتج تاريخاً لا وجود له.
   */
  const emit = (y: number, m: number, d: number) =>
    onChange(`${y}-${pad(m)}-${pad(Math.min(d, daysInMonth(y, m)))}`);

  const years = Array.from(
    { length: yearsBack + yearsAhead + 1 },
    (_, i) => now.getFullYear() - yearsBack + i,
  );

  const box = compact
    ? "rounded border border-white/10 bg-black/30 px-1.5 py-1 text-[11px] font-bold outline-none transition focus:border-white/40"
    : "rounded-lg border border-white/10 bg-black/30 px-2.5 py-2 text-sm font-bold outline-none transition focus:border-white/30";

  return (
    <div className="flex items-center gap-1.5" style={{ accentColor: tone }}>
      <select
        value={day}
        onChange={(e) => emit(year, month, Number(e.target.value))}
        className={`${box} shrink-0`}
        title="اليوم"
        dir="ltr"
      >
        {Array.from({ length: daysInMonth(year, month) }, (_, i) => i + 1).map(
          (d) => (
            <option key={d} value={d} className="bg-[#0a0f1a]">
              {d}
            </option>
          ),
        )}
      </select>

      <select
        value={month}
        onChange={(e) => emit(year, Number(e.target.value), day)}
        className={`${box} min-w-0 flex-1`}
        title="الشهر"
      >
        {MONTHS.map((name, i) => (
          <option key={name} value={i + 1} className="bg-[#0a0f1a]">
            {name}
          </option>
        ))}
      </select>

      <select
        value={year}
        onChange={(e) => emit(Number(e.target.value), month, day)}
        className={`${box} shrink-0`}
        title="السنة"
        dir="ltr"
      >
        {years.map((y) => (
          <option key={y} value={y} className="bg-[#0a0f1a]">
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}

/** اليوم بتوقيت الجهاز — لا UTC: بعد منتصف الليل يختلفان يوماً */
export const todayIso = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
