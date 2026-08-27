import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";

import { normalizeCell, flattenCell } from "./normalize";
import { matchColumn, matchSheet, STUDENT_COLUMNS, TEACHER_COLUMNS } from "./columns";
import type { ColumnSpec } from "./columns";

/**
 * **يُختبر لأنّ خطأه يدخل القاعدة ولا يخرج منها.**
 *
 * سطرٌ يُردّ يُصلحه المستخدم في دقيقة. أمّا خانةٌ سُوّيت خطأً —
 * تاريخُ ميلادٍ أنقص يوماً، أو هاتفٌ سقط صفرُه — فتدخل صحيحةَ الشكل
 * وتبقى، ولا يظهر أثرُها إلّا بعد شهور.
 */

const col = (key: string, from = STUDENT_COLUMNS): ColumnSpec =>
  from.find((c) => c.key === key)!;

// ======================================================
describe("مطابقة العناوين", () => {
  it("تتسامح مع الهمزة والتاء المربوطة", () => {
    expect(matchColumn("الإسم", STUDENT_COLUMNS)?.key).toBe("firstName");
    expect(matchColumn("الاسم", STUDENT_COLUMNS)?.key).toBe("firstName");
    expect(matchColumn("هاتف الوليّ", STUDENT_COLUMNS)?.key).toBe("parentPhone");
    expect(matchColumn("المؤهّل", TEACHER_COLUMNS)?.key).toBe("qualification");
  });

  it("تتجاهل المسافات الزائدة", () => {
    expect(matchColumn("  تاريخ   الميلاد ", STUDENT_COLUMNS)?.key).toBe("birthDate");
  });

  it("تردّ null لعمودٍ مجهول", () => {
    expect(matchColumn("رقم الطالب", STUDENT_COLUMNS)).toBeNull();
    expect(matchColumn("", STUDENT_COLUMNS)).toBeNull();
  });

  it("تعرف الورقتين بمرادفاتهما", () => {
    expect(matchSheet("الطلبة")).toBe("students");
    expect(matchSheet("التلاميذ")).toBe("students");
    expect(matchSheet("الاساتذة")).toBe("teachers");
    expect(matchSheet("ورقة1")).toBeNull();
  });
});

// ======================================================
describe("الفراغ", () => {
  it("الإلزاميُّ الفارغ يُردّ", () => {
    expect(normalizeCell(null, col("firstName")).error).toContain("مطلوب");
    expect(normalizeCell("   ", col("parentPhone")).error).toContain("مطلوب");
  });

  it("الاختياريُّ الفارغ يمرّ صامتاً", () => {
    const out = normalizeCell(null, col("note"));
    expect(out.value).toBeNull();
    expect(out.error).toBeUndefined();
    expect(out.warning).toBeUndefined();
  });
});

// ======================================================
describe("الجنس ونعم/لا", () => {
  it("يقبل ما يكتبه الناس", () => {
    for (const v of ["ذكر", "ذكور", "Male", "م"]) {
      expect(normalizeCell(v, col("gender")).value).toBe("MALE");
    }
    for (const v of ["أنثى", "انثى", "Female", "بنت"]) {
      expect(normalizeCell(v, col("gender")).value).toBe("FEMALE");
    }
  });

  it("يردّ ما سواهما", () => {
    expect(normalizeCell("غير محدد", col("gender")).error).toContain("ذكر");
  });

  it("نعم/لا بصيغها", () => {
    expect(normalizeCell("نعم", col("isActive")).value).toBe(true);
    expect(normalizeCell("لا", col("isActive")).value).toBe(false);
    expect(normalizeCell(1, col("isActive")).value).toBe(true);
    expect(normalizeCell("ربما", col("isActive")).error).toBeTruthy();
  });
});

// ======================================================
describe("الهاتف", () => {
  it("يحفظ الصفر البادئ من خانةٍ نصّية", () => {
    expect(normalizeCell("0550123456", col("parentPhone")).value).toBe("0550123456");
  });

  it("يحوّل الأرقام العربية", () => {
    expect(normalizeCell("٠٥٥٠١٢٣٤٥٦", col("parentPhone")).value).toBe("0550123456");
  });

  /*
   * الصفرُ ضاع في الملفّ قبل أن يبلغنا — فلا يُردّ السطر، ويُنبَّه.
   * وهذا أخطرُ ما في الاستيراد لأنّ الخادم يقبله صامتاً.
   */
  it("ينبّه على الرقم الذي أُدخل عدداً", () => {
    const out = normalizeCell(550123456, col("parentPhone"));

    expect(out.value).toBe("550123456");
    expect(out.warning).toContain("صفره البادئ");
    expect(out.error).toBeUndefined();
  });

  it("يردّ ما فيه حروف أو ما قصُر", () => {
    expect(normalizeCell("0550-ABC", col("parentPhone")).error).toBeTruthy();
    expect(normalizeCell("0550", col("parentPhone")).error).toContain("أقصر");
  });
});

