/**
 * إدخال ورقة المؤسسة الأصلية — «كشف التخليص اليومي للطلبة»، الشهر 04.
 *
 * غرضُه واحد: أن نقارن ما يحسبه النظام بما هو مكتوبٌ على الورقة
 * بخطّ اليد. فالبيانات تُدخل كما هي — ثلاثة عشر اسماً بحضورهم
 * وغيابهم — ولا يُدخل رقمٌ محسوب واحد.
 *
 * **لا يحذف شيئاً.** الطلبةُ الستةَ عشرَ القدامى وفواتيرُهم ودفعاتُهم
 * تبقى كما هي، ويُنشأ لأهل الورقة **فوجٌ مستقل** تحت «أولى متوسط».
 * وسببُ ذلك قاعدةُ المستخدم نفسها (§31): السجلّ المالي لا يُحذف. ولو
 * أُضيفوا إلى فوج DEMO لصار عدد المسجَّلين تسعةً وعشرين ولفسد كلّ رقم.
 *
 * والتواريخ مخترعة — ثمانية سبوتٍ من 05/09/2026 — لأنّ خانات
 * «تاريخ الحضور» في الورقة تُركت فارغة. وهي داخل السنة الدراسية
 * الجارية عمداً، فلا يقع فخُّ «ساري من» في سياسة التخليص.
 *
 * التشغيل من مجلد backend:
 *   & "C:\Program Files\nodejs\node.exe" node_modules\ts-node\dist\bin.js scripts/seed-paper-sheet.ts
 */

import { Prisma } from "../src/generated/prisma";
import { prisma } from "../src/core/prisma/client";
import { buildScopeKey } from "../src/core/pricing/tuition-scope";
import { randomDocumentNumber } from "../src/core/utils/document-number";

// --------------------------------------------------
// الورقة حرفياً
// --------------------------------------------------

/**
 * «اسم ولقب الطالب» — اللقب أوّلاً كما في الورقة.
 *
 * والأسماء تُنسخ بحروفها كما كُتبت بخطّ اليد: «الامين» لا «الأمين»،
 * و«احمد» لا «أحمد»، و«ايوب» لا «أيوب». فالاسم يُطابِق السجلّ ولا
 * يُصحَّح إملائياً — ورقةٌ تحمل اسماً غير الذي في الملفّ لا تُقبل.
 *
 * وحدُّ اللقب من الاسم اجتهادٌ حيث احتمل الاسمُ وجهين — «اللان بلقاسم
 * بن سهيل» و«قية احمد رامي» — فراجعه.
 */
interface PaperRow {
  rank: number;
  lastName: string;
  firstName: string;
  gender: "MALE" | "FEMALE";
  /** أرقام الحصص التي غاب فيها — وما عداها حضور */
  absentIn: number[];
  /** «مخلف» في عمود الملاحظات — حالةٌ مالية لا حضورية */
  defaulter: boolean;
}

const PAPER: PaperRow[] = [
  { rank: 1, lastName: "كير", firstName: "مهدي", gender: "MALE", absentIn: [], defaulter: false },
  { rank: 2, lastName: "لالة", firstName: "عبد الله", gender: "MALE", absentIn: [], defaulter: false },
  { rank: 3, lastName: "هدفي", firstName: "محمد الامين", gender: "MALE", absentIn: [], defaulter: true },
  { rank: 4, lastName: "قية", firstName: "احمد رامي", gender: "MALE", absentIn: [], defaulter: true },
  { rank: 5, lastName: "بسة", firstName: "ملاك", gender: "FEMALE", absentIn: [], defaulter: false },
  { rank: 6, lastName: "نيس", firstName: "غفران", gender: "FEMALE", absentIn: [], defaulter: false },
  { rank: 7, lastName: "نصروش", firstName: "روان", gender: "FEMALE", absentIn: [], defaulter: false },
  { rank: 8, lastName: "خلف", firstName: "ايوب", gender: "MALE", absentIn: [], defaulter: false },
  { rank: 9, lastName: "كرشو", firstName: "حسناء", gender: "FEMALE", absentIn: [], defaulter: false },
  { rank: 10, lastName: "اللان", firstName: "بلقاسم بن سهيل", gender: "MALE", absentIn: [], defaulter: true },
  { rank: 11, lastName: "باهي", firstName: "مهدي", gender: "MALE", absentIn: [], defaulter: true },
  // الصفّان الأخيران: غيابٌ في الحصص الخمس الأولى ثم حضورٌ في الثلاث
  { rank: 12, lastName: "زديك", firstName: "سيف", gender: "MALE", absentIn: [1, 2, 3, 4, 5], defaulter: false },
  { rank: 13, lastName: "قروري", firstName: "محمد الفاتح", gender: "MALE", absentIn: [1, 2, 3, 4, 5], defaulter: false },
];

