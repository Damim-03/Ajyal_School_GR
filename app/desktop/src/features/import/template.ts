import { COLUMNS, SHEET_NAMES, type ColumnSpec, type SheetKind } from "./columns";

/**
 * **النموذجُ الفارغ — يمنع الخطأ قبل أن يقع.**
 *
 * لا يكفي أن نصف الأعمدة في ورقةٍ ويكتبها المستخدم بنفسه: أخطرُ
 * أخطاء الاستيراد يصنعها Excel لا الإنسان، وأشهرُها أنّ
 * `0550123456` في خانةٍ رقمية يصير `550123456`. والتصييغُ بعد
 * اللصق لا يُعيد الصفر.
 *
 * فيُولَّد النموذجُ بأعمدةِ الهواتف والتواريخ **مصيَّغةً نصّاً سلفاً**،
 * ومع قوائم منسدلة للجنس ولـ«نعم/لا». وبذلك لا يبقى للمستخدم إلّا
 * أن يكتب ما يعرفه.
 */

/** لونُ الترويسة — أخضرُ للإلزاميّ ورماديٌّ لما سواه */
const FILL_REQUIRED = "FFD9E8E3";
const FILL_OPTIONAL = "FFEFEFEF";

const needsTextFormat = (column: ColumnSpec) =>
  column.field.kind === "phone" || column.field.kind === "date";

const dropdownFor = (column: ColumnSpec): string[] | null => {
  if (column.field.kind === "gender") return ["ذكر", "أنثى"];
  if (column.field.kind === "bool") return ["نعم", "لا"];
  return null;
};

/** أمثلةٌ تُكتب في سطرٍ واحد يُحذف — تُري الصيغة ولا تُستورد */
const SAMPLE: Readonly<Record<string, string>> = {
  lastName: "بن عمر",
  firstName: "علي",
  gender: "ذكر",
  parentPhone: "0550123456",
  birthDate: "2010-04-03",
  birthPlace: "الجزائر",
  __stage: "متوسط",
  __level: "الأولى",
  hireDate: "2024-09-01",
  email: "prof@example.com",
  phone: "0770123456",
  salary: "35000",
  isActive: "نعم",
};

const buildSheet = (
  workbook: { addWorksheet: (name: string, options?: unknown) => Worksheet },
  kind: SheetKind,
) => {
  const spec = COLUMNS[kind];

  const sheet = workbook.addWorksheet(SHEET_NAMES[kind], {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });

  // ---------- الترويسة ----------
  sheet.addRow(spec.map((c) => c.header));

  const header = sheet.getRow(1);
  header.font = { bold: true, size: 12 };
  header.height = 26;
  header.alignment = { vertical: "middle", horizontal: "center", wrapText: true };

  spec.forEach((column, index) => {
    const cell = header.getCell(index + 1);

    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: column.required ? FILL_REQUIRED : FILL_OPTIONAL },
    };

    /* التعليقُ يحمل القيد — يُقرأ بمرور المؤشّر بلا فتح دليل */
    const parts = [column.required ? "إلزامي" : "اختياري"];
    if (column.hint) parts.push(column.hint);

    cell.note = parts.join(" · ");

    const width = Math.max(column.header.length + 6, 14);
    sheet.getColumn(index + 1).width = width;

    /*
     * النصُّ قبل الكتابة لا بعدها — وهذا هو الغرض الأوّل من النموذج.
     */
    if (needsTextFormat(column)) sheet.getColumn(index + 1).numFmt = "@";
  });

  // ---------- سطرُ المثال ----------
  sheet.addRow(spec.map((c) => SAMPLE[c.key] ?? ""));

  const sample = sheet.getRow(2);
  sample.font = { italic: true, color: { argb: "FF9AA3AE" } };

  // ---------- القوائم المنسدلة ----------
  spec.forEach((column, index) => {
    const options = dropdownFor(column);
    if (!options) return;

    for (let r = 2; r <= 1000; r++) {
      sheet.getCell(r, index + 1).dataValidation = {
        type: "list",
        allowBlank: !column.required,
        formulae: [`"${options.join(",")}"`],
      };
    }
  });

  return sheet;
};

