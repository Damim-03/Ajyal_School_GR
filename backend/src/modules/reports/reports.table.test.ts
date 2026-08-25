import { describe, expect, it } from "vitest";
import { buildTable, column, emptyTable, resolveSort, skipTake } from "./reports.table";
import {
  ATTENDANCE_SORT,
  STUDENT_COLUMNS,
  STUDENT_SORT,
  TEACHER_COLUMNS,
  TEACHER_SORT,
} from "./reports.tables";

const request = (overrides: Record<string, unknown> = {}) => ({
  page: 1,
  pageSize: 50,
  sortDir: "desc" as const,
  ...overrides,
});

describe("resolveSort — §67", () => {
  it("يقبل عموداً في القائمة البيضاء", () => {
    const sort = resolveSort(
      request({ sortBy: "studentNumber", sortDir: "asc" }),
      STUDENT_SORT,
    );

    expect(sort.key).toBe("studentNumber");
    expect(sort.orderBy).toEqual({ studentNumber: "asc" });
  });

  /*
   * الحاجزُ الأمني: `?sortBy=password` لا يسرّب القيمة، لكنّه
   * يرتّب الصفوفَ بها فيُستنتج ترتيبُ المخفيّ بالمقارنة. وحقلٌ لا
   * وجود له يُسقط الاستعلام بـ500 يكشف بنيةَ المخطّط.
   */
  it("يُهمل عموداً خارج القائمة إلى الافتراضي", () => {
    const sort = resolveSort(request({ sortBy: "password" }), STUDENT_SORT);
    expect(sort.key).toBe("name");
  });

  it("يُهمل محاولةَ الوصول إلى حقلٍ داخلي", () => {
    for (const attempt of ["__proto__", "constructor", "id;DROP", "student.ssn"]) {
      expect(resolveSort(request({ sortBy: attempt }), STUDENT_SORT).key).toBe(
        "name",
      );
    }
  });

  it("بلا sortBy يسقط إلى الافتراضي", () => {
    expect(resolveSort(request(), STUDENT_SORT).key).toBe("name");
  });

  /*
   * الفرزُ بالاسم على حقلين: اللقب ثمّ الاسم — القوائمُ الإدارية
   * تُقرأ بالألقاب.
   */
  it("الفرزُ بالاسم يبني ترتيباً مركّباً", () => {
    const sort = resolveSort(request({ sortDir: "asc" }), STUDENT_SORT);

    expect(sort.orderBy).toEqual([{ lastName: "asc" }, { firstName: "asc" }]);
  });

  /*
   * سجلُّ الحضور لا يحمل تاريخاً؛ التاريخُ في الحصّة. والفرزُ
   * بـ`createdAt` كان سيرتّب بلحظة التدوين لا بيوم الحصّة (§58).
   */
  it("فرزُ الحضور بالتاريخ يمرّ بالحصّة", () => {
    const sort = resolveSort(
      request({ sortBy: "sessionDate", sortDir: "desc" }),
      ATTENDANCE_SORT,
    );

    expect(sort.orderBy).toEqual({ session: { sessionDate: "desc" } });
  });

  it("يحترم اتجاه الفرز", () => {
    expect(
      resolveSort(request({ sortBy: "status", sortDir: "asc" }), ATTENDANCE_SORT)
        .direction,
    ).toBe("asc");
  });
});

describe("skipTake", () => {
  it("الصفحة الأولى بلا تخطٍّ", () => {
    expect(skipTake(request())).toEqual({ skip: 0, take: 50 });
  });

  it("الصفحة الثالثة تتخطّى صفحتين", () => {
    expect(skipTake(request({ page: 3, pageSize: 20 }))).toEqual({
      skip: 40,
      take: 20,
    });
  });
});

