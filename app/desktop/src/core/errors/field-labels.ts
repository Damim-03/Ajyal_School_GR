/**
 * **أسماءُ الحقول كما يعرفها الموظّف، لا كما تعرفها الشيفرة.**
 *
 * الخادمُ يردّ اسمَ الحقل البرمجيّ (`parentPhone`)، والموظّفُ يعرف
 * «هاتف الوليّ». وبين الاثنين هذا القاموس.
 *
 * ومع كلّ اسمٍ **جنسُه النحويّ**، لأنّ الرسالة تُبنى ولا تُنسخ:
 * «الاسم مطلوب» و«القاعة مطلوبة» — وحرفٌ واحدٌ يفرّق بين عربيّةٍ
 * سليمة وترجمةٍ آليّة.
 */

export interface FieldLabel {
  /** التسمية معرَّفةً بأل — كما تُقرأ في جملة */
  readonly text: string;
  /** مؤنَّثٌ نحويّاً */
  readonly f?: boolean;
}

const L = (text: string, f = false): FieldLabel => ({ text, f });

const LABELS: Readonly<Record<string, FieldLabel>> = {
  // --------------------------------------------------
  // الطالب والأستاذ
  // --------------------------------------------------
  firstName: L("الاسم"),
  lastName: L("اللقب"),
  studentName: L("اسم الطالب"),
  studentNumber: L("رقم الطالب"),
  gender: L("الجنس"),
  birthDate: L("تاريخ الميلاد"),
  birthPlace: L("مكان الميلاد"),
  avatar: L("الصورة", true),
  phone: L("الهاتف"),
  parentPhone: L("هاتف الوليّ"),
  emergencyPhone: L("هاتف الطوارئ"),
  address: L("العنوان"),
  schoolName: L("اسم المدرسة"),
  registrationDate: L("تاريخ التسجيل"),
  specialization: L("التخصّص"),
  qualification: L("المؤهّل"),
  hireDate: L("تاريخ التوظيف"),
  salary: L("الأجر"),

  // --------------------------------------------------
  // البنية الدراسية
  // --------------------------------------------------
  academicYear: L("السنة الدراسية", true),
  educationStage: L("الطور"),
  level: L("المستوى"),
  studyGroup: L("الفوج"),
  subject: L("المادة", true),
  classroom: L("القاعة", true),
  lessonSlot: L("الفترة", true),
  teacher: L("الأستاذ"),
  student: L("الطالب"),
  teachingAssignment: L("الإسناد"),
  enrollment: L("التسجيل"),
  studentEnrollment: L("تسجيل الطالب"),
  schedule: L("الحصة المجدولة", true),
  session: L("الحصة", true),
  attendanceSheet: L("كشف الحضور"),
  sheet: L("الكشف"),
  capacity: L("السعة", true),
  maxStudents: L("الحدّ الأقصى للطلبة"),
  floor: L("الطابق"),
  groupType: L("نوع الفوج"),
  dayOfWeek: L("يوم الأسبوع"),
  lessonNumber: L("رقم الحصة"),
  sessionCount: L("عدد الحصص"),
  sessionDate: L("تاريخ الحصة"),
  startTime: L("وقت البداية"),
  endTime: L("وقت النهاية"),
  enrolledAt: L("تاريخ الالتحاق"),
  isCurrent: L("السنة الجارية", true),

  // --------------------------------------------------
  // المال
  // --------------------------------------------------
  amount: L("المبلغ"),
  discount: L("التخفيض"),
  invoice: L("الفاتورة", true),
  payment: L("الدفعة", true),
  paymentDate: L("تاريخ الدفع"),
  paymentMethod: L("طريقة الدفع", true),
  dueDate: L("تاريخ الاستحقاق"),
  allocations: L("توزيع المبلغ"),
  settlement: L("التخليص"),
  policy: L("سياسة التخليص", true),
  debtShare: L("حصّة الدَّين", true),
  collectionSettlement: L("تخليص التحصيل"),
  receivedBy: L("المستلِم"),
  reference: L("المرجع"),
  registrationFeeAmount: L("مبلغ حقوق التسجيل"),
  registrationFeePaid: L("دفع حقوق التسجيل"),
  registrationFeePaidAt: L("تاريخ دفع حقوق التسجيل"),
  overdue: L("المتأخّرات", true),
  overdueOnly: L("المتأخّرات وحدها", true),

  // --------------------------------------------------
  // المستخدمون والصلاحيات
  // --------------------------------------------------
  username: L("اسم المستخدم"),
  password: L("كلمة المرور", true),
  email: L("البريد الإلكتروني"),
  role: L("الدور"),
  permission: L("الصلاحية", true),
  permissionIds: L("الصلاحيات", true),
  module: L("الوحدة", true),

  // --------------------------------------------------
  // عامّ
  // --------------------------------------------------
  id: L("المعرّف"),
  name: L("الاسم"),
  nameEn: L("الاسم بالإنجليزية"),
  shortName: L("الاسم المختصر"),
  label: L("التسمية", true),
  code: L("الرمز"),
  color: L("اللون"),
  type: L("النوع"),
  kind: L("النوع"),
  status: L("الحالة", true),
  isActive: L("الحالة", true),
  note: L("الملاحظة", true),
  description: L("الوصف"),
  reason: L("السبب"),
  cancelReason: L("سبب الإلغاء"),
  date: L("التاريخ"),
  dateFrom: L("تاريخ البداية"),
  startDate: L("تاريخ البداية"),
  endDate: L("تاريخ النهاية"),
  effectiveFrom: L("تاريخ السريان"),
  dateTo: L("تاريخ النهاية"),
  from: L("البداية", true),
  effectiveOn: L("تاريخ السريان"),
  month: L("الشهر"),
  year: L("السنة", true),
  number: L("الرقم"),
  order: L("الترتيب"),
  sortOrder: L("الترتيب"),
  page: L("الصفحة", true),
  pageNumber: L("رقم الصفحة"),
  limit: L("عدد النتائج"),
  search: L("البحث"),
  groupBy: L("التجميع"),
  document: L("الوثيقة", true),
  documentsComplete: L("اكتمال الوثائق"),
  fileName: L("اسم الملف"),
  filePath: L("مسار الملف"),
  imagePath: L("مسار الصورة"),
  logoPath: L("مسار الشعار"),
  requirement: L("الاشتراط"),
  method: L("الطريقة", true),
  mode: L("الوضع"),
  channel: L("القناة", true),
  profile: L("الملف الشخصي"),
  version: L("النسخة", true),
  appVersion: L("نسخة التطبيق", true),
  language: L("اللغة", true),
  country: L("البلد"),
  timezone: L("المنطقة الزمنية", true),
  dateFormat: L("صيغة التاريخ", true),
  density: L("الكثافة", true),
  uiScale: L("مقياس العرض"),
  windowMode: L("وضع النافذة"),
  devices: L("الأجهزة", true),
  diagnostics: L("سجلّ الأعطال"),
  accepted: L("الموافقة", true),
  verified: L("التحقّق"),
  confirm: L("التأكيد"),
  keys: L("المفاتيح", true),
  body: L("المحتوى"),
  printed: L("الطباعة", true),
  purgeFiles: L("حذف الملفات"),
  applyToAll: L("التطبيق على الكل"),
  includeInactiveEnrollments: L("تضمين التسجيلات المعطَّلة"),
};

