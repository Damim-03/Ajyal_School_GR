import { describe, expect, it } from "vitest";
import { reportQuerySchema } from "./reports.filters";
import {
  attendanceScope,
  enrollmentScope,
  invoiceScope,
  oldDebtScope,
  paymentScope,
  resolvePeriod,
  sessionScope,
  settlementScope,
  teacherPaymentScope,
  teachingAssignmentScope,
} from "./reports.scope";

const q = (input: Record<string, unknown> = {}) =>
  reportQuerySchema.parse(input);

describe("resolvePeriod", () => {
  it("الشهرُ الصريح يُنتج حقلَي أعمالٍ ومدىً مشتقّاً", () => {
    const period = resolvePeriod(q({ month: "9", year: "2026" }));

    expect(period.yearMonth).toEqual({ year: 2026, month: 9 });
    expect(period.range?.from.getDate()).toBe(1);
    expect(period.range?.to.getDate()).toBe(30);
  });

  /*
   * المدى الصريح لا شهرَ له. وإجبارُه على شهرٍ واحد يكذب: تقريرُ
   * «من 15 سبتمبر إلى 15 أكتوبر» ليس تقريرَ سبتمبر.
   */
  it("المدى الصريح بلا شهر", () => {
    const period = resolvePeriod(
      q({ dateFrom: "2026-09-15", dateTo: "2026-10-15" }),
    );

    expect(period.yearMonth).toBeNull();
    expect(period.range).not.toBeNull();
  });

  it("المدى مفتوحُ الطرف مقبول", () => {
    const period = resolvePeriod(q({ dateFrom: "2026-09-01" }));

    expect(period.range?.from.getFullYear()).toBe(2026);
    expect(period.range?.to.getFullYear()).toBe(2999);
  });

  /*
   * الطرفُ الناقص يُملأ بحدٍّ ثابت لا بـ`new Date()`، وإلّا تغيّر
   * ناتجُ نفس الاستعلام بين نداءين فتعذّرت مقارنةُ لقطتين.
   */
  it("الحدُّ البديل ثابتٌ لا يتغيّر بين نداءين", () => {
    const first = resolvePeriod(q({ dateFrom: "2026-09-01" }));
    const second = resolvePeriod(q({ dateFrom: "2026-09-01" }));

    expect(first.range?.to.getTime()).toBe(second.range?.to.getTime());
  });

  it("بلا فلترٍ زمني: لا فترة", () => {
    expect(resolvePeriod(q({}))).toEqual({ yearMonth: null, range: null });
  });
});

describe("teachingAssignmentScope — المحور", () => {
  it("يقرأ الحقول المباشرة", () => {
    const where = teachingAssignmentScope(
      q({ teacherId: "t1", subjectId: "sub1", studyGroupId: "g1" }),
    );

    expect(where).toEqual({
      teacherId: "t1",
      subjectId: "sub1",
      studyGroupId: "g1",
    });
  });

  /*
   * المستوى والطور عبر الفوج: الفوجُ يحمل levelId، والمستوى يحمل
   * educationStageId. ولا يُشتقّ الطورُ من الطالب — طالبٌ قد
   * يُسجَّل في أفواجِ مستوياتٍ مختلفة فتختلط تسجيلاتُه.
   */
  it("الطورُ يمرّ بالفوج ثم المستوى", () => {
    const where = teachingAssignmentScope(q({ educationStageId: "st1" }));

    expect(where.studyGroup).toEqual({
      level: { educationStageId: "st1" },
    });
  });

  it("المستوى والطور معاً في شرطِ فوجٍ واحد", () => {
    const where = teachingAssignmentScope(
      q({ levelId: "l1", educationStageId: "st1" }),
    );

    expect(where.studyGroup).toEqual({
      levelId: "l1",
      level: { educationStageId: "st1" },
    });
  });

  it("بلا فلاتر: شرطٌ فارغ لا شرطٌ يطابق لا شيء", () => {
    expect(teachingAssignmentScope(q({}))).toEqual({});
  });
});

describe("enrollmentScope", () => {
  it("الطالبُ مباشرةً وما عداه عبر الإسناد", () => {
    const where = enrollmentScope(q({ studentId: "s1", subjectId: "sub1" }));

    expect(where.studentId).toBe("s1");
    expect(where.teachingAssignment).toEqual({ subjectId: "sub1" });
  });

  it("لا يُدرج إسناداً فارغاً", () => {
    const where = enrollmentScope(q({ studentId: "s1" }));

    expect(where).toEqual({ studentId: "s1" });
    expect("teachingAssignment" in where).toBe(false);
  });
});

