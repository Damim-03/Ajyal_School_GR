import { describe, expect, it } from "vitest";

import {
  academicYearIssues,
  checkPassword,
  emailValid,
  hostValid,
  institutionNameValid,
  passwordSatisfied,
  portValid,
  suggestAcademicYear,
  suggestUsername,
  usernameValid,
} from "./validation";

/**
 * تحقّقُ الواجهة — يُختبر لأنّه يقرّر متى **يُقفل الزرّ**.
 *
 * وذلك أثرٌ يراه المستخدم مباشرةً: قاعدةٌ متساهلةٌ تُمرّر ما يرفضه
 * الخادمُ فيظهر خطأٌ بعد الضغط، وقاعدةٌ متشدّدةٌ تقفل الزرَّ على مدخلٍ
 * صحيح — وهي الأسوأ، لأنّها لا تقول للمستخدم شيئاً يفهمه.
 */

describe("سياسة كلمة المرور", () => {
  it("ترفض القصيرةَ ولو استوفت الباقي", () => {
    expect(passwordSatisfied("Aa1!bcd")).toBe(false);
  });

  it("تقبل ما استوفى الخمسَ قواعد", () => {
    expect(passwordSatisfied("Nexschool#2026")).toBe(true);
  });

  it("تُفصّل ما نقص لا تكتفي بالرفض", () => {
    const checks = checkPassword("nexschool2026");
    const failed = checks.filter((check) => !check.ok).map((check) => check.key);

    expect(failed).toContain("upper");
    expect(failed).toContain("symbol");
    expect(failed).not.toContain("length");
    expect(failed).not.toContain("digit");
  });

  it("تعدّ المسافةَ رمزاً خاصّاً — وهو ما يفعله الخادم", () => {
    const symbol = checkPassword("Abcdefgh 1").find(
      (check) => check.key === "symbol",
    );

    expect(symbol?.ok).toBe(true);
  });
});

describe("اسم الدخول", () => {
  it("يرفض العربيةَ والمسافاتِ والقصير", () => {
    expect(usernameValid("مدير")).toBe(false);
    expect(usernameValid("ali omar")).toBe(false);
    expect(usernameValid("ab")).toBe(false);
  });

  it("يقبل اللاتينيةَ والأرقامَ والفواصلَ المسموحة", () => {
    expect(usernameValid("ali.omar")).toBe(true);
    expect(usernameValid("admin_01")).toBe(true);
    expect(usernameValid("a-b-c")).toBe(true);
  });

  it("يقبل ما حوله مسافاتٌ لأنّه يُشذَّب قبل الإرسال", () => {
    expect(usernameValid("  admin  ")).toBe(true);
  });
});

describe("اقتراح اسم الدخول", () => {
  it("يشتقّ من اللاتينيّ ويصله بنقطة", () => {
    expect(suggestUsername("Ali", "Omar")).toBe("ali.omar");
  });

  it("ينزع العلاماتِ التشكيلية", () => {
    expect(suggestUsername("José", "Martin")).toBe("jose.martin");
  });

  it("يعود فارغاً على اسمٍ عربيٍّ بحت — فلا يُملأ الحقلُ بنقاط", () => {
    expect(suggestUsername("محمد", "الأمين")).toBe("");
  });
});

describe("البريد", () => {
  it("يقبل الفارغَ لأنّه اختياريّ", () => {
    expect(emailValid("")).toBe(true);
    expect(emailValid("   ")).toBe(true);
  });

  it("يرفض ما لا نطاقَ له", () => {
    expect(emailValid("ali@")).toBe(false);
    expect(emailValid("ali@local")).toBe(false);
  });

  it("يقبل الصحيح", () => {
    expect(emailValid("ali@ajyal.dz")).toBe(true);
  });
});

describe("اسم المؤسسة", () => {
  it("يرفض الحرفَ الواحدَ والفارغ", () => {
    expect(institutionNameValid("")).toBe(false);
    expect(institutionNameValid("ن")).toBe(false);
  });

  it("يقبل الاسمَ المعتاد", () => {
    expect(institutionNameValid("مركز أجيال التعليمي")).toBe(true);
  });
});

describe("السنة الدراسية", () => {
  const valid = {
    name: "2026/2027",
    startDate: "2026-09-01",
    endDate: "2027-06-30",
    sessionsPerMonth: 8,
  };

  it("تمرّ الصحيحةُ بلا ملاحظة", () => {
    expect(academicYearIssues(valid)).toEqual([]);
  });

  it("ترفض نهايةً قبل البداية", () => {
    expect(
      academicYearIssues({ ...valid, endDate: "2026-08-30" }),
    ).toContain("order");
  });

  it("ترفض تساويَ التاريخين — يومٌ واحدٌ ليس سنة", () => {
    expect(
      academicYearIssues({ ...valid, endDate: valid.startDate }),
    ).toContain("order");
  });

  it("ترفض حصصاً خارج المدى", () => {
    expect(academicYearIssues({ ...valid, sessionsPerMonth: 0 })).toContain(
      "sessions",
    );
    expect(academicYearIssues({ ...valid, sessionsPerMonth: 40 })).toContain(
      "sessions",
    );
    expect(academicYearIssues({ ...valid, sessionsPerMonth: 8.5 })).toContain(
      "sessions",
    );
  });

  it("ترفض اسماً أقصرَ من أربعة محارف", () => {
    expect(academicYearIssues({ ...valid, name: "26" })).toContain("name");
  });
});

describe("اقتراح السنة", () => {
  it("من فتح البرنامجَ في أكتوبر يُقترح له سنةُ ذلك الخريف", () => {
    expect(suggestAcademicYear(new Date("2026-10-12")).name).toBe("2026/2027");
  });

  it("**ومن فتحه في مارس يُقترح له السنةُ الجارية لا التالية**", () => {
    /* وهذا هو كلُّ فائدة الاقتراح: من هو في وسط السنة لا في مطلعها */
    expect(suggestAcademicYear(new Date("2027-03-04")).name).toBe("2026/2027");
  });

  it("يقترح سبتمبر بدايةً وجوان نهاية", () => {
    const suggestion = suggestAcademicYear(new Date("2026-10-12"));

    expect(suggestion.startDate).toBe("2026-09-01");
    expect(suggestion.endDate).toBe("2027-06-30");
  });

  it("واقتراحُه صالحٌ دائماً — لا يُقترح ما يُرفض", () => {
    for (const month of ["01", "05", "07", "09", "12"]) {
      const suggestion = suggestAcademicYear(new Date(`2026-${month}-15`));

      expect(academicYearIssues(suggestion)).toEqual([]);
    }
  });
});

describe("الشبكة", () => {
  it("يقبل المضيفَ اسماً وعنواناً", () => {
    expect(hostValid("192.168.1.20")).toBe(true);
    expect(hostValid("server-01")).toBe(true);
  });

  it("يرفض المسافاتِ والشرطةَ المائلة والفارغ", () => {
    expect(hostValid("")).toBe(false);
    expect(hostValid("192.168.1.20/api")).toBe(false);
    expect(hostValid("my server")).toBe(false);
  });

  it("يحدّ المنفذَ بمداه", () => {
    expect(portValid("3001")).toBe(true);
    expect(portValid(0)).toBe(false);
    expect(portValid(70000)).toBe(false);
    expect(portValid("abc")).toBe(false);
  });
});
