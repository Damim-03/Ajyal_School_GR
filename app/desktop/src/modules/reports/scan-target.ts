/**
 * **حلُّ ما يُمسح إلى وجهة — دالّةٌ واحدة يقرؤها كلُّ ماسحٍ في التطبيق.**
 *
 * كانت تعيش داخل `components/ReportScanner.tsx` خاصّةً به. ثمّ صار للبحث
 * العامّ ماسحٌ ثانٍ يريد الشيءَ نفسَه بالضبط: ورقةٌ على الطاولة تُفتح
 * شاشتُها بمسحة. ونسخُها كان يعني أنّ أوّلَ رمزٍ جديد يُضاف يُعرَف في
 * موضعٍ ويُجهَل في آخر — وأنّ إصلاحاً يقع هنا لا يبلغ هناك.
 *
 * فانتقلت إلى ملفٍّ لا مكوّنَ فيه: `ReportScanner` يقول **كيف تُعرض
 * النافذة**، وهذا يقول **ما يُبحث عنه**، ويشتركان في الثاني.
 *
 * وأربعةُ مدخلاتٍ يقبلها:
 *
 *   • **رمزُ ورقة تقرير** — ثلاثَ عشرةَ خانةً رقمية كرموز المشروع
 *     كلِّها. يُفكّ إلى تقريرٍ وفترةٍ وبصمةِ كيان بلا نداءٍ للخادم.
 *   • **رقمُ تخليص** — `STL-2026-0003` → تفصيلُ ذلك التخليص.
 *   • **رقمُ طالب** — `2026000013` → ملفُّ الطالب.
 *   • **رقمُ فاتورة أو دفعة أو إيصال** → تقريرُها بالرقم مفلتراً.
 */

import { apiClient } from "../../core/api/client";
import { decodeReportCode, entityFingerprint } from "./print/report-code";

export interface ScanTarget {
  /** المسارُ الذي يُفتح */
  to: string;
  /** ما يُعرض في رسالة النجاح */
  label: string;
}

/*
 * أنماطُ ما يُمسح — تُجرَّب بالترتيب، والأخصُّ أوّلاً.
 *
 * ورمزُ ورقة التقرير أوّلُها لأنّ بنيتَه تعمل عملَ خانة تحقّق
 * (انظر `report-code.ts`)، فيُرفض ما ليس تقريراً بلا نداء.
 */
const SETTLEMENT = /^STL-\d{4}-\d+$/i;
const STUDENT_NUMBER = /^\d{8,12}$/;

export const NOT_FOUND =
  "لا يطابق هذا الرمز أيَّ تقرير أو سجلّ — تحقّق منه أو اكتبه يدوياً.";

/**
 * حلُّ ما مُسح إلى وجهة.
 *
 * والبحثُ في الخادم آخرُ ما يُجرَّب: الأنماطُ المعروفة تُحلّ محلّياً
 * بلا نداء، فمسحةُ ورقةٍ تفتح شاشتَها فوراً. ولا يُسأل الخادمُ إلا
 * عن رقمٍ لا يُعرف نوعُه.
 */
