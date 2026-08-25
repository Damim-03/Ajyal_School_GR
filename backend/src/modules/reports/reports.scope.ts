import { Prisma } from "../../../generated/prisma";
import {
  DateRange,
  YearMonth,
  activeInvoice,
  activePayment,
  activeSettlement,
  activeTeacherPayment,
  endOfDay,
  monthRange,
  startOfDay,
} from "../../core/reporting";
import type { ReportQuery } from "./reports.filters";

// ======================================================
// من الفلاتر إلى شروط Prisma
//
// ------------------------------------------------------
// المحور: TeachingAssignment
// ------------------------------------------------------
//
// لا يحمل التسجيلُ مادّةً ولا فوجاً ولا سنةً. يحمل `teachingAssignmentId`
// وحده، والإسنادُ يحمل الأربعة: أستاذ + مادة + فوج + سنة. وكذلك
// الحصّةُ: لا أستاذَ فيها، بل `scheduleId` والجدولُ يشير إلى الإسناد.
//
// فكلُّ فلترٍ أكاديمي — مهما كان مصدرُه — ينتهي إلى شرطٍ واحدٍ على
// الإسناد. ولذلك `teachingAssignmentScope` دالّةٌ واحدة تُبنى مرّةً
// وتُركَّب في التسجيل والحضور والتخليص والكشف.
//
// وهذا ليس اختياراً معمارياً منّي بل بنيةُ المخطّط: §16 في المواصفة
// يقول إنّ الإسناد «الرابط التشغيلي بين الأستاذ والمادة والفوج»،
// والمخطّط يقول ذلك قبله.
//
// ------------------------------------------------------
// الزمن: كلُّ كيانٍ بزمنه — §58
// ------------------------------------------------------
//
//   الفاتورة → `month`/`year`         حقلا أعمالٍ صريحان
//   الدفعة   → `paymentDate`          لحظةُ دخول النقد
//   الحضور   → `session.sessionDate`  يومُ الحصّة
//   التخليص  → حصصُ كشفه              فترةُ العمل لا يومُ الحساب
//
// وتوحيدُها على مدىً واحد هو ما يجعل تقريرين لنفس الشهر يعرضان
// رقمين. فلا توجد دالّةٌ واحدة تبني «شرطَ الفترة»: لكلّ كيانٍ
// دالّتُه، واسمُها يقول أيَّ زمنٍ تقرأ.
// ======================================================

export type ResolvedPeriod = {
  yearMonth: YearMonth | null;
  range: DateRange | null;
};

/**
 * حلُّ الفترة من الفلاتر.
 *
 * الأولويةُ للشهر الصريح: من اختار «سبتمبر 2026» قصد حقلَي الأعمال،
 * ويُشتقّ منه المدى للكيانات المؤرَّخة باللحظة. ومن أعطى مدىً صريحاً
 * فلا شهرَ له — التقريرُ حينها عابرٌ للأشهر، وإجبارُه على شهرٍ واحد
 * يكذب.
 */
export const resolvePeriod = (query: Partial<ReportQuery>): ResolvedPeriod => {
  if (query.month !== undefined && query.year !== undefined) {
    const yearMonth = { year: query.year, month: query.month };
    return { yearMonth, range: monthRange(yearMonth) };
  }

  if (query.dateFrom || query.dateTo) {
    /*
     * مدىً مفتوحُ الطرف مشروع: «منذ بداية السنة حتى اليوم» يترك
     * `dateTo` فارغاً. فيُملأ الطرفُ الناقص بحدٍّ ثابت لا بـ`new
     * Date()` — لئلّا يتغيّر ناتجُ نفس الاستعلام بين نداءين
     * فتتعذّر مقارنةُ لقطتين.
     */
    const from = query.dateFrom
      ? startOfDay(query.dateFrom)
      : new Date(1970, 0, 1);
    const to = query.dateTo ? endOfDay(query.dateTo) : new Date(2999, 11, 31);

    return { yearMonth: null, range: { from, to } };
  }

  return { yearMonth: null, range: null };
};

const hasKeys = (value: object): boolean => Object.keys(value).length > 0;

// ======================================================
// المحور الأكاديمي
// ======================================================

/**
 * شرطُ الإسناد التدريسي — مصدرُ كلّ فلترٍ أكاديمي.
 *
 * المستوى والطور يُقرآن عبر الفوج: الفوجُ يحمل `levelId`، والمستوى
 * يحمل `educationStageId`. ولا يُشتقّ الطورُ من الطالب مباشرةً —
 * طالبٌ قد يُسجَّل في أفواجِ مستوياتٍ مختلفة، والاشتقاقُ من الطالب
 * يخلط تسجيلاتِه.
 */
export const teachingAssignmentScope = (
  query: Partial<ReportQuery>,
): Prisma.TeachingAssignmentWhereInput => {
  const where: Prisma.TeachingAssignmentWhereInput = {};

  if (query.academicYearId) where.academicYearId = query.academicYearId;
  if (query.teacherId) where.teacherId = query.teacherId;
  if (query.subjectId) where.subjectId = query.subjectId;
  if (query.studyGroupId) where.studyGroupId = query.studyGroupId;

  if (query.levelId || query.educationStageId) {
    where.studyGroup = {
      ...(query.levelId ? { levelId: query.levelId } : {}),
      ...(query.educationStageId
        ? { level: { educationStageId: query.educationStageId } }
        : {}),
    };
  }

  return where;
};

