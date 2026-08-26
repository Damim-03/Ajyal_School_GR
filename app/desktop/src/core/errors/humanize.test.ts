import { describe, expect, it } from "vitest";

import { humanizeApiError, humanizeIssue } from "./humanize";
import { fieldLabel } from "./field-labels";

/**
 * **يُختبر لأنّ الفشل هنا صامتٌ ومهين.**
 *
 * خطأُ هذه الوحدة لا يُسقط شيئاً: النافذةُ تُعرض والزرُّ يعمل. لكنّ
 * الموظّف يقرأ «First name must be at least 2 characters» أو
 * «الاسم مطلوبة» — والأولى لا يفهمها، والثانية تقول له إنّ من كتب
 * البرنامج لا يتقن لغته.
 *
 * فالمفحوصُ ثلاثةٌ: أن يُترجَم النوع، وأن تُطابق التسميةُ فعلَها في
 * التذكير والتأنيث، وألّا يتسرّب حرفٌ إنجليزيٌّ إلى الشاشة.
 */

describe("fieldLabel", () => {
  it("يقشّر اللواحق فلا يحتاج القاموس صيغةً لكلّ حقل", () => {
    expect(fieldLabel("studyGroupId")?.text).toBe("الفوج");
    expect(fieldLabel("teachingAssignmentIds")?.text).toBe("الإسناد");
    expect(fieldLabel("registrationFeePaidAt")?.text).toBe(
      "تاريخ دفع حقوق التسجيل",
    );
  });

  it("يأخذ آخر جزءٍ اسميّ من المسار المركَّب", () => {
    expect(fieldLabel("allocations.0.invoiceId")?.text).toBe("الفاتورة");
  });

  it("يحمل الجنس النحويّ", () => {
    expect(fieldLabel("classroomId")?.f).toBe(true);
    expect(fieldLabel("firstName")?.f).toBeFalsy();
  });

  it("يُرجع null لما لا يعرف — ولا يخترع", () => {
    expect(fieldLabel("someUnknownThing")).toBeNull();
  });
});

describe("humanizeIssue", () => {
  it("«مطلوب» تتبع جنس التسمية", () => {
    expect(
      humanizeIssue({ field: "firstName", message: "First name is required" }),
    ).toBe("الاسم مطلوب");

    expect(
      humanizeIssue({ field: "classroomId", message: "Classroom is required" }),
    ).toBe("القاعة مطلوبة");
  });

  /* «2 حرف» ليست عربية */
  it("يعدّ المعدود كما تُعدّ العربية", () => {
    expect(
      humanizeIssue({
        field: "firstName",
        message: "First name must be at least 2 characters",
      }),
    ).toBe("الاسم لا يقلّ عن حرفين");

    expect(
      humanizeIssue({
        field: "code",
        message: "Code must not exceed 5 characters",
      }),
    ).toBe("الرمز لا يتجاوز 5 أحرف");

    expect(
      humanizeIssue({
        field: "firstName",
        message: "First name must not exceed 50 characters",
      }),
    ).toBe("الاسم لا يتجاوز 50 حرفاً");
  });

  it("يطابق الفعل للمؤنّث", () => {
    expect(
      humanizeIssue({
        field: "capacity",
        message: "Capacity must be at least 1",
      }),
    ).toBe("السعة لا تقلّ عن 1");
  });

  it("يترجم قيود المبالغ والتواريخ", () => {
    expect(
      humanizeIssue({ field: "amount", message: "Amount must be greater than 0" }),
    ).toBe("المبلغ يجب أن يكون أكبر من صفر");

    expect(
      humanizeIssue({
        field: "birthDate",
        message: "Birth date must be in the past",
      }),
    ).toBe("تاريخ الميلاد يجب أن يكون في الماضي");
  });

  it("يعرض خيارات التعداد بدل ذكر النوع", () => {
    expect(
      humanizeIssue({ field: "gender", message: "Gender must be MALE or FEMALE" }),
    ).toBe("الجنس يجب أن يكون إحدى القيم: MALE أو FEMALE");
  });

  it("يترجم الحدّ الأعلى للدفعة الواحدة", () => {
    expect(
      humanizeIssue({
        field: "studentIds",
        message: "Cannot mark more than 200 students at once",
      }),
    ).toContain("في المرّة الواحدة");
  });

  /*
   * حقلٌ لا يعرفه القاموس: تُبنى جملةٌ عامّة ولا يُقحَم الاسمُ
   * البرمجيّ في وجه المستخدم.
   */
  it("لا يعرض اسم الحقل البرمجيّ حين يجهله", () => {
    const out = humanizeIssue({
      field: "mysteriousInternalKey",
      message: "Mysterious internal key is required",
    });

    expect(out).toBe("حقلٌ مطلوب لم يُملأ");
    expect(out).not.toContain("mysterious");
  });
});

describe("humanizeApiError", () => {
  it("مخالفاتُ الحقول تسبق الرمز — فهي أقرب إلى ما فعله المستخدم", () => {
    expect(
      humanizeApiError({
        message: "Validation failed",
        errorCode: "VALIDATION_ERROR",
        errors: [{ field: "parentPhone", message: "Phone is required" }],
      }),
      ).toBe("هاتف الوليّ مطلوب");
  });

  it("يجمع المخالفات ويطوي ما زاد على ثلاث", () => {
    const out = humanizeApiError({
      errorCode: "VALIDATION_ERROR",
      errors: [
        { field: "firstName", message: "First name is required" },
        { field: "lastName", message: "Last name is required" },
        { field: "gender", message: "Gender is required" },
        { field: "parentPhone", message: "Phone is required" },
        { field: "address", message: "Address is required" },
      ],
    });

    expect(out).toContain("الاسم مطلوب");
    expect(out).toContain("عنصرين آخر");
    expect(out.split("·").length).toBeLessThanOrEqual(4);
  });

  it("يترجم رمز الخادم حين لا مخالفاتِ حقول", () => {
    expect(humanizeApiError({ errorCode: "AUTH_INVALID_CREDENTIALS" })).toBe(
      "اسم المستخدم أو كلمة المرور غير صحيحة",
    );
    expect(humanizeApiError({ errorCode: "SCHEDULE_CONFLICT" })).toContain(
      "الوقت محجوز",
    );
  });

  /*
   * عطبُ الخادم ليس خطأ المستخدم: لا يُطلب منه تصحيحُ شيء، ولا
   * يُعرض له نصُّ الاستثناء.
   */
  it("لا يُسرّب نصّ الاستثناء في أخطاء الخادم", () => {
    const out = humanizeApiError(
      {
        message: "Internal Server Error",
        errorCode: "INTERNAL_SERVER_ERROR",
        error: "Illegal mix of collations (utf8mb4_unicode_ci,IMPLICIT)",
      },
      500,
    );

    expect(out).not.toContain("collation");
    expect(out).not.toMatch(/[A-Za-z]{4,}/);
    expect(out).toContain("عطبٌ في الخادم");
  });

  it("يرتدّ إلى حالة HTTP حين لا رمزَ معروفاً", () => {
    expect(humanizeApiError({}, 403)).toBe("لا تملك صلاحيةً لهذا الإجراء");
    expect(humanizeApiError({}, 404)).toBe("لم يُعثر على المطلوب");
    expect(humanizeApiError(undefined)).toBe("تعذّر إتمام العملية");
  });
});
