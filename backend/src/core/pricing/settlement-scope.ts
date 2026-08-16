import { Prisma } from "../../generated/prisma";
import { prisma } from "../prisma/client";

/**
 * ترجيح نطاق سياسة التخليص — نفس فكرة TuitionFee بأوزان أخرى.
 *
 *     أستاذ 4 · فوج 2 · مادة 1
 *
 * فسياسةٌ عامّة للسنة يغلبها ما خُصّص لمادة، ويغلبهما ما خُصّص لأستاذ
 * بعينه — وهي الحالة العملية: أستاذٌ اتُّفق معه على نسبة تخالف
 * نسبة المؤسسة.
 *
 * والسنة الدراسية ليست جزءاً من الترجيح لأنها إلزامية في كل سياسة:
 * لا تُقارَن سياسةُ سنةٍ بسياسة أخرى.
 */

export const SCOPE_NONE = "-";

const W_TEACHER = 4;
const W_GROUP = 2;
const W_SUBJECT = 1;

export interface PolicyScope {
  academicYearId: string;
  subjectId?: string | null;
  studyGroupId?: string | null;
  teacherId?: string | null;
}

export const buildPolicyScopeKey = (scope: PolicyScope): string =>
  [
    `yr:${scope.academicYearId}`,
    `sub:${scope.subjectId ?? SCOPE_NONE}`,
    `grp:${scope.studyGroupId ?? SCOPE_NONE}`,
    `tch:${scope.teacherId ?? SCOPE_NONE}`,
  ].join("|");

export const policySpecificity = (scope: {
  subjectId?: string | null;
  studyGroupId?: string | null;
  teacherId?: string | null;
}): number =>
  (scope.teacherId ? W_TEACHER : 0) +
  (scope.studyGroupId ? W_GROUP : 0) +
  (scope.subjectId ? W_SUBJECT : 0);

export const describePolicyScope = (scope: {
  subject?: { name: string } | null;
  studyGroup?: { name: string } | null;
  teacher?: { firstName: string; lastName: string } | null;
}): string => {
  const parts: string[] = [];

  if (scope.teacher)
    parts.push(`الأستاذ ${scope.teacher.firstName} ${scope.teacher.lastName}`);
  if (scope.studyGroup) parts.push(`فوج ${scope.studyGroup.name}`);
  if (scope.subject) parts.push(scope.subject.name);

  return parts.length > 0 ? parts.join(" · ") : "كل الإسنادات";
};

export interface PolicyTarget {
  academicYearId: string;
  subjectId: string;
  studyGroupId: string;
  teacherId: string;
}

/**
 * السياسة السارية لهذا الإسناد في تاريخ معيّن.
 *
 * تُرجع null عند غياب سياسة — والغيابُ خطأُ إعدادٍ يجب أن يظهر
 * للإدارة، لا أن يُفترض معه صفرٌ أو نسبةٌ افتراضية.
 */
export const resolveSettlementPolicy = async (
  target: PolicyTarget,
  onDate: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
) => {
  const candidates = await client.settlementPolicy.findMany({
    where: {
      academicYearId: target.academicYearId,
      isActive: true,
      effectiveFrom: { lte: onDate },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: onDate } }],
      AND: [
        { OR: [{ subjectId: null }, { subjectId: target.subjectId }] },
        { OR: [{ studyGroupId: null }, { studyGroupId: target.studyGroupId }] },
        { OR: [{ teacherId: null }, { teacherId: target.teacherId }] },
      ],
    },
  });

  if (candidates.length === 0) return null;

  return candidates
    .map((policy) => ({
      ...policy,
      specificity: policySpecificity(policy),
    }))
    .sort(
      (a, b) =>
        b.specificity - a.specificity ||
        b.effectiveFrom.getTime() - a.effectiveFrom.getTime(),
    )[0]!;
};

const day = (date: Date) => date.toISOString().slice(0, 10);

/**
 * لماذا لم تنطبق أيُّ سياسة — سياسةً سياسةً بسببها.
 *
 * «لا سياسة سارية» جوابٌ صحيح لا ينفع: السياسة قد تكون موجودةً أمام
 * عينِ المستخدم في القائمة، وسببُ استبعادها حرفٌ في نطاقها لا يُرى.
 * وقد وقع فعلاً — سياسةٌ نُسبت إلى «فوج الاول» والكشف في «الفوج 1»،
 * واسمان متشابهان في مستوًى واحد لا يُفرَّق بينهما في قائمة الاختيار.
 *
 * فالرسالة تُعدّد الموجود وتقول عن كلٍّ لِمَ خرج، بالعربية لأنّ من
 * يقرؤها موظّفُ استقبالٍ لا مبرمج.
 */
export const explainMissingPolicy = async (
  target: PolicyTarget,
  onDate: Date,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> => {
  const all = await client.settlementPolicy.findMany({
    where: { academicYearId: target.academicYearId },
    select: {
      name: true,
      isActive: true,
      effectiveFrom: true,
      effectiveTo: true,
      subjectId: true,
      studyGroupId: true,
      teacherId: true,
      subject: { select: { name: true } },
      studyGroup: { select: { name: true, level: { select: { name: true } } } },
      teacher: { select: { firstName: true, lastName: true } },
    },
    orderBy: { effectiveFrom: "desc" },
  });

  if (all.length === 0) {
    return (
      "لا سياسةَ تخليصٍ واحدة في هذه السنة الدراسية — " +
      "أضِفها من المالية ← سياسات التخليص."
    );
  }

  const lines = all.map((policy) => {
    const why: string[] = [];

    if (!policy.isActive) why.push("معطَّلة");

    if (policy.effectiveFrom > onDate)
      why.push(`تسري من ${day(policy.effectiveFrom)} وهو بعد تاريخ الحصة`);

    if (policy.effectiveTo && policy.effectiveTo <= onDate)
      why.push(`انتهى سريانها في ${day(policy.effectiveTo)}`);

    if (policy.subjectId && policy.subjectId !== target.subjectId)
      why.push(`نطاقُها مادة ${policy.subject!.name}`);

    if (policy.studyGroupId && policy.studyGroupId !== target.studyGroupId)
      why.push(
        `نطاقُها فوج ${policy.studyGroup!.level.name} · ${policy.studyGroup!.name}`,
      );

    if (policy.teacherId && policy.teacherId !== target.teacherId)
      why.push(
        `نطاقُها الأستاذ ${policy.teacher!.lastName} ${policy.teacher!.firstName}`,
      );

    return `• «${policy.name}» — ${why.length > 0 ? why.join("، ") : "نطاقُها لا يشمل هذا الإسناد"}`;
  });

  return (
    `توجد ${all.length} سياسة في هذه السنة ولا واحدةَ منها تنطبق على هذا الكشف:\n` +
    lines.join("\n") +
    `\nصحّح نطاقَ إحداها أو أضِف سياسةً تشمله.`
  );
};