/** شرطُ التسجيل: الطالبُ مباشرةً، وما عداه عبر الإسناد */
export const enrollmentScope = (
  query: Partial<ReportQuery>,
): Prisma.StudentEnrollmentWhereInput => {
  const where: Prisma.StudentEnrollmentWhereInput = {};

  if (query.studentId) where.studentId = query.studentId;

  const assignment = teachingAssignmentScope(query);

  if (hasKeys(assignment)) where.teachingAssignment = assignment;

  return where;
};

// ======================================================
// الفواتير — زمنُها حقلا الأعمال
// ======================================================

export const invoiceScope = (
  query: Partial<ReportQuery>,
  options: { includeCancelled?: boolean } = {},
): Prisma.InvoiceWhereInput => {
  const where: Prisma.InvoiceWhereInput = options.includeCancelled
    ? {}
    : { ...activeInvoice };

  /*
   * حالةٌ صريحة تتقدّم على الاستثناء الافتراضي.
   *
   * من فلتر على `CANCELLED` قصدها. وليس هذا خرقاً لـ§52: القاعدةُ
   * أنّ الملغى لا يدخل **المجاميع المالية**، لا أنّه لا يُعرض —
   * وشاشةُ الإلغاءات (§38) تُبنى على هذا المسار بعينه.
   */
  if (query.invoiceStatus) where.status = query.invoiceStatus;

  const { yearMonth } = resolvePeriod(query);

  if (yearMonth) {
    where.month = yearMonth.month;
    where.year = yearMonth.year;
  }

  /*
   * السنةُ الدراسية على الفاتورة مباشرةً لا عبر الإسناد.
   *
   * الفاتورةُ تحمل `academicYearId` بنفسها، وقراءتُها منه أرخص —
   * وتتجنّب اشتراطاً على الإسناد يُسقط الفهرس.
   */
  if (query.academicYearId) where.academicYearId = query.academicYearId;

  const enrollment = enrollmentScope({ ...query, academicYearId: undefined });

  if (hasKeys(enrollment)) where.studentEnrollment = enrollment;

  return where;
};

/**
 * فواتيرُ الدَّين القديم — أقدمُ من فترة المرجع.
 *
 * الشرطُ على (سنة، شهر) لا على تاريخ: سنةٌ أقلّ، أو نفسُ السنة
 * وشهرٌ أقلّ. وكتابتُه على التواريخ كانت ستحتاج تحويلَ الحقلين
 * داخل الاستعلام فيسقط الفهرسُ على `[month, year]`.
 */
export const oldDebtScope = (
  query: Partial<ReportQuery>,
  reference: YearMonth,
): Prisma.InvoiceWhereInput => {
  const base = invoiceScope({ ...query, month: undefined, year: undefined });

  return {
    ...base,
    remaining: { gt: 0 },
    OR: [
      { year: { lt: reference.year } },
      { year: reference.year, month: { lt: reference.month } },
    ],
  };
};

// ======================================================
// الدفعات — زمنُها لحظةُ الدفع
// ======================================================

export const paymentScope = (
  query: Partial<ReportQuery>,
  options: { includeCancelled?: boolean } = {},
): Prisma.PaymentWhereInput => {
  const where: Prisma.PaymentWhereInput = options.includeCancelled
    ? {}
    : { ...activePayment };

  if (query.paymentStatus) where.status = query.paymentStatus;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

  const { range } = resolvePeriod(query);

  /*
   * `paymentDate` لا `createdAt`.
   *
   * دفعةٌ استُلمت نقداً يوم الخميس وأُدخلت يوم السبت تنتمي إلى
   * الخميس. و`createdAt` تجيب سؤالَ التدقيق «متى أُدخل السجلّ»
   * وحده (§37).
   */
  if (range) where.paymentDate = { gte: range.from, lte: range.to };

  const enrollment = enrollmentScope(query);

  /*
   * ربطُ الدفعة بالنطاق الأكاديمي يمرّ بالفواتير التي سدّدتها.
   *
   * و`some` لا `every`: الدفعةُ الواحدة قد تُوزَّع على فواتير
   * موادَّ مختلفة، فوجودُ فاتورةٍ واحدة داخل النطاق يُدخلها.
   * و`every` كانت ستُسقط كلَّ دفعةٍ عابرةٍ للمواد.
   *
   * وأثرٌ جانبيّ يجب أن يُعرف: مجموعُ الدفعات مفلترةً بمادّةٍ يشمل
   * **كاملَ** مبلغ الدفعة لا حصّةَ تلك المادة منه. ومن أراد
   * التوزيع الدقيق فمصدرُه `PaymentInvoice.paidAmount` — وهو ما
   * يفعله تقريرُ الفواتير، لا هذا.
   */
  if (hasKeys(enrollment)) {
    where.paymentInvoices = {
      some: { invoice: { studentEnrollment: enrollment } },
    };
  }

  return where;
};