const SESSION_COUNT = 8;
const SHEET_NUMBER = 4;
const MONTHLY_FEE = new Prisma.Decimal(1500);

/** ثمانية سبوت — مخترعة، فالورقة تركت خاناتها فارغة */
const SESSION_DATES = [
  "2026-09-05", "2026-09-12", "2026-09-19", "2026-09-26",
  "2026-10-03", "2026-10-10", "2026-10-17", "2026-10-24",
].map((iso) => new Date(`${iso}T00:00:00.000Z`));

/** شهر الفاتورة — شهر أوّل حصة، وهي القاعدة المعتمدة في النظام */
const INVOICE_MONTH = 9;
const INVOICE_YEAR = 2026;

// --------------------------------------------------

const must = <T>(value: T | null, what: string): T => {
  if (value === null) throw new Error(`لم أجد ${what}`);
  return value;
};

const main = async () => {
  const year = must(
    await prisma.academicYear.findFirst({ where: { isCurrent: true } }),
    "سنةً دراسية جارية",
  );

  const stage = must(
    await prisma.educationStage.findFirst({ where: { name: "متوسط" } }),
    "الطور «متوسط»",
  );

  const level = must(
    await prisma.level.findFirst({
      where: { educationStageId: stage.id, name: "أولى متوسط" },
    }),
    "المستوى «أولى متوسط»",
  );

  const subject = must(
    await prisma.subject.findFirst({ where: { name: "الإنجليزية" } }),
    "المادة «الإنجليزية»",
  );

  const teacher = must(
    await prisma.teacher.findFirst({
      where: { firstName: "نزيهة", lastName: "كير" },
    }),
    "الأستاذة «كير نزيهة»",
  );

  const cashier = must(
    await prisma.user.findFirst({ where: { username: "admin" } }),
    "مستخدماً يقبض الدفعات",
  );

  const classroom = await prisma.classroom.findFirst({ orderBy: { name: "asc" } });

  // ---------- الفوج ----------

  const group = await prisma.studyGroup.upsert({
    where: { levelId_name: { levelId: level.id, name: "الفوج 1" } },
    update: {},
    create: { levelId: level.id, name: "الفوج 1", type: "NORMAL" },
  });

  const assignment = await prisma.teachingAssignment.upsert({
    where: {
      teacherId_subjectId_studyGroupId_academicYearId: {
        teacherId: teacher.id,
        subjectId: subject.id,
        studyGroupId: group.id,
        academicYearId: year.id,
      },
    },
    update: {},
    create: {
      teacherId: teacher.id,
      subjectId: subject.id,
      studyGroupId: group.id,
      academicYearId: year.id,
    },
  });

  // إعادة التشغيل تُعيد البناء من الصفر — ولا تلمس شيئاً خارج هذا الإسناد
  const oldSheets = await prisma.attendanceSheet.findMany({
    where: { teachingAssignmentId: assignment.id },
    select: { id: true },
  });

  const oldEnrollments = await prisma.studentEnrollment.findMany({
    where: { teachingAssignmentId: assignment.id },
    select: { id: true, studentId: true },
  });

  if (oldEnrollments.length > 0 || oldSheets.length > 0) {
    const enrollmentIds = oldEnrollments.map((e) => e.id);

    const oldInvoices = await prisma.invoice.findMany({
      where: { studentEnrollmentId: { in: enrollmentIds } },
      select: { id: true, paymentInvoices: { select: { paymentId: true } } },
    });

    const paymentIds = [
      ...new Set(oldInvoices.flatMap((i) => i.paymentInvoices.map((p) => p.paymentId))),
    ];

    await prisma.$transaction([
      prisma.attendance.deleteMany({
        where: { studentEnrollmentId: { in: enrollmentIds } },
      }),
      prisma.receipt.deleteMany({ where: { paymentId: { in: paymentIds } } }),
      prisma.paymentInvoice.deleteMany({
        where: { invoiceId: { in: oldInvoices.map((i) => i.id) } },
      }),
      prisma.payment.deleteMany({ where: { id: { in: paymentIds } } }),
      prisma.invoice.deleteMany({ where: { id: { in: oldInvoices.map((i) => i.id) } } }),
      prisma.session.deleteMany({ where: { sheetId: { in: oldSheets.map((s) => s.id) } } }),
      prisma.attendanceSheet.deleteMany({ where: { id: { in: oldSheets.map((s) => s.id) } } }),
      prisma.studentEnrollment.deleteMany({ where: { id: { in: enrollmentIds } } }),
      prisma.student.deleteMany({ where: { id: { in: oldEnrollments.map((e) => e.studentId) } } }),
    ]);

    console.log(`أُزيل تشغيلٌ سابق: ${oldEnrollments.length} تسجيلاً و${oldSheets.length} كشفاً.`);
  }

  // ---------- التسعيرة ----------

  const scopeKey = buildScopeKey({
    academicYearId: year.id,
    subjectId: subject.id,
    studyGroupId: group.id,
    levelId: level.id,
    educationStageId: stage.id,
    groupType: "NORMAL",
  });

  await prisma.tuitionFee.upsert({
    where: { scopeKey },
    update: { amount: MONTHLY_FEE, isActive: true },
    create: {
      academicYearId: year.id,
      subjectId: subject.id,
      studyGroupId: group.id,
      levelId: level.id,
      educationStageId: stage.id,
      groupType: "NORMAL",
      scopeKey,
      amount: MONTHLY_FEE,
    },
  });

  // ---------- الفترة والجدول ----------

  const ownerKey = `yr:${year.id}|tch:${teacher.id}`;

  let slot = await prisma.lessonSlot.findFirst({
    where: { ownerKey, name: "حصة الإنجليزية" },
  });

  if (!slot) {
    const last = await prisma.lessonSlot.findFirst({
      where: { ownerKey },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    slot = await prisma.lessonSlot.create({
      data: {
        academicYearId: year.id,
        teacherId: teacher.id,
        name: "حصة الإنجليزية",
        order: (last?.order ?? 0) + 1,
        startTime: new Date("1970-01-01T14:00:00.000Z"),
        endTime: new Date("1970-01-01T16:00:00.000Z"),
        ownerKey,
      },
    });
  }

  const schedule = await prisma.schedule.upsert({
    where: {
      teachingAssignmentId_dayOfWeek_lessonSlotId: {
        teachingAssignmentId: assignment.id,
        dayOfWeek: "SATURDAY",
        lessonSlotId: slot.id,
      },
    },
    update: {},
    create: {
      teachingAssignmentId: assignment.id,
      dayOfWeek: "SATURDAY",
      lessonSlotId: slot.id,
      classroomId: classroom?.id ?? null,
    },
  });

  // ---------- الطلبة وتسجيلاتهم ----------

  const enrollmentByRank = new Map<number, string>();

  for (const row of PAPER) {
    const student = await prisma.student.create({
      data: {
        firstName: row.firstName,
        lastName: row.lastName,
        gender: row.gender,
        // الورقة لا تحمل أرقام هواتف — قيمةٌ ظاهرةُ الاصطناع لا رقمٌ يُتّصل به
        parentPhone: "0000000000",
        note: `من ورقة التخليص — الترتيب ${row.rank}`,
      },
    });

    const enrollment = await prisma.studentEnrollment.create({
      data: { studentId: student.id, teachingAssignmentId: assignment.id },
    });

    enrollmentByRank.set(row.rank, enrollment.id);
  }

  // ---------- الكشف وحصصه ----------

  const sheet = await prisma.attendanceSheet.create({
    data: {
      teachingAssignmentId: assignment.id,
      academicYearId: year.id,
      number: SHEET_NUMBER,
      sessionCount: SESSION_COUNT,
      note: "أُدخل من ورقة المؤسسة الأصلية للمقارنة",
    },
  });

  const sessions = [];

  for (let i = 0; i < SESSION_COUNT; i++) {
    sessions.push(
      await prisma.session.create({
        data: {
          scheduleId: schedule.id,
          sheetId: sheet.id,
          lessonNumber: i + 1,
          sessionDate: SESSION_DATES[i]!,
          // حضورُ الجميع مدوَّنٌ أدناه، فالحصة منجزة بقاعدة المؤسسة
          status: "COMPLETED",
        },
      }),
    );
  }

  // ---------- الحضور ----------

  const marks: Prisma.AttendanceCreateManyInput[] = [];

  for (const row of PAPER) {
    for (const session of sessions) {
      marks.push({
        sessionId: session.id,
        studentEnrollmentId: enrollmentByRank.get(row.rank)!,
        status: row.absentIn.includes(session.lessonNumber) ? "ABSENT" : "PRESENT",
      });
    }
  }

  await prisma.attendance.createMany({ data: marks });

  // ---------- الحقوق ----------
  //
  // «مخلف» في الورقة حالةٌ مالية لا حضورية (§16): أربعةٌ لم يدفعوا،
  // والتسعةُ الباقون دفعوا كاملاً بدفعةٍ ووصلٍ لكلٍّ منهم.

  let sequence = 0;

  for (const row of PAPER) {
    sequence++;

    const enrollmentId = enrollmentByRank.get(row.rank)!;

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: `INV-${INVOICE_YEAR}-${String(INVOICE_MONTH).padStart(2, "0")}-P${String(sequence).padStart(3, "0")}`,
        studentEnrollmentId: enrollmentId,
        academicYearId: year.id,
        month: INVOICE_MONTH,
        year: INVOICE_YEAR,
        amount: MONTHLY_FEE,
        total: MONTHLY_FEE,
        remaining: row.defaulter ? MONTHLY_FEE : new Prisma.Decimal(0),
        status: row.defaulter ? "PENDING" : "PAID",
        dueDate: SESSION_DATES[0]!,
        createdById: cashier.id,
      },
    });

    if (row.defaulter) continue;

    const payment = await prisma.payment.create({
      data: {
        paymentNumber: randomDocumentNumber(),
        amount: MONTHLY_FEE,
        paymentMethod: "CASH",
        paymentDate: SESSION_DATES[0]!,
        receivedById: cashier.id,
        note: "من ورقة التخليص",
      },
    });

    await prisma.paymentInvoice.create({
      data: { paymentId: payment.id, invoiceId: invoice.id, paidAmount: MONTHLY_FEE },
    });

    await prisma.receipt.create({
      data: { receiptNumber: randomDocumentNumber(), paymentId: payment.id },
    });
  }

  // ---------- ما دخل فعلاً ----------

  const attended = PAPER.reduce(
    (sum, row) => sum + (SESSION_COUNT - row.absentIn.length),
    0,
  );

  console.log("");
  console.log(`الفوج            : ${level.name} · ${group.name}`);
  console.log(`الإسناد          : ${subject.name} — ${teacher.lastName} ${teacher.firstName}`);
  console.log(`الكشف            : رقم ${sheet.number} · ${SESSION_COUNT} حصص · كلُّها منجزة`);
  console.log(`الطلبة           : ${PAPER.length}`);
  console.log(`مجموع الحضور     : ${attended} (من ${PAPER.length * SESSION_COUNT})`);
  console.log(`المخلَّفون        : ${PAPER.filter((r) => r.defaulter).length}`);
  console.log(`الحقّ الشهري      : ${MONTHLY_FEE.toFixed(2)}`);
  console.log("");
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
