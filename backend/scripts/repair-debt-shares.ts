/**
 * ترميمُ حصص الأستاذ من ديونٍ حُصّلت بعد تخليصه.
 *
 * سببُ الحاجة إليه: كانت نسبةُ الفاتورة إلى كشفها تُترك فارغةً كلّما
 * تقاسم الشهرَ كشفان (انظر `monthSheet` في `invoice.service`). وبلا
 * تلك النسبة لا يجد `recordDebtCollections` كشفاً ولا تخليصاً، فيمرّ
 * الدفع بلا حصة: المخلَّف يسدّد، والمالُ يدخل، وحقُّ الأستاذ يسقط بصمت
 * ولا يظهر في كشفه الجديد.
 *
 * فيصلح هذا السكربت ما مضى على مرحلتين:
 *
 *   1. **النسبة** — كلُّ فاتورةٍ بلا كشف تُنسب بالمقياس الجديد نفسه
 *      (شهرُ أوّل حصة)، لا بمقياسٍ خاصّ به وحده.
 *
 *   2. **الإعادة** — كلُّ دفعةٍ وقعت **بعد** تأكيد تخليص كشفها تُعاد
 *      على `recordDebtCollections` نفسها، فتنشأ الحصة بحسابها الأصلي
 *      لا بحسابٍ مكتوبٍ هنا. والشرطُ الزمني هو عينُ ما يفعله المسار
 *      الحيّ: هو لا ينشئ حصةً إلّا إذا كان التخليص قائماً لحظة الدفع.
 *
 * وما دُفع **قبل** التأكيد لا يُمَسّ: التخليص أحصاه في مبلغه، وإنشاء
 * حصةٍ له دفعٌ مرّتين.
 *
 * والتكرارُ مأمون: `@@unique([invoiceId, paymentId])` على واقعة
 * التحصيل يمنع الازدواج، والسكربت يتخطّى ما وُجد أصلاً.
 *
 * التشغيل:
 *   npx ts-node scripts/repair-debt-shares.ts            ← عرضٌ فقط (يُلغى كلُّ شيء)
 *   npx ts-node scripts/repair-debt-shares.ts --apply    ← تثبيت
 */

import { prisma } from "../src/core/prisma/client";
import { monthSheet } from "../src/modules/invoice/invoice.service";
import { recordDebtCollections } from "../src/modules/teacher-debt-share/teacher-debt-share.service";

const apply = process.argv.includes("--apply");

/** يُرمى في نهاية التجربة ليُلغي كلَّ ما كُتب داخلها */
class Rollback extends Error {}

const money = (value: unknown) => Number(value).toFixed(2);

