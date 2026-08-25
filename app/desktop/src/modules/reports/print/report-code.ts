import { SCREENS } from "../reports.catalog";
import type { ReportResponse } from "../reports.api";

// ======================================================
// رمزُ ورقة التقرير — ثلاثَ عشرةَ خانةً رقمية
//
// نفسُ شكل رموز المشروع كلِّها: الإيصالُ والدفعةُ والكشف كلُّها
// ثلاثَ عشرةَ خانة (`document-number.ts`)، فتُقرأ بماسحٍ واحد
// وتُطبع بنفس عرض الباركود.
//
// ------------------------------------------------------
// لماذا يُشتقّ ولا يُولَّد عشوائياً
// ------------------------------------------------------
//
// رموزُ المستندات عشوائيةٌ لأنّ لها صفّاً في القاعدة يحفظها ويحرسه
// قيدُ `@@unique`. والتقريرُ لا صفَّ له — §1 يمنع نموذجاً للتقارير،
// وهو محقّ: التقريرُ مشتقٌّ من البيانات التشغيلية لا كيانٌ يُخزَّن.
//
// ورقمٌ عشوائيٌّ بلا تخزينٍ لا يُمسح: المسحةُ تقرأ رقماً لا يدلّ على
// شيء. فالرمزُ هنا **يحمل هويّتَه في خاناته** — يُفكّ فيُعرف أيُّ
// تقريرٍ وأيُّ فترة، بلا جدولٍ ولا هجرة.
//
// ------------------------------------------------------
// البنية
// ------------------------------------------------------
//
//   7 | RR | YYYY | MM | EEEE
//   1 | 2  |  4   | 2  |  4     = 13
//
//   7     بادئةُ «ورقةُ تقرير»
//   RR    فهرسُ التقرير في السجلّ (00–99)
//   YYYY  سنةُ الفترة، أو 0000 إن لم تُحدَّد
//   MM    شهرُها، أو 00
//   EEEE  بصمةُ الكيان للأوراق المفصّلة، أو 0000
//
// والبنيةُ نفسُها تعمل عملَ خانةِ تحقّق: رمزُ كشفٍ عشوائيٌّ يُفكّ
// إلى فهرسِ تقريرٍ لا وجودَ له غالباً، فيُرفض ويُجرَّب كشفاً — وهو
// ما يفعله الماسحُ بالترتيب.
// ======================================================

const REPORT_PREFIX = "7";

const pad = (value: number, width: number) =>
  String(Math.max(0, Math.floor(value))).padStart(width, "0").slice(-width);

/**
 * بصمةُ المعرّف — أربعُ خاناتٍ من مجموعٍ تراكمي.
 *
 * ولا تعرّف الكيانَ وحدها: أربعُ خاناتٍ عشرةُ آلاف احتمال، والمؤسسةُ
 * قد يكون فيها ألفُ طالب. لكنّها تكفي **مع** فهرس التقرير: الماسحُ
 * يعرف أنّها ورقةُ طالب، فيبحث في الطلبة عن صاحب هذه البصمة.
 *
 * والدالّةُ نفسُها في الماسح — ولذلك تُصدَّر: تعريفُها مرّتين يجعلها
 * تتباعد عند أوّل تعديل، فلا يُفكّ ما شُفِّر.
 */
export const entityFingerprint = (id: string): number => {
  let sum = 0;

  for (let index = 0; index < id.length; index += 1) {
    /* 31 عددٌ أوّليّ — التوزيعُ به أقلُّ تصادماً من الجمع المجرّد */
    sum = (sum * 31 + id.charCodeAt(index)) % 10000;
  }

  return sum;
};

export const reportCode = (report: ReportResponse): string => {
  const index = SCREENS.findIndex(
    (screen) => screen.key === report.meta.report,
  );

  const entity = report.detail?.id;

  return [
    REPORT_PREFIX,
    pad(index < 0 ? 99 : index, 2),
    pad(report.meta.period.year ?? 0, 4),
    pad(report.meta.period.month ?? 0, 2),
    pad(entity ? entityFingerprint(entity) : 0, 4),
  ].join("");
};

export interface DecodedReportCode {
  reportKey: string;
  year: number | null;
  month: number | null;
  fingerprint: number | null;
}

/**
 * فكُّ الرمز — أو `null` إن لم يكن رمزَ تقرير.
 *
 * والرفضُ صامت: الماسحُ يجرّب هذا أوّلاً ثمّ يجرّب غيرَه، فرقمُ
 * كشفٍ يمرّ من هنا ويُرفض ثمّ يُفتح كشفاً.
 */
export const decodeReportCode = (raw: string): DecodedReportCode | null => {
  const text = raw.trim();

  if (!/^\d{13}$/.test(text) || text[0] !== REPORT_PREFIX) return null;

  const index = Number(text.slice(1, 3));
  const screen = SCREENS[index];

  if (!screen) return null;

  const year = Number(text.slice(3, 7));
  const month = Number(text.slice(7, 9));
  const fingerprint = Number(text.slice(9, 13));

  return {
    reportKey: screen.key,
    year: year > 0 ? year : null,
    month: month > 0 ? month : null,
    fingerprint: fingerprint > 0 ? fingerprint : null,
  };
};