export const resolveScan = async (raw: string): Promise<ScanTarget | null> => {
  const text = raw.trim();

  if (!text) return null;

  /*
   * رمزُ ورقة التقرير — ثلاثَ عشرةَ خانةً رقمية كبقيّة رموز المشروع.
   *
   * ويُجرَّب أوّلاً لأنّ بنيتَه تعمل عملَ خانة تحقّق: رمزُ كشفٍ
   * عشوائيٌّ يُفكّ إلى فهرسِ تقريرٍ لا وجودَ له فيُرفض في الحال،
   * فلا نداءَ إلى الخادم لِما ليس تقريراً.
   */
  const decoded = decodeReportCode(text);

  if (decoded) {
    const query = new URLSearchParams();

    if (decoded.year) query.set("year", String(decoded.year));
    if (decoded.month) query.set("month", String(decoded.month));

    /*
     * البصمةُ تعني ورقةَ كيانٍ بعينه — فيُبحث عنه داخل تقريره.
     * وأربعُ خاناتٍ لا تعرّفه وحدها، لكنّها تكفي مع معرفةِ التقرير.
     */
    if (decoded.fingerprint !== null) {
      const found = await resolveByFingerprint(
        decoded.reportKey,
        decoded.fingerprint,
      );

      if (found) return found;
    }

    const suffix = query.toString();

    return {
      to: `/reports/${decoded.reportKey}${suffix ? `?${suffix}` : ""}`,
      label: "التقرير",
    };
  }

  /* رقمُ تخليص */
  if (SETTLEMENT.test(text)) {
    return resolveByServer("settlements", text, "settlementNumber");
  }

  /* رقمُ طالب */
  if (STUDENT_NUMBER.test(text)) {
    return resolveByServer("students", text, "studentNumber");
  }

  /*
   * ما بقي: يُجرَّب فاتورةً ثمّ دفعةً ثمّ إيصالاً.
   *
   * والمحاولاتُ متتابعة لا متوازية: أوّلُ ما يُصاب يُرجع، والغالبُ
   * أن يكون الأوّل — فلا تُطلق ثلاثةُ نداءاتٍ لجوابٍ واحد.
   */
  for (const [report, column] of [
    ["invoices", "invoiceNumber"],
    ["payments", "paymentNumber"],
    ["receipts", "receiptNumber"],
  ] as const) {
    const found = await resolveByServer(report, text, column);

    if (found) return found;
  }

  return null;
};

/**
 * البحثُ عن كيانٍ ببصمة معرّفه داخل تقريرٍ معلوم.
 *
 * والبصمةُ أربعُ خانات، فقد تُصيب أكثرَ من صفّ. وأوّلُ مطابقٍ
 * يُرجَع: التصادمُ نادرٌ في مؤسسةٍ من مئات الطلبة، والبديلُ —
 * رفضُ المسحة عند أوّل التباس — يُفقد الميزةَ لأجل حالةٍ لا تكاد
 * تقع.
 */
const resolveByFingerprint = async (
  report: string,
  fingerprint: number,
): Promise<ScanTarget | null> => {
  try {
    const { data } = await apiClient.get(`/reports/v2/${report}`, {
      params: { pageSize: 500 },
    });

    const rows = (data?.data?.table?.rows ?? []) as Record<string, unknown>[];

    const match = rows.find(
      (row) => entityFingerprint(String(row.id ?? "")) === fingerprint,
    );

    if (!match) return null;

    return { to: `/reports/${report}/${String(match.id)}`, label: "السجلّ" };
  } catch {
    return null;
  }
};

/**
 * البحثُ عن صفٍّ في تقريرٍ بقيمة عمود.
 *
 * ولا نقطةَ بحثٍ خاصّة في الخادم: التقاريرُ مرقَّمة ومفلترة سلفاً،
 * فتُجلب صفحةٌ واسعة ويُبحث فيها. والحجمُ محدودٌ لأنّ المسحَ يقع
 * على سجلٍّ قريب — ومن مسح ورقةً عمرُها سنةٌ يكتب رقمَها يدوياً.
 */
const resolveByServer = async (
  report: string,
  needle: string,
  column?: string,
): Promise<ScanTarget | null> => {
  try {
    const { data } = await apiClient.get(`/reports/v2/${report}`, {
      params: { pageSize: 200 },
    });

    const rows = (data?.data?.table?.rows ?? []) as Record<string, unknown>[];

    const match = rows.find((row) => {
      if (column) return String(row[column] ?? "") === needle;

      /* بلا عمودٍ محدَّد: يُطابَق آخرُ المعرّف كما يحمله رمزُ الورقة */
      const id = String(row.id ?? "");

      return id.toUpperCase().endsWith(needle.toUpperCase());
    });

    if (!match) return null;

    const id = String(match.id ?? "");

    /* التقاريرُ الثلاثة لها شاشاتُ تفصيل؛ وما عداها يُفتح مفلتراً */
    if (["students", "teachers", "settlements"].includes(report) && id) {
      return { to: `/reports/${report}/${id}`, label: "السجلّ" };
    }

    return { to: `/reports/${report}`, label: "التقرير" };
  } catch {
    return null;
  }
};
