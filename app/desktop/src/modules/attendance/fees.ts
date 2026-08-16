import type { Invoice } from "../finance/finance.api";
import type {
  AttendanceRow,
  AttendanceStatus,
  Sheet,
  SheetSession,
} from "./attendance.api";
import { isoDate, MONTHS } from "./period";

/**
 * منطق كشف الحقوق الشهري — دوالُّ خالصة بلا شبكة.
 *
 * الكشف يجمع مصدرين لا يلتقيان في قاعدة البيانات:
 *
 *   • **الحصص** تأتي من كشف الحضور (`AttendanceSheet`) — وحدةٌ إدارية
 *     مرقَّمة «الشهر 4» تملك أعمدتها، وقد تمتدّ على شهرين تقويميين.
 *   • **المال** يأتي من `Invoice` ومفتاحها `(تسجيل + شهر تقويمي + سنة)`.
 *
 * فالربط بينهما لا مفرّ منه، وهو هنا صريحٌ مكتوبٌ في مكان واحد بدل أن
 * يكون افتراضاً مبعثراً في الشاشة: الشهر التقويمي للكشف هو شهر **أوّل
 * حصة فيه**. وتُعرض النتيجة على المستخدم ليصحّحها إن أخطأت.
 */

/**
 * مجال الكشف — من تاريخ أوّل حصة إلى تاريخ آخرها.
 *
 * وهذا هو ما يُعرض للمستخدم، لا اسمُ شهر. الكشف فترةُ اشتراكٍ تمتدّ
 * بقدر ما تباعدت حصصها: «الشهر الرابع» قد يبدأ في 03/12 وينتهي في
 * 07/01. فعرضُه «ديسمبر» يكذب على من يقرؤه، ويجعله يسأل عن حصص جانفي
 * الغائبة — وهي ليست غائبة، بل داخل هذا الكشف نفسه.
 */
export const sheetRange = (
  sessions: Pick<SheetSession, "sessionDate">[],
): { from: string; to: string } | null => {
  if (sessions.length === 0) return null;

  const dates = sessions.map((s) => isoDate(s.sessionDate)).sort();
  return { from: dates[0]!, to: dates[dates.length - 1]! };
};

/**
 * وصف المجال بكلمات — «36 يوماً على ديسمبر وجانفي».
 *
 * التاريخان وحدهما يقولان الحقيقة لكنّهما لا يشرحانها. والعبارة تكشف
 * ما يُساء فهمه: أنّ الكشف عبَر شهرين، فحصصُ جانفي ليست ضائعةً ولا
 * تخصّ كشفاً آخر.
 */
export const spanLabel = (range: { from: string; to: string }) => {
  const from = new Date(`${range.from}T00:00:00Z`);
  const to = new Date(`${range.to}T00:00:00Z`);

  const days = Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1;

  const months: string[] = [];
  const cursor = new Date(from);

  while (
    cursor.getUTCFullYear() < to.getUTCFullYear() ||
    (cursor.getUTCFullYear() === to.getUTCFullYear() &&
      cursor.getUTCMonth() <= to.getUTCMonth())
  ) {
    months.push(MONTHS[cursor.getUTCMonth()]!);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }

  return months.length > 1
    ? `${days} يوماً على ${months.join(" و")}`
    : `${days} يوماً في ${months[0]}`;
};

/**
 * الشهر التقويمي الذي تُطلب فيه حقوق هذا الكشف — من أوّل حصة.
 *
 * هذا ربطٌ بالفاتورة لا وصفٌ للكشف: `Invoice` مفتاحها `(شهر + سنة)`
 * فلا بدّ من شهرٍ واحد تُقيَّد فيه حقوق فترةٍ قد تمتدّ على شهرين.
 * وأوّلُ حصةٍ هي القاعدة لأنّ الفترة تُفتح بها.
 */
export const invoicePeriodOf = (
  sessions: Pick<SheetSession, "sessionDate">[],
): { month: number; year: number } | null => {
  const range = sheetRange(sessions);
  if (!range) return null;

  const date = new Date(`${range.from}T00:00:00Z`);
  return { month: date.getUTCMonth() + 1, year: date.getUTCFullYear() };
};

/**
 * قاعدة العدّ — تُكتب مرّةً واحدة ويقرأ منها كل كشف.
 *
 * كانت مبعثرةً في ثلاثة ملفات بثلاث إجاباتٍ مختلفة عن السؤال نفسه:
 * كشف الحضور يعدّ الحاضر وحده، وكشف الحقوق يعدّ كل من ليس غائباً،
 * والخادم يعدّ الحاضر والمتأخّر. فكان العمود الذي يوقّع عليه الأستاذ
 * لا يساوي العدد الذي بُني عليه مستحقُّه في الكشف التقديري، والفرقُ
 * لا يظهر في أيّ عمودٍ مطبوع فلا يمكن مراجعته على الورقة.
 *
 * والقاعدة (قرار الإدارة — 2026-08-15):
 *
 *   • حضورٌ = PRESENT أو LATE. المتأخّر جلس الحصة فأخذها.
 *   • غيابٌ = ABSENT أو EXCUSED. المعذور لم يحضر، وعذرُه شأنٌ إداري
 *     لا يُدخله في العدّ.
 *   • والخانة الفارغة ليست غياباً — لم تُدوَّن بعد، فلا تُحسب طرفاً.
 *
 * ومقابلُها في الخادم `gatherSettlementFacts` في `settlement.service.ts`،
 * فما يُغيَّر هنا يُغيَّر هناك وإلّا عاد الاختلاف.
 */
