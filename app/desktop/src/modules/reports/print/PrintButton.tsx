import { Printer } from "lucide-react";
import { useState } from "react";

import { SheetPreview } from "../../../components/print/SheetPreview";
import type { ReportResponse } from "../reports.api";
import { ReportSheet } from "./ReportSheet";
import "./report-sheet.css";

// ======================================================
// زرُّ الطباعة — يفتح معاينةَ الكشوف نفسَها
//
// كنتُ بنيتُ نافذةَ معاينةٍ موازية للتقارير، وكانت خطأً: `SheetPreview`
// يملك كلَّ ما احتاجه التقريرُ وأكثر — A4 أفقيةً بمقاسها الحقيقي،
// وتصغيراً يُدخل الورقةَ النافذةَ بلا تشويه، واختيارَ طابعةٍ محفوظاً،
// و**اختيارَ الأوراق**: كلَّها أو ورقةً بعينها.
//
// واختيارُ الأوراق هو ما طُلب بـ«ورقة أم اثنتان»: تُختار الورقةُ
// فتُخفى أخواتُها عن المعاينة وعن الطابعة معاً، بلا مربّع «من… إلى…»
// في حوار النظام. وهو أدقُّ من عدّاد نسخٍ كتبتُه.
//
// والطباعةُ فيه تمضي ورقةً ورقة وتقف بينهما — فمن أراد نسختين طبع
// الورقةَ ثمّ أعادها. ونسخُ الورقة الواحدة أمرُ الطابعة لا أمرُنا.
// ======================================================

interface Props {
  report: ReportResponse;
  title: string;
  disabled?: boolean;
}

export const PrintButton = ({ report, title, disabled }: Props) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-xs font-bold text-white/60 transition hover:border-white/25 hover:text-white disabled:opacity-40"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={disabled ? "انتظر تحميل التقرير" : "معاينة الورقة قبل طباعتها"}
      >
        <Printer className="h-3.5 w-3.5" aria-hidden />
        معاينة وطباعة
      </button>

      {open && (
        <SheetPreview
          title={title}
          subtitle={`${report.meta.period.label}${
            report.meta.academicYear ? ` · ${report.meta.academicYear.name}` : ""
          }`}
          onClose={() => setOpen(false)}
        >
          <ReportSheet report={report} title={title} />
        </SheetPreview>
      )}
    </>
  );
};
