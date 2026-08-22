import { apiClient } from "../../core/api/client";

/**
 * الكشف التقديري للحصص — §16.
 *
 * يُحسب ولا يُحفظ: الإدارة ترى المبلغ قبل أن تلتزم به. وهو نفسه ما
 * سيُخزَّن حرفياً لو ضُغط «احسب التخليص» — لأنّ الطرفين يمرّان على
 * دالّة الجمع نفسها في الخادم، لا على تقديرٍ مشابه.
 */

export type SettlementMethod =
  | "PERCENTAGE"
  | "PER_STUDENT"
  | "PER_SESSION"
  | "PER_ATTENDED_SHARE";

export type CountBasis = "ENROLLED" | "PAID" | "PRESENT";

export interface EstimateRow {
  /** ترتيبها في هذا الكشف — 1..N بالتاريخ، وهو ما يُعرض */
  order: number;
  /** رقمها في الجدول الأسبوعي — مفتاحُها في السجل */
  lessonNumber: number;
  sessionDate: string | null;
  /** من دخل الحساب وفق أساس العدّ */
  countedStudents: number;
  /** من حضر — قبل التصفية. الفرق بينهما هم المستبعَدون */
  presentStudents: number;
  rate: number;
  lineTotal: number;
  /** من حضر ولم يُحتسب لأنّه لم يسدّد */
  outstandingStudents: number;
  /** قيمة خدمتهم بسعر المؤسسة — لا تُجمع مع lineTotal */
  outstandingAmount: number;
}

export interface EstimateStudent {
  studentId: string;
  firstName: string;
  lastName: string;
  parentPhone: string;
  /** الحاضر والمتأخّر معاً — المتأخّر جلس الحصة */
  present: number;
  attended: number;
  late: number;
  absent: number;
  excused: number;
  /** خانات لم تُدوَّن — ليست غياباً */
  blank: number;
  invoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    paid: number;
    remaining: number;
    status: "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
    dueDate: string;
    overdue: boolean;
  } | null;
  /** عليه دَينٌ في هذه المادة لهذه الفترة */
  defaulter: boolean;
  /** لا فاتورة له أصلاً — خللٌ لا حالة */
  uninvoiced: boolean;
}

export interface Estimate {
  header: {
    subject: { id: string; name: string };
    teacher: { id: string; firstName: string; lastName: string };
    studyGroup: { id: string; name: string };
    level: { id: string; name: string };
    educationStage: { id: string; name: string };
    sheet: { id: string; number: number; label: string | null; sessionCount: number };
    dateFrom: string | null;
    dateTo: string | null;
  };
  policy: {
    id: string;
    name: string;
    method: SettlementMethod;
    countBasis: CountBasis;
    roundingMode: string;
    roundingPrecision: number;
    teacherPercentage: number | null;
    amountPerStudent: number | null;
    amountPerSession: number | null;
  };
  tuition: number;
  rows: EstimateRow[];
  students: EstimateStudent[];
  totals: {
    approvedSessions: number;
    completedSessions: number;
    missingSessions: number;
    enrolledStudents: number;
    paidStudents: number;
    unpaidStudents: number;
    defaulters: number;
    uninvoiced: number;
    /** الحضور الخام — كلُّ من حضر */
    attendedUnits: number;
    /** ما دخل الحساب منه وفق أساس العدّ — وهو الذي يفسّر المبلغ */
    countedUnits: number;
    /** حضورُ المخلَّفين — لم يدخل الحساب */
    outstandingUnits: number;
    /** الحقّ الشهري ÷ الحصص المعتمدة */
    institutionSessionRate: number;
    /** قيمة ما قُدِّم ولم يُحصَّل — مستقلٌّ لا يُجمع مع مستحقّ الأستاذ */
    outstandingEstimated: number;
    /** نصيب الأستاذ منها إن حُصِّلت — مؤجَّلٌ لا مدفوع. فارغٌ بلا نسبة */
    outstandingTeacherShare: number | null;
    grossTuition: number;
    collected: number;
    remaining: number;
    teacherAmount: number;
  };
}

export const getEstimate = async (params: {
  teachingAssignmentId: string;
  attendanceSheetId: string;
  policyId?: string;
}) => {
  const { data } = await apiClient.get("/settlements/estimate", { params });
  return data.data as Estimate;
};

export const METHOD_LABEL: Record<SettlementMethod, string> = {
  PERCENTAGE: "نسبة من حقوق الطلبة",
  PER_STUDENT: "مبلغ لكل طالب",
  PER_SESSION: "مبلغ لكل حصة",
  PER_ATTENDED_SHARE: "نصيب من كل حضور",
};

export const BASIS_LABEL: Record<CountBasis, string> = {
  ENROLLED: "المسجَّلون",
  PAID: "الذين دفعوا",
  PRESENT: "الحاضرون",
};