export const isAttended = (status: AttendanceStatus) =>
  status === "PRESENT" || status === "LATE";

/**
 * الحصص التي تدخل العدّ — المنجزة وحدها.
 *
 * المجدولة لم تُدرَّس بعد والملغاة لن تُدرَّس، فلا تُحمَّل على الطالب
 * غياباً ولا على الأستاذ حصة. وهو ما يفعله الخادم أصلاً حين يخلّص
 * (`status === "COMPLETED"`)، فالورقة تطابقه.
 */
export const heldSessions = <T extends Pick<SheetSession, "status">>(
  sessions: T[],
): T[] => sessions.filter((session) => session.status === "COMPLETED");

/**
 * عدد الحصص التي حضرها الطالب وغابها **داخل هذا الكشف**.
 *
 * تُمرَّر إليها حصصٌ مصفّاةٌ بـ`heldSessions` — لا تصفّي بنفسها لأنّ
 * الشاشة تعرض أعمدة الحصص كلّها وتعدّ المنجزة وحدها.
 */
export const attendanceOf = (
  enrollmentId: string,
  sessions: Pick<SheetSession, "id">[],
  cells: Map<string, AttendanceRow>,
) => {
  let attended = 0;
  let absent = 0;
  let blank = 0;

  for (const session of sessions) {
    const record = cells.get(`${enrollmentId}|${session.id}`);

    if (!record) blank++;
    else if (isAttended(record.status)) attended++;
    else absent++;
  }

  return { attended, absent, blank };
};

/**
 * حالة الحقوق كما تُكتب في الورقة.
 *
 * الفاتورة الملغاة ليست حقاً على الطالب، فهي كغيابها تماماً — ولذلك
 * تُستبعد قبل الوصول إلى هنا لا تُعالج بحالةٍ رابعة.
 */
export type FeeState = "PAID" | "PARTIAL" | "DUE" | "NONE";

export const feeStateOf = (invoice: Invoice | undefined): FeeState => {
  if (!invoice) return "NONE";
  if (invoice.status === "PAID") return "PAID";
  if (invoice.status === "PARTIAL") return "PARTIAL";
  return "DUE";
};

export const FEE_LABEL: Record<FeeState, string> = {
  PAID: "خالص",
  PARTIAL: "جزئي",
  DUE: "غير خالص",
  NONE: "لا فاتورة",
};

/** ما يُطبع في عمود «الحالة» — الفارغ يُترك فارغاً كما في الورقة */
export const FEE_PRINT: Record<FeeState, string> = {
  PAID: "خالص",
  PARTIAL: "جزئي",
  DUE: "",
  NONE: "",
};

export const FEE_TONE: Record<FeeState, { bg: string; fg: string }> = {
  PAID: { bg: "rgba(134,239,172,0.14)", fg: "#86efac" },
  PARTIAL: { bg: "rgba(252,211,77,0.14)", fg: "#fcd34d" },
  DUE: { bg: "rgba(251,113,133,0.12)", fg: "#fda4af" },
  NONE: { bg: "rgba(255,255,255,0.06)", fg: "rgba(255,255,255,0.4)" },
};

/**
 * تاريخ الدفع الذي يُكتب في الورقة — آخر دفعةٍ **نشطة**.
 *
 * الملغاة تبقى في `paymentInvoices` للتدقيق، فلو أُخذ آخرُ صفٍّ مطلقاً
 * لظهر تاريخُ دفعةٍ أُلغيت على كشفٍ يقول «خالص».
 */
export const paidOnOf = (invoice: Invoice | undefined): string | null => {
  const active = (invoice?.paymentInvoices ?? []).filter(
    (pi) => pi.payment.status === "ACTIVE",
  );

  if (active.length === 0) return null;

  const dates = active.map((pi) => pi.payment.paymentDate).sort();
  return dates[dates.length - 1]!;
};

/** 2026-01-13T…Z → 13/01/2026 — نفس صيغة الورقة */
export const feeDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
};

/**
 * حالة امتلاء الكشف.
 *
 * ليست «انتهى الشهر» — الشهر لا ينتهي هنا ولا علاقة للتقويم بالأمر.
 * الكشف وعاءٌ تُرسَل إليه حصصٌ بعدد ما قرّرته المؤسسة، فيمتلئ حين
 * تصله كلُّها ويُدوَّن حضورُ كلِّ طالبٍ في كلٍّ منها. وقد يمتلئ في
 * ثلاثة أسابيع وقد يمتدّ على شهرين — والفرق لا يُقرأ من التقويم.
 */
export interface SheetFilling {
  /** الحصص المقرَّرة للكشف */
  planned: number;
  /** ما وصله منها فعلاً (بلا الملغاة) */
  arrived: number;
  /** ما لم يصل بعد */
  awaited: number;
  /** خانات حضورٍ لم تُدوَّن */
  undated: number;
  full: boolean;
}

export const fillingLabel = (filling: SheetFilling) => {
  if (filling.full) return "امتلأ ودُوِّن حضوره";

  const parts: string[] = [];
  if (filling.awaited > 0) parts.push(`بقيت ${filling.awaited} حصة`);
  if (filling.undated > 0) parts.push(`${filling.undated} خانة لم تُدوَّن`);

  return parts.length > 0 ? `لم يمتلئ — ${parts.join("، ")}` : "لم يمتلئ بعد";
};

/** «الشهر: 4» — التسمية إن كُتبت، وإلّا الرقم وحده كما في الورقة */
export const sheetMonthLabel = (sheet: Pick<Sheet, "number" | "label">) =>
  sheet.label?.trim() || String(sheet.number);
