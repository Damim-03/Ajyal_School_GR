import { describe, expect, it } from "vitest";

import {
  FIRST_BOOT_VERSION,
  TERMS_VERSION,
} from "./first-boot.state";
import {
  allPassed,
  evaluateChecks,
  failedKeys,
  type VerificationSnapshot,
} from "./first-boot.verify";

/**
 * التحقّقُ النهائي — تُقاس أحكامُه على لقطاتٍ مصنوعة.
 *
 * وهذا هو ثمنُ فصلِ الحكم عن الجمع: «ماذا لو كانت السنتان جاريتين؟»
 * سؤالٌ يُجاب في سطرين، ولا يحتاج قاعدةً ولا بذراً ولا خادماً.
 */

const healthy = (): VerificationSnapshot => ({
  databaseReachable: true,
  schemaReadable: true,
  language: "ar",
  country: "DZ",
  timezone: "Africa/Algiers",
  dateFormat: "DD/MM/YYYY",
  institutionName: "مركز النور",
  activeAdministrators: 1,
  adminRoleExists: true,
  adminPermissions: 96,
  acceptedTermsVersion: TERMS_VERSION,
  currentAcademicYears: 1,
  academicYearDatesValid: true,
  devicesRecorded: true,
  appVersion: "1.0.0",
  firstBootVersion: FIRST_BOOT_VERSION,
});

const check = (snapshot: VerificationSnapshot, key: string) =>
  evaluateChecks(snapshot).find((result) => result.key === key);

describe("لقطةٌ سليمة", () => {
  it("تمرّ بكل الفحوص", () => {
    const checks = evaluateChecks(healthy());

    expect(allPassed(checks)).toBe(true);
    expect(failedKeys(checks)).toEqual([]);
  });

  it("تُرجع فحصاً لكلّ بندٍ معلن", () => {
    const keys = evaluateChecks(healthy()).map((result) => result.key);

    expect(new Set(keys).size).toBe(keys.length);
    expect(keys).toContain("database");
    expect(keys).toContain("academicYear");
  });
});

describe("السنةُ الدراسية", () => {
  it("ترفض غيابَ سنةٍ جارية", () => {
    expect(
      check({ ...healthy(), currentAcademicYears: 0 }, "academicYear")?.ok,
    ).toBe(false);
  });

  it("ترفض سنتين جاريتين — وهو أسوأُ من لا سنة", () => {
    expect(
      check({ ...healthy(), currentAcademicYears: 2 }, "academicYear")?.ok,
    ).toBe(false);
  });

  it("ترفض تواريخَ مقلوبة", () => {
    expect(
      check({ ...healthy(), academicYearDatesValid: false }, "academicYear")?.ok,
    ).toBe(false);
  });
});

describe("المدير", () => {
  it("يرفض تركيباً بلا مديرٍ نشط", () => {
    expect(
      check({ ...healthy(), activeAdministrators: 0 }, "administrator")?.ok,
    ).toBe(false);
  });

  it("يرفض دوراً بلا صلاحيةٍ واحدة", () => {
    expect(check({ ...healthy(), adminPermissions: 0 }, "permissions")?.ok).toBe(
      false,
    );
  });
});

describe("الشروط", () => {
  it("ترفض موافقةً على نسخةٍ قديمة", () => {
    expect(
      check({ ...healthy(), acceptedTermsVersion: "0.9" }, "terms")?.ok,
    ).toBe(false);
  });

  it("ترفض غيابَ الموافقة", () => {
    expect(check({ ...healthy(), acceptedTermsVersion: "" }, "terms")?.ok).toBe(
      false,
    );
  });
});

describe("هوية المؤسسة", () => {
  it("ترفض اسماً فارغاً", () => {
    expect(check({ ...healthy(), institutionName: "" }, "institution")?.ok).toBe(
      false,
    );
  });

  it("ترفض اسماً من حرفٍ واحد", () => {
    expect(
      check({ ...healthy(), institutionName: "ن" }, "institution")?.ok,
    ).toBe(false);
  });
});

describe("سقوطُ القاعدة", () => {
  it("يُسقط كلَّ ما يعتمد عليها، وأوّلُ فحصٍ يقول السبب", () => {
    const down: VerificationSnapshot = {
      ...healthy(),
      databaseReachable: false,
      schemaReadable: false,
      activeAdministrators: 0,
      adminRoleExists: false,
      adminPermissions: 0,
      currentAcademicYears: 0,
      academicYearDatesValid: false,
    };

    const checks = evaluateChecks(down);

    expect(checks[0]!.key).toBe("database");
    expect(checks[0]!.ok).toBe(false);
    expect(allPassed(checks)).toBe(false);
  });
});

describe("المنطقة", () => {
  it("تحتاج الثلاثةَ معاً", () => {
    expect(check({ ...healthy(), timezone: "" }, "region")?.ok).toBe(false);
    expect(check({ ...healthy(), dateFormat: "" }, "region")?.ok).toBe(false);
    expect(check({ ...healthy(), country: "" }, "region")?.ok).toBe(false);
  });
});

describe("النسخة", () => {
  it("ترفض تركيباً هُيّئ بنسخةٍ أخرى من التهيئة", () => {
    expect(
      check({ ...healthy(), firstBootVersion: "0.1" }, "appVersion")?.ok,
    ).toBe(false);
  });

  it("ترفض غيابَ نسخةِ التطبيق", () => {
    expect(check({ ...healthy(), appVersion: "" }, "appVersion")?.ok).toBe(false);
  });
});