const run = async () => {
  const startedAt = new Date();

  try {
    await prisma.$transaction(
      async (tx) => {
        // ---------------------------------------------
        // 1. الفواتير بلا كشف
        // ---------------------------------------------

        const orphans = await tx.invoice.findMany({
          where: { attendanceSheetId: null, status: { not: "CANCELLED" } },
          select: {
            id: true,
            invoiceNumber: true,
            month: true,
            year: true,
            studentEnrollment: { select: { teachingAssignmentId: true } },
          },
        });

        let linked = 0;
        const stillLoose: string[] = [];

        for (const invoice of orphans) {
          const sheetId = await monthSheet(
            invoice.studentEnrollment.teachingAssignmentId,
            invoice.year,
            invoice.month,
          );

          if (!sheetId) {
            stillLoose.push(`${invoice.invoiceNumber} (${invoice.month}/${invoice.year})`);
            continue;
          }

          await tx.invoice.update({
            where: { id: invoice.id },
            data: { attendanceSheetId: sheetId },
          });

          linked += 1;
        }

        console.log(`\nالفواتير بلا كشف: ${orphans.length}`);
        console.log(`  نُسبت الآن: ${linked}`);
        console.log(`  بقيت بلا كشف: ${stillLoose.length}`);

        if (stillLoose.length > 0) {
          console.log(`    ${stillLoose.slice(0, 10).join("، ")}`);
        }

        // ---------------------------------------------
        // 2. الدفعات التي فاتتها حصتُها
        // ---------------------------------------------

        const paid = await tx.paymentInvoice.findMany({
          select: {
            paymentId: true,
            invoiceId: true,
            paidAmount: true,
            createdAt: true,
            payment: { select: { paymentNumber: true, paymentDate: true } },
            invoice: {
              select: {
                invoiceNumber: true,
                attendanceSheetId: true,
                studentEnrollment: { select: { teachingAssignmentId: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        let replayed = 0;
        let early = 0;
        let already = 0;
        let unsettled = 0;

        for (const line of paid) {
          const sheetId = line.invoice.attendanceSheetId;

          if (!sheetId) continue;

          const settlement = await tx.settlement.findFirst({
            where: {
              attendanceSheetId: sheetId,
              teachingAssignmentId:
                line.invoice.studentEnrollment.teachingAssignmentId,
              status: { in: ["CONFIRMED", "PAID"] },
            },
            orderBy: { revision: "desc" },
            select: { settlementNumber: true, confirmedAt: true },
          });

          /* لا تخليص بعد — فالدفعة ليست متأخّرة، يحصيها الكشف حين يُحسب */
          if (!settlement?.confirmedAt) {
            unsettled += 1;
            continue;
          }

          /* دُفع قبل التأكيد — أحصاه التخليصُ في مبلغه، فلا حصة عليه */
          if (line.createdAt <= settlement.confirmedAt) {
            early += 1;
            continue;
          }

          const existing = await tx.debtCollection.findUnique({
            where: {
              invoiceId_paymentId: {
                invoiceId: line.invoiceId,
                paymentId: line.paymentId,
              },
            },
            select: { id: true },
          });

          if (existing) {
            already += 1;
            continue;
          }

          await recordDebtCollections(
            tx,
            line.paymentId,
            [{ invoiceId: line.invoiceId, paidAmount: line.paidAmount }],
            line.payment.paymentDate,
          );

          replayed += 1;
        }

        console.log(`\nسطورُ الدفع المفحوصة: ${paid.length}`);
        console.log(`  أُعيدت الآن: ${replayed}`);
        console.log(`  دُفعت قبل التأكيد (لا حصة عليها): ${early}`);
        console.log(`  لها واقعةُ تحصيلٍ أصلاً: ${already}`);
        console.log(`  كشفُها غيرُ مخلَّص بعد: ${unsettled}`);

        // ---------------------------------------------
        // 3. ما نشأ
        // ---------------------------------------------

        const created = await tx.teacherDebtShare.findMany({
          where: { createdAt: { gte: startedAt } },
          select: {
            shareAmount: true,
            attendedUnits: true,
            teacher: { select: { firstName: true, lastName: true } },
            debtCollection: {
              select: {
                invoice: {
                  select: {
                    studentEnrollment: {
                      select: {
                        student: { select: { firstName: true, lastName: true } },
                      },
                    },
                  },
                },
              },
            },
            originalSettlement: {
              select: {
                settlementNumber: true,
                attendanceSheet: { select: { number: true } },
                teachingAssignment: {
                  select: { studyGroup: { select: { name: true } } },
                },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        });

        const total = created.reduce(
          (sum, share) => sum + Number(share.shareAmount),
          0,
        );

        console.log(`\nالحصص المنشأة: ${created.length} — المجموع ${money(total)} دج`);

        for (const share of created) {
          const student =
            share.debtCollection.invoice.studentEnrollment.student;
          const origin = share.originalSettlement;

          console.log(
            `  ${student.lastName} ${student.firstName}` +
              ` · ${origin?.teachingAssignment.studyGroup.name ?? "—"}` +
              ` · كشف ${origin?.attendanceSheet.number ?? "—"}` +
              ` (${origin?.settlementNumber ?? "—"})` +
              ` · حضر ${share.attendedUnits ?? "—"}` +
              ` · ${money(share.shareAmount)} دج`,
          );
        }

        if (!apply) throw new Rollback();
      },
      { timeout: 180_000, maxWait: 20_000 },
    );

    console.log("\n✔ ثُبّتت التغييرات.");
  } catch (error) {
    if (error instanceof Rollback) {
      console.log("\n— عرضٌ فقط، أُلغي كلُّ ما سبق. أضف --apply للتثبيت.");
      return;
    }

    throw error;
  }
};

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