// ======================================================
describe("التاريخ", () => {
  it("يقبل YYYY-MM-DD", () => {
    expect(normalizeCell("2010-04-03", col("birthDate")).value).toBe("2010-04-03");
  });

  it("يقبل DD/MM/YYYY على العُرف المحلّي", () => {
    expect(normalizeCell("03/04/2010", col("birthDate")).value).toBe("2010-04-03");
  });

  it("يردّ ما لا يُفهم وما لا وجود له", () => {
    expect(normalizeCell("مارس 2010", col("birthDate")).error).toBeTruthy();
    expect(normalizeCell("2010-02-30", col("birthDate")).error).toBeTruthy();
  });

  it("يردّ المستقبل حيث يشترط الخادم الماضي", () => {
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);

    const iso = next.toISOString().slice(0, 10);
    expect(normalizeCell(iso, col("birthDate")).error).toContain("المستقبل");
  });

  it("لا يشترط الماضي حيث لا يشترطه الخادم", () => {
    const next = new Date();
    next.setFullYear(next.getFullYear() + 1);

    const iso = next.toISOString().slice(0, 10);
    expect(normalizeCell(iso, col("registrationDate")).error).toBeUndefined();
  });
});

// ======================================================
describe("الرقم والبريد والنصّ", () => {
  it("الأجر يرفض الصفر ويقبل ما فوقه", () => {
    const salary = col("salary", TEACHER_COLUMNS);

    expect(normalizeCell(0, salary).error).toContain("أكبر من صفر");
    expect(normalizeCell(35000, salary).value).toBe(35000);
  });

  it("مبلغ حقوق التسجيل يقبل الصفر", () => {
    expect(normalizeCell(0, col("registrationFeeAmount")).value).toBe(0);
  });

  it("البريد يُخفَّض ويُتحقَّق", () => {
    const email = col("email", TEACHER_COLUMNS);

    expect(normalizeCell(" Ali@Example.COM ", email).value).toBe("ali@example.com");
    expect(normalizeCell("ali(at)example", email).error).toBeTruthy();
  });

  it("النصّ يُقصّ ويُقاس", () => {
    expect(normalizeCell("  محمد  الأمين ", col("firstName")).value).toBe("محمد الأمين");
    expect(normalizeCell("ع", col("firstName")).error).toBeTruthy();
    expect(normalizeCell("x".repeat(60), col("firstName")).error).toContain("50");
  });
});

// ======================================================
describe("تسوية ما يعطيه exceljs", () => {
  it("تفكّ النصّ المنسَّق والصيغة", () => {
    expect(flattenCell({ richText: [{ text: "محمد" }, { text: " الأمين" }] })).toBe(
      "محمد الأمين",
    );
    expect(flattenCell({ result: "0550123456", formula: "A1" })).toBe("0550123456");
  });

  /*
   * **الفحص الحاسم**: ملفٌّ حقيقيّ يُكتب ثمّ يُقرأ. حسابُ التاريخ
   * بالتوقيت المحلّي بدل UTC يُنقص يوماً في نصف الكرة الغربي، ولا
   * يكشفه إلّا هذا — لا قراءةُ الشيفرة.
   */
  it("تقرأ تاريخاً من ملفٍّ حقيقيّ بلا انزياحِ يوم", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("الطلبة");

    ws.addRow(["تاريخ الميلاد", "هاتف الولي"]);
    ws.addRow([new Date(Date.UTC(2010, 3, 3)), "0550123456"]);

    const buffer = await wb.xlsx.writeBuffer();

    const back = new ExcelJS.Workbook();
    await back.xlsx.load(buffer as ArrayBuffer);

    const row = back.getWorksheet("الطلبة")!.getRow(2);

    expect(normalizeCell(row.getCell(1).value, col("birthDate")).value).toBe(
      "2010-04-03",
    );
    expect(normalizeCell(row.getCell(2).value, col("parentPhone")).value).toBe(
      "0550123456",
    );
  });
});