// --------------------------------------------------
// التجميع بعدد الحصص — قراءةُ الورقة اليدوية
//
// الورقة الأصلية لا تُفصّل الكشف بالحصص بل **بالطلبة**: كم طالباً
// محتسباً أكمل ثماني حصص؟ خمسة → 187.5 × 8 × 5 = 7500. وكم أكمل خمساً؟
// واحد → 937.5. وكم ثلاثاً؟ واحد → 562.5. المجموع 9000 للمؤسسة،
// و75% منه 6750 للأستاذ.
//
// وهو **نفسُ حساب الخادم بترتيبٍ آخر**، لا حسابٌ ثانٍ:
//
//   Σ (المحتسبون في كل حصة) = Σ (حصصُ كل محتسب) = الوحدات المحتسبة
//   5+5+5+6+6+7+7+7 = 48 = 5×8 + 1×5 + 1×3
//
// فالمجموع واحد والسؤال مختلف: الجدول بالحصص يجيب «كم محتسباً حضر يوم
// 16/08؟»، وهذا يجيب «كم طالباً أكمل الشهر؟». والثاني هو الذي تُراجَع
// به الورقة الموقَّعة، فيُعرض بجانب الأول لا بدلاً منه.
// --------------------------------------------------

/**
 * من يدخل حسابَ الأستاذ — نفسُ شرط الخادم (`eligibleEnrollments`).
 *
 * `PAID` وحدها تصفّي: مَن له فاتورةٌ ولم يبقَ عليها شيء. و`ENROLLED`
 * تعدّ المسجَّلين كلَّهم، و`PRESENT` تعدّ الحضور الخام — فلا تصفّيان
 * أحداً. وما يُغيَّر في `gatherSettlementFacts` يُغيَّر هنا وإلّا
 * افترق الجدولان في الورقة نفسها.
 */
export const isCountedStudent = (
  student: EstimateStudent,
  basis: CountBasis,
) => (basis === "PAID" ? !student.uninvoiced && !student.defaulter : true);

export interface SessionBucket {
  /** عدد الحصص التي حضرها كلُّ طالبٍ في هذه المجموعة */
  sessions: number;
  /** المحتسبون فيها */
  students: number;
  /** عدد الحصص × المحتسبون */
  units: number;
  /** قيمتها على الطلبة — بسعر الحصة للمؤسسة */
  institutionAmount: number;
  /** نصيب الأستاذ منها — فارغٌ حين لا يُشتقّ مستحقُّه من الحضور */
  teacherAmount: number | null;
}

export interface BucketSummary {
  buckets: SessionBucket[];
  /** عدد المحتسبين — مجموع عمود الطلبة */
  countedStudents: number;
  /** مجموع الوحدات — يجب أن يساوي `totals.countedUnits` */
  countedUnits: number;
  institutionTotal: number;
  teacherTotal: number | null;
  /** قيمة الوحدة للأستاذ — فارغةٌ في الطرائق المسطَّحة */
  unitRate: number | null;
  /**
   * وحداتُ المجموعات لا تساوي وحدات الخادم.
   *
   * يقع حين يحضر تسجيلٌ **مؤرشف** حصةً: الخادم يعدّ حضورَه في
   * `presentCount` ولا يُدرجه في قائمة الطلبة (`isActive` فقط). فالجدولان
   * يفترقان — ويُعلَن الفرق ولا يُخفى، فورقةٌ ماليةٌ تُخفي تعارضاً
   * أسوأ من ورقةٍ تعترف به.
   */
  inconsistent: boolean;
}

/** تقريبٌ نصفيٌّ صاعد — للخانات وحدها، والمجاميع من الخادم */
const round = (value: number, dp: number) => {
  const factor = 10 ** dp;
  return Math.round(value * factor + Number.EPSILON) / factor;
};

/**
 * قيمةُ الوحدة — نصيب الأستاذ من حضورٍ واحد.
 *
 * ثابتةٌ عبر الأسطر في `PER_ATTENDED_SHARE` وحدها، وفي غيرها المستحقُّ
 * لا يُشتقّ من الحضور أصلاً فلا وحدةَ له. مستخرَجةٌ هنا لأنّ الجدولين
 * يقرآنها — المجموعات ونصيبُ الأستاذ من المخلَّفين — فلا تُكتب مرّتين.
 */
export const teacherUnitRate = (estimate: Estimate): number | null =>
  estimate.policy.method === "PER_ATTENDED_SHARE"
    ? (estimate.rows[0]?.rate ?? null)
    : null;

/**
 * نصيبُ الأستاذ المؤجَّل من طالبٍ بعينه — ما يأخذه إن سدّد.
 *
 * الورقة تُعرض على الأستاذ ليُوقّع، وعمود «الدَّين» فيها كان دَينَ
 * **المؤسسة** (1,500 دج): يقرؤه فيظنّه حقَّه الضائع، وحقُّه منه 1,125
 * لا غير. فيُعرض نصيبُه هو.
 *
 * و**صفرٌ لمن دخل حضورُه الحساب**: أساسُ العدّ إن كان «المسجَّلون»
 * فالأستاذ قُبض عن حصصه أصلاً، ودَينُ الطالب شأنُ المؤسسة وحدها.
 * ومجموعُ ما هنا يساوي `totals.outstandingTeacherShare` من الخادم —
 * وهو ما يُطبع في خانة المجموع، فالورقة لا تجمع ما حسبه غيرُها.
 */
