/**
 * تشغيل الكشف التقديري على ورقة المؤسسة.
 *
 * يستدعي `settlementEstimateService` نفسها التي تستدعيها الشاشة عبر
 * `GET /settlements/estimate` — لا نسخةً منها ولا حساباً موازياً. فما
 * يُطبع هنا هو حرفياً ما ستراه في الواجهة.
 *
 * التشغيل من مجلد backend:
 *   & "C:\Program Files\nodejs\node.exe" node_modules\ts-node\dist\bin.js scripts/run-estimate.ts
 */

import { prisma } from "../src/core/prisma/client";
import { settlementEstimateService } from "../src/modules/settlement/settlement.report.service";

const main = async () => {
  const year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (!year) throw new Error("لا سنة دراسية جارية");

  // ---------- السياسة ----------
  //
  // تُقرأ ولا تُنشأ. كان السكربت يُنشئها بـ`upsert`، فأنتج نسخةً ثانيةً
  // بجانب التي أنشأها المستخدم من الشاشة — بصمةُ النطاق تختلف فلا
  // يراهما `upsert` واحدة. وسياساتُ المؤسسة تُدار من الواجهة لا من
  // سكربتٍ يُشغَّل للفحص.

  const policies = await prisma.settlementPolicy.findMany({
    where: { academicYearId: year.id },
    select: { name: true, method: true, teacherPercentage: true, countBasis: true },
  });

  for (const policy of policies) {
    console.log(
      `السياسة: ${policy.name} · ${policy.method} · ${policy.teacherPercentage}% · ${policy.countBasis}`,
    );
  }

  console.log("");

  // ---------- الكشف ----------

  const sheet = await prisma.attendanceSheet.findFirst({
    where: { note: { contains: "ورقة المؤسسة" } },
    orderBy: { createdAt: "desc" },
  });

  if (!sheet) throw new Error("لم أجد كشف الورقة — شغّل seed-paper-sheet أولاً");

  const estimate = await settlementEstimateService({
    teachingAssignmentId: sheet.teachingAssignmentId,
    attendanceSheetId: sheet.id,
  });

  const h = estimate.header;
  const t = estimate.totals;
  const money = (value: number) => value.toFixed(2).padStart(12);
  const day = (iso: Date | null) =>
    iso ? new Date(iso).toISOString().slice(0, 10) : "—";

  console.log(`${h.subject.name} · ${h.level.name} · ${h.studyGroup.name}`);
  console.log(`الأستاذ: ${h.teacher.lastName} ${h.teacher.firstName} · الكشف ${h.sheet.number}`);
  console.log(`المدى: ${day(h.dateFrom)} → ${day(h.dateTo)} · الحقّ الشهري ${estimate.tuition}`);
  console.log("");

  console.log("الحصة  التاريخ       المحتسبون   قيمة الوحدة        المجموع");
  console.log("-".repeat(64));

  for (const row of estimate.rows) {
    console.log(
      String(row.lessonNumber).padStart(4) +
        "   " + day(row.sessionDate) +
        String(row.countedStudents).padStart(10) +
        String(row.rate).padStart(14) +
        money(row.lineTotal),
    );
  }

  console.log("-".repeat(64));
  console.log("");
  console.log(`الحصص المنجزة    : ${t.completedSessions} / ${t.approvedSessions}`);
  console.log(`الطلبة المسجَّلون : ${t.enrolledStudents}`);
  console.log(`مجموع الحضور     : ${t.attendedUnits}`);
  console.log(`المخلَّفون        : ${t.defaulters}`);
  console.log(`إجمالي الحقوق    : ${t.grossTuition.toFixed(2)}`);
  console.log(`المحصَّل          : ${t.collected.toFixed(2)}`);
  console.log(`الديون المتبقّية  : ${t.remaining.toFixed(2)}`);
  console.log("");
  console.log(`مستحقّ الأستاذ    : ${t.teacherAmount.toFixed(2)}`);
  console.log("");

  console.log("الطالب                       حضر  غاب        الدَّين  الحالة");
  console.log("-".repeat(64));

  for (const s of estimate.students) {
    const name = `${s.lastName} ${s.firstName}`;
    const state = s.uninvoiced ? "بلا فاتورة" : s.defaulter ? "مخلَّف" : "خالص";

    console.log(
      name.padEnd(28) +
        String(s.present).padStart(3) +
        String(s.absent).padStart(5) +
        money(s.invoice?.remaining ?? 0) +
        "  " + state,
    );
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