describe("buildTable", () => {
  const sort = { key: "name", direction: "asc" as const, orderBy: {} };

  it("يبني الترقيم من المجموع الكلّي لا من عدد الصفحة", () => {
    const table = buildTable({
      columns: STUDENT_COLUMNS,
      rows: [{ id: "1" }, { id: "2" }],
      total: 428,
      request: request({ page: 2 }),
      sort,
    });

    expect(table.rows).toHaveLength(2);
    expect(table.pagination.total).toBe(428);
    expect(table.pagination.totalPages).toBe(9);
  });

  it("يُرفق وجهةَ النقر على الصفّ حين تُعطى", () => {
    const table = buildTable({
      columns: STUDENT_COLUMNS,
      rows: [],
      total: 0,
      request: request(),
      sort,
      rowDrill: { to: "/reports/students", idKey: "id" },
    });

    expect(table.rowDrill?.to).toBe("/reports/students");
  });

  it("يُسقط الحقل حين لا وجهة", () => {
    const table = buildTable({
      columns: STUDENT_COLUMNS,
      rows: [],
      total: 0,
      request: request(),
      sort,
    });

    expect("rowDrill" in table).toBe(false);
  });
});

describe("emptyTable — §48", () => {
  /*
   * أعمدةٌ بلا صفوف لا `null`: الواجهةُ ترسم الترويسةَ وتعرض حالةَ
   * الفراغ تحتها، فيبقى الجدولُ مفهوماً بدل أن يختفي فيُظنّ أنّ
   * الشاشة معطوبة.
   */
  it("يحتفظ بالأعمدة ويصفّر الصفوف", () => {
    const table = emptyTable(STUDENT_COLUMNS, request(), "name");

    expect(table.columns).toHaveLength(STUDENT_COLUMNS.length);
    expect(table.rows).toHaveLength(0);
    expect(table.pagination.totalPages).toBe(1);
  });
});

describe("column", () => {
  /*
   * المحاذاة تتبع النوع لا المزاج: الأرقامُ إلى النهاية لتصطفّ
   * خاناتُها فتُقارَن بالنظر.
   */
  it("يحاذي الأرقام إلى النهاية والنصّ إلى البداية", () => {
    expect(column("amount", "المبلغ", "money").align).toBe("end");
    expect(column("rate", "النسبة", "percent").align).toBe("end");
    expect(column("name", "الاسم", "text").align).toBe("start");
    expect(column("date", "التاريخ", "date").align).toBe("start");
  });

  it("الأعمدة غير قابلة للفرز افتراضياً", () => {
    expect(column("x", "س", "text").sortable).toBe(false);
  });
});

describe("اتّساق تعريفات الجداول", () => {
  /*
   * كلُّ عمودٍ معلَنٍ قابلاً للفرز يجب أن يكون في القائمة البيضاء.
   *
   * وإلّا عرضت الواجهةُ رأساً قابلاً للنقر يُهمَل عند الخادم —
   * فيضغط المستخدم ولا يتغيّر شيء، وهو أسوأ من عمودٍ لا يُنقر.
   */
  it("كلُّ عمودٍ قابلٍ للفرز له مدخلٌ في القائمة البيضاء", () => {
    const pairs: [typeof STUDENT_COLUMNS, typeof STUDENT_SORT][] = [
      [STUDENT_COLUMNS, STUDENT_SORT],
      [TEACHER_COLUMNS, TEACHER_SORT],
    ];

    for (const [columns, spec] of pairs) {
      for (const col of columns.filter((c) => c.sortable)) {
        expect(spec.allowed).toHaveProperty(col.key);
      }
    }
  });

  it("العمودُ الافتراضي موجودٌ في القائمة البيضاء", () => {
    for (const spec of [STUDENT_SORT, ATTENDANCE_SORT, TEACHER_SORT]) {
      expect(spec.allowed).toHaveProperty(spec.fallback);
    }
  });

  /*
   * أعمدةُ المستحقّ والمدفوع غيرُ قابلةٍ للفرز — نقصٌ معروف لا
   * سهو: الرقمان محسوبان بعد الجلب من ثلاثة مصادر فلا يقابلهما
   * عمودٌ يُفرز به في القاعدة. وفرزُهما على الصفحة وحدها يكذب.
   */
  it("مستحقّ الأستاذ معلَنٌ غيرَ قابلٍ للفرز", () => {
    const entitlement = TEACHER_COLUMNS.find((c) => c.key === "entitlement");

    expect(entitlement?.sortable).toBe(false);
    expect(TEACHER_SORT.allowed).not.toHaveProperty("entitlement");
  });
});