/*
 * لواحقُ تُقشَّر قبل البحث.
 *
 * `studyGroupId` هو `studyGroup`، و`teachingAssignmentIds` هو
 * `teachingAssignment`. فالقاموسُ يحمل الجذرَ مرّةً واحدة بدل ثلاثِ
 * صيغٍ لكلّ حقل — واللاحقةُ لا تُقرأ في الجملة أصلاً: الموظّف
 * يختار «الفوج» لا «معرّف الفوج».
 */
const SUFFIXES = ["Ids", "Id", "At"] as const;

const strip = (field: string): string | null => {
  for (const suffix of SUFFIXES) {
    if (field.length > suffix.length && field.endsWith(suffix)) {
      return field.slice(0, -suffix.length);
    }
  }
  return null;
};

/**
 * تسميةُ الحقل — أو `null` إن لم تُعرف.
 *
 * و`null` ليست إخفاقاً يُخفى: مَن ينادي هذه الدالّة يبني حينها
 * جملةً بلا اسم حقل («قيمةٌ غير صالحة») بدل أن يقحم `studyGroupId`
 * في وجه المستخدم.
 */
export const fieldLabel = (field: string): FieldLabel | null => {
  /* المسار قد يكون `allocations.0.invoiceId` — يُؤخذ آخرُ جزءٍ اسميّ */
  const leaf = field
    .split(".")
    .filter((part) => part !== "" && !/^\d+$/.test(part))
    .pop();

  if (!leaf) return null;

  const direct = LABELS[leaf];
  if (direct) return direct;

  const root = strip(leaf);

  return root ? (LABELS[root] ?? null) : null;
};
