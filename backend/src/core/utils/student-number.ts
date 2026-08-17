import { Prisma } from "../../../generated/prisma";

/**
 * رقم الطالب في المؤسسة — «2026000147».
 *
 * أربعُ خاناتٍ لسنة بدء السنة الدراسية الجارية، ثمّ متسلسلٌ من ستّ
 * خانات داخل تلك السابقة. وهو غير رقم المستند في `document-number`:
 * ذاك عشوائيٌّ عمداً لأنّ تسلسل الإيصالات يفشي حجم الحركة، وهذا
 * متسلسلٌ عمداً لأنّ رقم الطالب يُملى في الهاتف ويُقرأ من بطاقةٍ
 * مطبوعة، وترتيبُه يقول متى التحق.
 *
 * والسابقة تُثبَّت يوم التسجيل ولا تتغيّر بعده — البطاقة في جيبه.
 */

const SEQ_DIGITS = 6;

/**
 * سابقةُ السنة الجارية.
 *
 * من `AcademicYear.isCurrent` لا من تقويم الحاسوب: السنة الدراسية
 * تبدأ في أوت وتنتهي في أوت، فمن سُجّل في جانفي 2027 ينتمي إلى سنة
 * ‏2026‑2027 ورقمُه يبدأ بـ2026. والتقويم كان سيعطيه 2027 فيبدو
 * أحدثَ من زملائه في الفوج نفسه.
 *
 * وحين لا سنةَ جارية — مؤسسةٌ لم تُنشئ سنتها بعد — يُرتدّ إلى
 * التقويم بدل الرفض: تسجيلُ طالبٍ لا ينبغي أن يتوقّف على إعدادٍ في
 * شاشةٍ أخرى.
 */
export const currentYearPrefix = async (
  tx: Prisma.TransactionClient,
): Promise<string> => {
  const year = await tx.academicYear.findFirst({
    where: { isCurrent: true },
    select: { startDate: true },
  });

  return String((year?.startDate ?? new Date()).getFullYear());
};

/**
 * الرقم التالي داخل السابقة.
 *
 * يُقرأ أكبرُ رقمٍ موجودٍ بهذه السابقة ويُزاد واحداً — لا `count()`:
 * العدّ يُعيد رقماً مستعملاً بمجرّد حذف طالبٍ واحد، فيصطدم بالقيد.
 *
 * **يُستدعى داخل المعاملة التي ستحفظ الصفّ**، ومع ذلك يبقى السباق
 * ممكناً بين معاملتين متزامنتين — لذلك يحرسه `@@unique` في القاعدة
 * وتُعاد المحاولة في `student.service`. القراءةُ وحدها لا تكفي.
 */
export const nextStudentNumber = async (
  tx: Prisma.TransactionClient,
  prefix: string,
): Promise<string> => {
  const last = await tx.student.findFirst({
    where: { studentNumber: { startsWith: prefix } },
    orderBy: { studentNumber: "desc" },
    select: { studentNumber: true },
  });

  const previous = last ? Number(last.studentNumber.slice(prefix.length)) : 0;
  const next = (Number.isFinite(previous) ? previous : 0) + 1;

  return prefix + String(next).padStart(SEQ_DIGITS, "0");
};