export const pendingTeacherShare = (
  estimate: Estimate,
  student: EstimateStudent,
): number | null => {
  const rate = teacherUnitRate(estimate);
  if (rate === null) return null;

  if (isCountedStudent(student, estimate.policy.countBasis)) return 0;

  return round(student.present * rate, estimate.policy.roundingPrecision);
};

export const bucketByAttendance = (estimate: Estimate): BucketSummary => {
  const { policy, totals, rows, students } = estimate;
  const dp = policy.roundingPrecision;

  const counted = students.filter((s) =>
    isCountedStudent(s, policy.countBasis),
  );

  const tally = new Map<number, number>();
  for (const s of counted) tally.set(s.present, (tally.get(s.present) ?? 0) + 1);

  /*
   * قيمة الوحدة تُقرأ من أوّل سطر — وهي ثابتةٌ عبر الأسطر في
   * `PER_ATTENDED_SHARE` وحدها (نصيب الأستاذ من حضورٍ واحد).
   *
   * وفي الطرائق الأخرى المستحقُّ **لا يُشتقّ من الحضور أصلاً**: مبلغٌ
   * شهريٌّ مسطَّح يُوزَّع على الأسطر للعرض. فنصيبُ مجموعةٍ منه معنىً لا
   * وجود له، ويُترك فارغاً بدل أن يُختلق.
   */
  const unitRate =
    policy.method === "PER_ATTENDED_SHARE" ? (rows[0]?.rate ?? null) : null;

  const buckets: SessionBucket[] = [...tally.entries()]
    // بالأكبر أوّلاً — مَن أكمل الشهر هو الصفُّ الذي يُقرأ أوّلاً
    .sort((a, b) => b[0] - a[0])
    .map(([sessions, count]) => {
      const units = sessions * count;

      return {
        sessions,
        students: count,
        units,
        institutionAmount: round(units * totals.institutionSessionRate, dp),
        teacherAmount: unitRate === null ? null : round(units * unitRate, dp),
      };
    });

  const countedUnits = buckets.reduce((sum, b) => sum + b.units, 0);
  const institutionTotal = round(
    countedUnits * totals.institutionSessionRate,
    dp,
  );
  const teacherTotal = unitRate === null ? null : totals.teacherAmount;

  /*
   * فرقُ التقريب يُحمَّل على **آخر** مجموعةٍ ذاتِ وحدات.
   *
   * نفسُ علّة الخادم: مَن يجمع العمود بآلته يجب أن يجد الخانة السفلى،
   * والخانةُ السفلى ليست مجموعَ ما فوقها بل رقمُ الخادم الموقَّع عليه.
   * لكنّ **الصفَّ الأوّل** هو الذي يُراجَع باليد — «5 طلبة × 8 حصص ×
   * 140.625» — فلو حُمِّل عليه السنتيمُ الشاذّ لخرج 5,624.99 حيث تقول
   * الآلة 5,625 فبدا الجدولُ كلُّه مشكوكاً فيه. والصفُّ الأصغر أقلُّ
   * ما يُراجَع، وفرقُه سنتيمٌ في تقريب خانةٍ لا في مال.
   *
   * ومجموعةُ الصفر تُستثنى: سنتيمٌ في صفٍّ يقول «صفر وحدة» عبثٌ ظاهر.
   */
  const anchor = buckets.reduce(
    (last, b, i) => (b.units > 0 ? i : last),
    -1,
  );

  if (anchor >= 0) {
    const institutionSum = buckets.reduce(
      (sum, b) => sum + b.institutionAmount,
      0,
    );

    buckets[anchor]!.institutionAmount = round(
      buckets[anchor]!.institutionAmount + (institutionTotal - institutionSum),
      dp,
    );

    if (teacherTotal !== null) {
      const teacherSum = buckets.reduce(
        (sum, b) => sum + (b.teacherAmount ?? 0),
        0,
      );

      buckets[anchor]!.teacherAmount = round(
        (buckets[anchor]!.teacherAmount ?? 0) + (teacherTotal - teacherSum),
        dp,
      );
    }
  }

  return {
    buckets,
    countedStudents: counted.length,
    countedUnits,
    institutionTotal,
    teacherTotal,
    unitRate,
    inconsistent: countedUnits !== totals.countedUnits,
  };
};

/** وصفُ القيمة المعتمدة في السياسة — تختلف باختلاف الطريقة (§8) */
export const policyValue = (p: Estimate["policy"]) => {
  switch (p.method) {
    case "PER_STUDENT":
      return `${p.amountPerStudent ?? 0} لكل طالب`;
    case "PER_SESSION":
      return `${p.amountPerSession ?? 0} لكل حصة`;
    default:
      return `${p.teacherPercentage ?? 0}%`;
  }
};