describe("invoiceScope — §52.2 و§58", () => {
  it("يستثني الملغى افتراضياً", () => {
    expect(invoiceScope(q({})).status).toEqual({ not: "CANCELLED" });
  });

  it("يقرأ الشهر من حقلَي الأعمال لا من التاريخ", () => {
    const where = invoiceScope(q({ month: "9", year: "2026" }));

    expect(where.month).toBe(9);
    expect(where.year).toBe(2026);
    expect("createdAt" in where).toBe(false);
  });

  /*
   * الحالةُ الصريحة تتقدّم على الاستثناء الافتراضي — شاشةُ
   * الإلغاءات (§38) تُبنى على هذا المسار.
   */
  it("طلبُ الملغى صراحةً يتقدّم", () => {
    expect(invoiceScope(q({ invoiceStatus: "CANCELLED" })).status).toBe(
      "CANCELLED",
    );
  });

  it("includeCancelled يرفع الاستثناء كلّه", () => {
    const where = invoiceScope(q({}), { includeCancelled: true });
    expect("status" in where).toBe(false);
  });

  it("السنةُ الدراسية تُقرأ من الفاتورة لا عبر الإسناد", () => {
    const where = invoiceScope(q({ academicYearId: "ay1" }));

    expect(where.academicYearId).toBe("ay1");
    expect(where.studentEnrollment).toBeUndefined();
  });
});

describe("oldDebtScope — §25", () => {
  /*
   * الشرطُ على (سنة، شهر) لا على تاريخ: سنةٌ أقلّ، أو نفسُ السنة
   * وشهرٌ أقلّ. والكتابةُ على التواريخ كانت ستحتاج تحويلَ الحقلين
   * داخل الاستعلام فيسقط الفهرسُ على [month, year].
   */
  it("يبني شرطاً مركّباً على السنة والشهر", () => {
    const where = oldDebtScope(q({}), { year: 2026, month: 11 });

    expect(where.OR).toEqual([
      { year: { lt: 2026 } },
      { year: 2026, month: { lt: 11 } },
    ]);
  });

  it("يشترط متبقّياً موجباً", () => {
    expect(oldDebtScope(q({}), { year: 2026, month: 11 }).remaining).toEqual({
      gt: 0,
    });
  });

  it("يُهمل شهرَ الفلتر لئلّا يناقض شرطَ القِدَم", () => {
    const where = oldDebtScope(q({ month: "9", year: "2026" }), {
      year: 2026,
      month: 11,
    });

    expect(where.month).toBeUndefined();
    expect(where.OR).toBeDefined();
  });

  it("يحتفظ باستثناء الملغى", () => {
    expect(oldDebtScope(q({}), { year: 2026, month: 11 }).status).toEqual({
      not: "CANCELLED",
    });
  });
});

describe("paymentScope — §58", () => {
  it("يستثني الملغى ويؤرّخ بيوم الدفع", () => {
    const where = paymentScope(q({ month: "9", year: "2026" }));

    expect(where.status).toBe("ACTIVE");
    expect(where.paymentDate).toBeDefined();
    expect("createdAt" in where).toBe(false);
  });

  /*
   * `some` لا `every`: الدفعةُ الواحدة قد تُوزَّع على فواتير موادَّ
   * مختلفة، و`every` كانت ستُسقط كلَّ دفعةٍ عابرةٍ للمواد.
   */
  it("يربط بالنطاق الأكاديمي عبر some لا every", () => {
    const where = paymentScope(q({ subjectId: "sub1" }));

    expect(where.paymentInvoices).toEqual({
      some: { invoice: { studentEnrollment: { teachingAssignment: { subjectId: "sub1" } } } },
    });
  });

  it("بلا نطاقٍ أكاديمي لا يضيف وصلةً بلا داعٍ", () => {
    const where = paymentScope(q({ month: "9", year: "2026" }));
    expect(where.paymentInvoices).toBeUndefined();
  });
});