// ======================================================
// الحضور — زمنُه يومُ الحصّة
// ======================================================

export const attendanceScope = (
  query: Partial<ReportQuery>,
): Prisma.AttendanceWhereInput => {
  const where: Prisma.AttendanceWhereInput = {};

  if (query.attendanceStatus) where.status = query.attendanceStatus;

  const { range } = resolvePeriod(query);
  const session: Prisma.SessionWhereInput = {};

  /*
   * `session.sessionDate` لا `attendance.createdAt`.
   *
   * `createdAt` لحظةُ تسجيل الأستاذ للورقة، وقد تتأخّر أيّاماً عن
   * الحصّة. والحضورُ واقعةٌ في يوم الحصّة لا يوم تدوينها.
   */
  if (range) session.sessionDate = { gte: range.from, lte: range.to };

  /*
   * الأستاذُ والمادةُ والفوج عبر `schedule.teachingAssignment`:
   * الحصّةُ لا تحمل أستاذاً، بل جدولاً يشير إلى الإسناد.
   */
  const assignment = teachingAssignmentScope(query);

  if (hasKeys(assignment)) {
    session.schedule = { teachingAssignment: assignment };
  }

  if (hasKeys(session)) where.session = session;

  /*
   * الطالبُ عبر التسجيل. ولا يُضاف شرطُ الإسناد هنا مرّةً ثانية —
   * هو مطبَّقٌ على الحصّة سلفاً، وتكرارُه يضيف وصلةً بلا أثر.
   */
  if (query.studentId) {
    where.studentEnrollment = { studentId: query.studentId };
  }

  return where;
};

// ======================================================
// الحصص
// ======================================================

export const sessionScope = (
  query: Partial<ReportQuery>,
): Prisma.SessionWhereInput => {
  const where: Prisma.SessionWhereInput = {};

  const { range } = resolvePeriod(query);

  if (range) where.sessionDate = { gte: range.from, lte: range.to };

  const assignment = teachingAssignmentScope(query);

  if (hasKeys(assignment)) {
    where.schedule = { teachingAssignment: assignment };
  }

  return where;
};

// ======================================================
// التخليص — زمنُه فترةُ العمل
// ======================================================

export const settlementScope = (
  query: Partial<ReportQuery>,
  options: { includeCancelled?: boolean; committedOnly?: boolean } = {},
): Prisma.SettlementWhereInput => {
  const where: Prisma.SettlementWhereInput = options.includeCancelled
    ? {}
    : { ...activeSettlement };

  if (options.committedOnly) where.status = { in: ["CONFIRMED", "PAID"] };
  if (query.settlementStatus) where.status = query.settlementStatus;
  if (query.academicYearId) where.academicYearId = query.academicYearId;
  if (query.teacherId) where.teacherId = query.teacherId;

  const assignment = teachingAssignmentScope({
    ...query,
    academicYearId: undefined,
    teacherId: undefined,
  });

  if (hasKeys(assignment)) where.teachingAssignment = assignment;

  const { range } = resolvePeriod(query);

  /*
   * §53: التخليصُ يُفلتر بفترة عمله لا بيوم حسابه.
   *
   * تخليصُ سبتمبر المحسوبُ في أكتوبر عملُ سبتمبر. و`computedAt`
   * تقول متى ضُغط زرُّ الحساب — سؤالُ تدقيقٍ لا سؤالُ تقرير.
   *
   * وفترةُ العمل تُقرأ من **حصص الكشف**: `AttendanceSheet` لا
   * تحمل شهراً ولا سنةً ولا تاريخَ بداية، تحمل `number` و
   * `createdAt` فقط. و`createdAt` تاريخُ إنشاء الكشف — قد يسبق
   * الحصص أو يليها. فالحصصُ هي وحدها ما يؤرّخ الكشفَ صدقاً.
   *
   * و`some`: يكفي أن تقع حصّةٌ واحدة في المدى ليدخل الكشف. كشفٌ
   * يمتدّ على شهرين يظهر في تقريرَي الشهرين — وهو الصواب، لأنّ
   * عملَه وقع فيهما.
   */
  if (range) {
    where.attendanceSheet = {
      sessions: { some: { sessionDate: { gte: range.from, lte: range.to } } },
    };
  }

  return where;
};

// ======================================================
// دفعات الأساتذة — زمنُها لحظةُ الدفع
// ======================================================

export const teacherPaymentScope = (
  query: Partial<ReportQuery>,
  options: { includeCancelled?: boolean } = {},
): Prisma.TeacherPaymentWhereInput => {
  const where: Prisma.TeacherPaymentWhereInput = options.includeCancelled
    ? {}
    : { ...activeTeacherPayment };

  if (query.teacherId) where.teacherId = query.teacherId;
  if (query.paymentMethod) where.paymentMethod = query.paymentMethod;

  const { range } = resolvePeriod(query);

  if (range) where.paymentDate = { gte: range.from, lte: range.to };

  return where;
};