interface Worksheet {
  addRow: (values: unknown[]) => { font?: unknown; height?: number; alignment?: unknown; getCell: (n: number) => Record<string, unknown> };
  getRow: (n: number) => { font?: unknown; height?: number; alignment?: unknown; getCell: (n: number) => Record<string, unknown> };
  getColumn: (n: number) => { width?: number; numFmt?: string };
  getCell: (r: number, c: number) => Record<string, unknown>;
}

const GUIDE_COMMON = [
  "١ · احذف سطر المثال (الثاني، الرمادي المائل) قبل الاستيراد.",
  "٢ · العمود الأخضر إلزاميّ، والرمادي اختياريّ — واتركه فارغاً إن لم تعرف قيمته، ولا تكتب «-» ولا «لا يوجد».",
  "٣ · أعمدة الهواتف والتواريخ مصيَّغةٌ نصّاً سلفاً. لا تُغيّر تصييغها، وإلّا سقط الصفر البادئ من الأرقام.",
  "٤ · التواريخ تُكتب YYYY-MM-DD — مثال: 2010-04-03.",
];

const GUIDE_BY_KIND: Readonly<Record<SheetKind, readonly string[]>> = {
  students: [
    "٥ · «الطور» و«المستوى» يجب أن يطابقا ما في البنية الدراسية داخل البرنامج. والمستوى غير الموجود يُردّ سطرُه ولا يُنشأ.",
    "٦ · لا تضع عمود «رقم الطالب» — يولّده البرنامج، وكتابتُه يدوياً تُفسد باركود البطاقة.",
    "٧ · لا يوجد في القاعدة ما يمنع تكرار الطالب. لا تُعد استيراد ملفٍّ نجح، والبرنامج يُنبّهك على المشتبه بتكراره.",
    "",
    "بعد الاستيراد",
    "",
    "تسجيل الطلبة في المواد خطوةٌ مستقلّة تُنجَز من شاشة «إسناد الطلبة» — ولا تُكتب في هذا الملفّ.",
  ],
  teachers: [
    "٥ · «تاريخ التوظيف» إلزاميّ ويجب أن يكون في الماضي.",
    "٦ · «البريد الإلكتروني» فريدٌ في المؤسسة — لا يتكرّر في الملفّ ولا يصطدم بأستاذٍ قائم. واتركه فارغاً لمن لا بريد له.",
    "",
    "بعد الاستيراد",
    "",
    "إسناد المواد والأفواج إلى الأستاذ خطوةٌ مستقلّة تُنجَز من شاشة «الإسنادات» — ولا تُكتب في هذا الملفّ.",
  ],
};

/**
 * يبني نموذج نوعٍ واحد ويُعيده بايتاتٍ جاهزةً للحفظ.
 *
 * **ورقةٌ واحدة لا مصنَّفٌ يجمع النوعين**: كلُّ محورٍ يستورد أهله من
 * شاشته، وملفٌّ يحمل الاثنين يجعل شاشةَ الطلبة تكتب أساتذةً.
 *
 * والسطرُ الثاني مثالٌ رماديٌّ مائل — **يُحذف قبل الاستيراد**، ويقول
 * ذلك سطرُ التعليمات في الورقة الثانية.
 */
export const buildTemplate = async (kind: SheetKind): Promise<Blob> => {
  const { default: ExcelJS } = await import("exceljs");

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NexSchool";
  workbook.created = new Date();

  buildSheet(
    workbook as unknown as { addWorksheet: (n: string, o?: unknown) => Worksheet },
    kind,
  );

  // ---------- ورقة التعليمات ----------
  const guide = workbook.addWorksheet("اقرأني", {
    views: [{ rightToLeft: true }],
  });

  guide.getColumn(1).width = 96;

  const lines = [
    `نموذج استيراد ${SHEET_NAMES[kind]}`,
    "",
    ...GUIDE_COMMON,
    ...GUIDE_BY_KIND[kind],
  ];

  lines.forEach((line, index) => {
    const row = guide.addRow([line]);
    row.alignment = { wrapText: true, vertical: "middle" };

    if (index === 0 || line === "بعد الاستيراد") {
      row.font = { bold: true, size: 13 };
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Blob([buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
};