describe("attendanceScope — §58", () => {
  /*
   * `session.sessionDate` لا `attendance.createdAt`: الأخيرةُ
   * لحظةُ تدوين الورقة وقد تتأخّر أيّاماً عن الحصّة.
   */
  it("يؤرّخ بيوم الحصّة لا بيوم التدوين", () => {
    const where = attendanceScope(q({ month: "9", year: "2026" }));
    const session = where.session as { sessionDate?: unknown };

    expect(session.sessionDate).toBeDefined();
    expect("createdAt" in where).toBe(false);
  });

  it("الأستاذُ عبر الجدول ثم الإسناد — الحصّةُ لا تحمل أستاذاً", () => {
    const where = attendanceScope(q({ teacherId: "t1" }));

    expect(where.session).toEqual({
      schedule: { teachingAssignment: { teacherId: "t1" } },
    });
  });

  it("الطالبُ عبر التسجيل", () => {
    const where = attendanceScope(q({ studentId: "s1" }));
    expect(where.studentEnrollment).toEqual({ studentId: "s1" });
  });

  it("حالةُ الحضور تُقرأ مباشرةً", () => {
    expect(attendanceScope(q({ attendanceStatus: "ABSENT" })).status).toBe(
      "ABSENT",
    );
  });
});

describe("sessionScope", () => {
  it("يؤرّخ بـsessionDate", () => {
    const where = sessionScope(q({ month: "9", year: "2026" }));
    expect(where.sessionDate).toBeDefined();
  });

  it("يربط بالإسناد عبر الجدول", () => {
    expect(sessionScope(q({ subjectId: "sub1" })).schedule).toEqual({
      teachingAssignment: { subjectId: "sub1" },
    });
  });
});

describe("settlementScope — §53", () => {
  it("يستثني الملغى افتراضياً ويشمل المسوّدة", () => {
    expect(settlementScope(q({})).status).toEqual({ not: "CANCELLED" });
  });

  it("committedOnly يستثني المسوّدة", () => {
    const where = settlementScope(q({}), { committedOnly: true });
    expect(where.status).toEqual({ in: ["CONFIRMED", "PAID"] });
  });

  /*
   * §53: التخليصُ يُفلتر بفترة عمله لا بيوم حسابه.
   *
   * وفترةُ العمل من حصص الكشف: AttendanceSheet لا تحمل شهراً ولا
   * سنةً ولا تاريخَ بداية — تحمل `number` و`createdAt` فقط،
   * و`createdAt` قد تسبق الحصص أو تليها.
   */
  it("يؤرّخ بحصص الكشف لا بيوم الحساب", () => {
    const where = settlementScope(q({ month: "9", year: "2026" }));

    expect(where.attendanceSheet).toBeDefined();
    expect("computedAt" in where).toBe(false);
    expect("createdAt" in where).toBe(false);
  });

  it("يكفي وقوعُ حصّةٍ واحدة في المدى — كشفٌ ممتدٌّ يظهر في الشهرين", () => {
    const where = settlementScope(q({ month: "9", year: "2026" }));
    const sheet = where.attendanceSheet as { sessions?: { some?: unknown } };

    expect(sheet.sessions?.some).toBeDefined();
  });

  it("المادةُ عبر الإسناد", () => {
    const where = settlementScope(q({ subjectId: "sub1" }));
    expect(where.teachingAssignment).toEqual({ subjectId: "sub1" });
  });

  it("الأستاذُ من التخليص مباشرةً لا عبر الإسناد", () => {
    const where = settlementScope(q({ teacherId: "t1" }));

    expect(where.teacherId).toBe("t1");
    expect(where.teachingAssignment).toBeUndefined();
  });
});

describe("teacherPaymentScope — §52.3 و§52.5", () => {
  it("يستثني الملغى", () => {
    expect(teacherPaymentScope(q({})).status).toBe("ACTIVE");
  });

  it("منفصلٌ تماماً عن دفعات الطلبة", () => {
    const teacher = teacherPaymentScope(q({ subjectId: "sub1" }));

    /*
     * لا `paymentInvoices` هنا ولا ربطَ بفواتير الطلبة: دفعةُ
     * الأستاذ صادرٌ من المؤسسة، ودفعةُ الطالب واردٌ إليها. وأيُّ
     * وصلةٍ بينهما في الاستعلام تُنتج مجموعاً بلا معنى.
     */
    expect("paymentInvoices" in teacher).toBe(false);
  });

  it("يؤرّخ بيوم الدفع", () => {
    expect(teacherPaymentScope(q({ month: "9", year: "2026" })).paymentDate)
      .toBeDefined();
  });
});
