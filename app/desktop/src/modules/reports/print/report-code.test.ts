import { describe, expect, it } from "vitest";

import { SCREENS } from "../reports.catalog";
import type { ReportResponse } from "../reports.api";
import { decodeReportCode, entityFingerprint, reportCode } from "./report-code";

const report = (
  key: string,
  year: number | null = 2026,
  month: number | null = 9,
  entityId?: string,
): ReportResponse =>
  ({
    meta: {
      report: key,
      academicYear: null,
      period: { kind: "month", label: "", from: null, to: null, month, year },
      filters: {},
      supportedFilters: [],
      comparison: null,
      generatedAt: "2026-09-15T10:00:00.000Z",
      freshness: { source: "live", cachedAt: null },
    },
    summary: {},
    charts: [],
    table: null,
    ...(entityId
      ? {
          detail: {
            id: entityId,
            kind: "student",
            title: "",
            subtitle: null,
            sections: [],
            tables: [],
          },
        }
      : {}),
  }) as ReportResponse;

describe("reportCode — شكلُ رموز المشروع", () => {
  /*
   * ثلاثَ عشرةَ خانةً رقمية: نفسُ الإيصال والدفعة والكشف. فيُقرأ
   * الجميعُ بماسحٍ واحد ويُطبع بنفس عرض الباركود.
   */
  it("ثلاثَ عشرةَ خانةً رقمية دائماً", () => {
    for (const screen of SCREENS) {
      expect(reportCode(report(screen.key))).toMatch(/^\d{13}$/);
    }
  });

  it("يبدأ بالبادئة 7", () => {
    expect(reportCode(report("overview"))[0]).toBe("7");
  });

  it("بلا فترة يبقى ثلاثَ عشرةَ خانة", () => {
    expect(reportCode(report("overview", null, null))).toMatch(/^\d{13}$/);
  });

  it("تقريران مختلفان رمزان مختلفان", () => {
    expect(reportCode(report("students"))).not.toBe(
      reportCode(report("invoices")),
    );
  });

  it("فترتان مختلفتان رمزان مختلفان", () => {
    expect(reportCode(report("financial", 2026, 9))).not.toBe(
      reportCode(report("financial", 2026, 10)),
    );
  });

  /*
   * التوليدُ حتميّ لا عشوائي: رمزٌ عشوائيّ بلا صفٍّ يحفظه لا يُمسح —
   * المسحةُ تقرأ رقماً لا يدلّ على شيء.
   */
  it("حتميّ — نفسُ التقرير نفسُ الرمز", () => {
    expect(reportCode(report("debts", 2026, 3))).toBe(
      reportCode(report("debts", 2026, 3)),
    );
  });
});

describe("decodeReportCode — العَكوسية", () => {
  it("يُفكّ إلى ما شُفّر", () => {
    for (const screen of SCREENS) {
      const decoded = decodeReportCode(reportCode(report(screen.key, 2026, 9)));

      expect(decoded?.reportKey, screen.key).toBe(screen.key);
      expect(decoded?.year).toBe(2026);
      expect(decoded?.month).toBe(9);
    }
  });

  it("يُفكّ بصمةَ الكيان", () => {
    const id = "cmsqsgex0000kz4vv1mlyw9n9";
    const decoded = decodeReportCode(reportCode(report("students", 2026, 9, id)));

    expect(decoded?.fingerprint).toBe(entityFingerprint(id));
  });

  it("بلا فترة يُفكّ إلى null لا صفر", () => {
    const decoded = decodeReportCode(reportCode(report("overview", null, null)));

    expect(decoded?.year).toBeNull();
    expect(decoded?.month).toBeNull();
  });

  /*
   * البنيةُ تعمل عملَ خانة تحقّق: رمزُ كشفٍ عشوائيّ يُفكّ إلى فهرسِ
   * تقريرٍ لا وجودَ له غالباً فيُرفض — ثمّ يُجرَّب كشفاً.
   */
  it("يرفض ما ليس رمزَ تقرير", () => {
    expect(decodeReportCode("3761032966147")).toBeNull();
    expect(decodeReportCode("RPT-OVERVIEW-2026")).toBeNull();
    expect(decodeReportCode("123")).toBeNull();
    expect(decodeReportCode("")).toBeNull();
  });

  it("يرفض بادئةً صحيحة بفهرسٍ مجهول", () => {
    expect(decodeReportCode("7990000000000")).toBeNull();
  });

  it("يتحمّل الفراغ حول الرمز", () => {
    const code = reportCode(report("payments", 2026, 5));

    expect(decodeReportCode(`  ${code}  `)?.reportKey).toBe("payments");
  });
});

describe("entityFingerprint", () => {
  it("أربعُ خاناتٍ فأقلّ", () => {
    for (const id of ["a", "cmsqsgex0000kz4vv1mlyw9n9", "x".repeat(60)]) {
      expect(entityFingerprint(id)).toBeLessThan(10000);
      expect(entityFingerprint(id)).toBeGreaterThanOrEqual(0);
    }
  });

  it("حتميّ", () => {
    expect(entityFingerprint("abc")).toBe(entityFingerprint("abc"));
  });

  it("معرّفان مختلفان بصمتان مختلفتان غالباً", () => {
    const ids = Array.from({ length: 400 }, (_, i) => `cms${i}xyz${i * 7}`);
    const prints = new Set(ids.map(entityFingerprint));

    /*
     * أربعُ خاناتٍ عشرةُ آلاف احتمال، فأربعمئةُ معرّفٍ تتصادم قليلاً.
     * والبصمةُ لا تعرّف وحدها — تُبحث داخل التقرير الذي يقوله الرمز.
     */
    expect(prints.size).toBeGreaterThan(380);
  });
});
