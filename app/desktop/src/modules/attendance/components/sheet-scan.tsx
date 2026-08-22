/**
 * مسحُ رمز الكشف — النافذةُ المشتركة بنصوص الكشوف ودالّةِ بحثها.
 *
 * الشكلُ والسلوك في `components/shared/BarcodeScanner`؛ وهذا يقول ما
 * يُبحث عنه لا كيف تُعرض النافذة. وتقبل مدخلين:
 *
 *   • **رمز الكشف** كما هو تحت الباركود — يفتح كشفه أيّاً كانت مادّتُه
 *     وفوجُه، فيتبعه الاختيارُ كلُّه: السنة والمرشِّحات والكشف.
 *   • **رقم الكشف** («2») — اختصارٌ داخل الإسناد المختار وحده، لأنّ
 *     الرقم يتكرّر: لكلّ إسنادٍ كشفٌ رقمُه 2.
 */

import { BarcodeScanner } from "../../../components/shared/BarcodeScanner";
import { findSheetByCode, getSheet, type Sheet } from "../attendance.api";

/**
 * ما نوعُ ما دخل الحقل؟
 *
 *   • خانةٌ أو خانتان  → **رقمُ الكشف** داخل الإسناد المختار («2»).
 *   • أرقامٌ أطول      → **رمزُ الورقة** المطبوع تحت الباركود.
 *   • حروفٌ وأرقام     → معرّفٌ داخلي — ورقةٌ طُبعت قبل اعتماد الرمز
 *                        فباركودُها يحمل الـcuid؛ تبقى مقروءةً.
 */
const kindOf = (text: string) =>
  /^\d{1,2}$/.test(text) ? "number" : /^\d+$/.test(text) ? "code" : "id";

const NOT_FOUND = "لا وجود لكشف بهذا الكود بار — الرجاء التحقّق منه.";

export function SheetScanner({
  sheets,
  onFound,
  accent,
  busy = false,
}: {
  /** كشوف الإسناد المختار — للاختصار بالرقم */
  sheets: { id: string; number: number }[];
  onFound: (sheet: Sheet) => void;
  accent: string;
  /** الانتقال ما يزال جارياً بعد مسحةٍ ناجحة */
  busy?: boolean;
}) {
  return (
    <BarcodeScanner<Sheet>
      accent={accent}
      busy={busy}
      onFound={onFound}
      copy={{
        button: "مسح الباركود",
        buttonTitle: "افتح كشفاً بمسح الباركود المطبوع على ورقته",
        title: "مسح رمز الكشف",
        subtitle: "الورقة تفتح كشفها — بلا اختيار مرشِّحات",
        placeholder: "امسح الباركود، أو اكتب الرمز أو رقم الكشف…",
        action: "افتح الكشف",
        notFound: NOT_FOUND,
        hint: "الرمز مكتوبٌ تحت الباركود",
        steps: [
          <>
            وجّه القارئ إلى <span className="font-bold text-white/85">الباركود المطبوع</span> أسفل
            سطر «حُرِّر في» في ترويسة الورقة.
          </>,
          <>القارئ يكتب الرمز في الحقل أدناه من نفسه ثمّ يُرسله — لا تضغط شيئاً.</>,
          <>
            تُغلق هذه النافذة ويُفتح الكشف بمادّته وفوجه وأستاذه — وتبدأ تدوين ما كتبه
            الأستاذ بالقلم.
          </>,
        ],
      }}
      resolve={async (text) => {
        const kind = kindOf(text);

        if (kind === "number") {
          const found = sheets.find((s) => s.number === Number(text));

          return found ? await getSheet(found.id) : null;
        }

        return kind === "code" ? await findSheetByCode(text) : await getSheet(text);
      }}
    />
  );
}
