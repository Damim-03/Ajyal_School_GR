import { useNavigate } from "react-router-dom";

import { BarcodeScanner } from "../../../components/shared/BarcodeScanner";
import { NOT_FOUND, resolveScan, type ScanTarget } from "../scan-target";

// ======================================================
// ماسحُ التقارير — نفسُ نافذة مسح الكشوف
//
// الشكلُ والسلوكُ في `components/shared/BarcodeScanner`، و**ما يُبحث
// عنه** في `modules/reports/scan-target` — يشترك فيه هذا الماسحُ
// والبحثُ العامّ في الشريط العلوي، فلا يُعرف رمزٌ في موضعٍ ويُجهل
// في آخر.
//
// والغرضُ ما وُجد له مسحُ الكشوف: ورقةٌ على الطاولة تُفتح بمسحةٍ بدل
// أن يُقرأ رقمُها ويُكتب في حقلٍ ثمّ يُبحث بخمسة مرشِّحات.
// ======================================================

export const ReportScanner = ({ accent = "#86efac" }: { accent?: string }) => {
  const navigate = useNavigate();

  return (
    <BarcodeScanner<ScanTarget>
      accent={accent}
      onFound={(target) => navigate(target.to)}
      resolve={resolveScan}
      copy={{
        button: "مسح",
        buttonTitle: "افتح تقريراً أو سجلّاً بمسح الباركود المطبوع",
        title: "مسح رمز التقرير",
        subtitle: "الورقة تفتح تقريرها بفترته وفلاتره",
        steps: [
          "وجّه القارئ إلى الباركود أعلى الورقة أو في عمود «الرمز»",
          "امسح — أو اكتب الرمز المطبوع تحته",
          "يُفتح التقرير أو السجلّ مباشرة",
        ],
        placeholder: "امسح الباركود، أو اكتب الرمز أو رقم التخليص…",
        action: "افتح",
        notFound: NOT_FOUND,
        hint: "الرمز مكتوبٌ تحت الباركود في ترويسة الورقة",
      }}
    />
  );
};
