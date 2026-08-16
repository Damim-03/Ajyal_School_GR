import {
  Prisma,
  StudyGroupType,
  LateEnrollmentBillingMode,
} from "../../generated/prisma";
import { prisma } from "../prisma/client";

/**
 * ترجيح نطاق التسعير.
 *
 * السعر لم يعد يُطلب بـ (مادة + فوج) بل بنطاقٍ أربعةُ حقوله اختيارية،
 * والفارغُ منها يعني «أيّاً كان». فصفٌّ بالطور وحده يسعّر المادة لكل
 * أفواجه، وصفٌّ بالفوج يسعّرها لفوجٍ بعينه.
 *
 * وعند تعدّد المطابقات يفوز **أخصُّها**. والأوزان ثنائية عمداً:
 *
 *     فوج 8 · مستوى 4 · طور 2 · نوعية 1
 *
 * فمجموعُ كل تركيبة فريدٌ لا يساوي غيره (8، 4، 2، 1، 5، 3، 9…)،
 * ولا يقع تعادلٌ يحتاج قاعدةَ كسر. ولو كانت الأوزان 4/3/2/1 لتساوى
 * «مستوى + نوعية» مع «فوج» وصار الترتيب رهنَ مصادفة.
 */

/** ما يُكتب في البصمة مكان الحقل الفارغ */
export const SCOPE_NONE = "-";

const W_GROUP = 8;
const W_LEVEL = 4;
const W_STAGE = 2;
const W_TYPE = 1;

/** حقول النطاق وحدها — الترجيح لا يحتاج المادة */
export interface ScopeFields {
  studyGroupId?: string | null;
  levelId?: string | null;
  educationStageId?: string | null;
  groupType?: StudyGroupType | null;
}

export interface TuitionScope extends ScopeFields {
  academicYearId: string;
  subjectId: string;
}

/** الوجهة التي يُبحث لها عن سعر — فوجٌ بعينه بكامل نسبه */
export interface PricingTarget {
  subjectId: string;
  studyGroupId: string;
  levelId: string;
  educationStageId: string;
  groupType: StudyGroupType;
}

/**
 * بصمة النطاق نصّاً.
 *
 * وجودُها ضرورة لا زينة: MySQL يعتبر كل NULL مميّزاً عن غيره، فقيدٌ
 * فريد على الأعمدة الاختيارية نفسها لا يمنع صفَّين متطابقَي النطاق.
 */
export const buildScopeKey = (scope: TuitionScope): string =>
  [
    `yr:${scope.academicYearId}`,
    `sub:${scope.subjectId}`,
    `grp:${scope.studyGroupId ?? SCOPE_NONE}`,
    `lvl:${scope.levelId ?? SCOPE_NONE}`,
    `stg:${scope.educationStageId ?? SCOPE_NONE}`,
    `typ:${scope.groupType ?? SCOPE_NONE}`,
  ].join("|");

export const scopeSpecificity = (scope: ScopeFields): number =>
  (scope.studyGroupId ? W_GROUP : 0) +
  (scope.levelId ? W_LEVEL : 0) +
  (scope.educationStageId ? W_STAGE : 0) +
  (scope.groupType ? W_TYPE : 0);

/** وصفٌ عربي للنطاق — يُعرض في الواجهة وفي رسائل التعارض */
export const describeScope = (scope: {
  studyGroup?: { name: string } | null;
  level?: { name: string } | null;
  educationStage?: { name: string } | null;
  groupType?: StudyGroupType | null;
}): string => {
  const parts: string[] = [];

  if (scope.studyGroup) parts.push(`فوج ${scope.studyGroup.name}`);
  if (scope.level) parts.push(scope.level.name);
  if (scope.educationStage) parts.push(scope.educationStage.name);
  if (scope.groupType) parts.push(GROUP_TYPE_LABEL[scope.groupType]);

  return parts.length > 0 ? parts.join(" · ") : "كل الأفواج";
};

const GROUP_TYPE_LABEL: Record<StudyGroupType, string> = {
  NORMAL: "عادي",
  ELITE: "نخبة",
  INTENSIVE: "مكثّف",
  EVENING: "مسائي",
};

/**
 * نسب الفوج كاملةً — الفوج يعرف مستواه، والمستوى يعرف طوره.
 * تُحمَّل مرة واحدة ثم تُمرَّر، تفادياً لاستعلامٍ لكل فاتورة.
 */
export const loadPricingTarget = async (
  subjectId: string,
  studyGroupId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<PricingTarget | null> => {
  const group = await client.studyGroup.findUnique({
    where: { id: studyGroupId },
    select: {
      id: true,
      type: true,
      levelId: true,
      level: { select: { educationStageId: true } },
    },
  });

  if (!group) return null;

  return {
    subjectId,
    studyGroupId: group.id,
    levelId: group.levelId,
    educationStageId: group.level.educationStageId,
    groupType: group.type,
  };
};

const feeScopeSelect = {
  id: true,
  amount: true,
  lateEnrollmentMode: true,
  studyGroupId: true,
  levelId: true,
  educationStageId: true,
  groupType: true,
} as const;

export type ResolvedTuitionFee = {
  id: string;
  amount: Prisma.Decimal;
  /// معاملةُ الملتحق متأخّراً — قاعدةُ سعرِ طالبٍ محلُّها هنا لا في سياسة الأستاذ
  lateEnrollmentMode: LateEnrollmentBillingMode;
  specificity: number;
};

/** ما يطابق نطاقُه هذه الوجهة — بغضّ النظر عن التفعيل */
const scopeWhere = (target: PricingTarget) => ({
  // كل حقل نطاق: إمّا فارغ (أيّاً كان) أو مساوٍ لنسب الوجهة
  AND: [
    { OR: [{ studyGroupId: null }, { studyGroupId: target.studyGroupId }] },
    { OR: [{ levelId: null }, { levelId: target.levelId }] },
    {
      OR: [
        { educationStageId: null },
        { educationStageId: target.educationStageId },
      ],
    },
    { OR: [{ groupType: null }, { groupType: target.groupType }] },
  ],
});

/**
 * سعر هذه الوجهة في سنةٍ دراسية.
 *
 * يُرجع أخصَّ صفٍّ مطابق، أو null إن لم يوجد سعر — والفرقُ بينهما
 * مقصود: غيابُ السعر خطأُ إعدادٍ يجب أن يظهر للإدارة لا أن يُفترض صفراً.
 */
export const resolveTuitionFee = async (
  target: PricingTarget,
  academicYearId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ResolvedTuitionFee | null> => {
  const candidates = await client.tuitionFee.findMany({
    where: {
      academicYearId,
      subjectId: target.subjectId,
      isActive: true,
      ...scopeWhere(target),
    },
    select: feeScopeSelect,
  });

  if (candidates.length === 0) return null;

  // الأخصّ يفوز — ولا تعادل ممكن: الأوزان ثنائية، وتساوي التخصيص
  // يعني تطابق النطاق وذلك يمنعه القيد الفريد على البصمة.
  const best = candidates
    .map((fee) => ({ ...fee, specificity: scopeSpecificity(fee) }))
    .sort((a, b) => b.specificity - a.specificity)[0]!;

  return {
    id: best.id,
    amount: best.amount,
    lateEnrollmentMode: best.lateEnrollmentMode,
    specificity: best.specificity,
  };
};

/**
 * لماذا لم يُوجد سعر.
 *
 * «لا سعر» جوابٌ صحيح لا يُفيد: المستخدم يرى السعر أمامه في القائمة
 * ويقرأ أنه غير موجود، فيظنّ الخلل في النظام. والأسبابُ الممكنة الآن
 * ثلاثة لا أكثر — سنةٌ أخرى، أو نطاقٌ لا يشمل الفوج، أو صفٌّ معطَّل —
 * وكلُّها تُسمّى صراحةً.
 */
export const explainMissingFee = async (
  target: PricingTarget,
  academicYearId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> => {
  const all = await client.tuitionFee.findMany({
    where: { subjectId: target.subjectId },
    select: {
      ...feeScopeSelect,
      isActive: true,
      academicYearId: true,
      academicYear: { select: { name: true } },
      studyGroup: { select: { name: true } },
      level: { select: { name: true } },
      educationStage: { select: { name: true } },
    },
  });

  if (all.length === 0) {
    return "لا يوجد أيّ حقّ اشتراك لهذه المادة — أضِفه من المالية ← حقوق الاشتراك.";
  }

  const matchesScope = (fee: (typeof all)[number]) =>
    (!fee.studyGroupId || fee.studyGroupId === target.studyGroupId) &&
    (!fee.levelId || fee.levelId === target.levelId) &&
    (!fee.educationStageId ||
      fee.educationStageId === target.educationStageId) &&
    (!fee.groupType || fee.groupType === target.groupType);

  const thisYear = all.filter((fee) => fee.academicYearId === academicYearId);

  // سعرٌ لهذا الفوج لكن في سنةٍ أخرى — الحالة الأولى بعد إنشاء سنة جديدة
  if (thisYear.length === 0) {
    const years = [
      ...new Set(
        all.filter(matchesScope).map((fee) => fee.academicYear.name),
      ),
    ];

    return years.length > 0
      ? `التسعيرة معرَّفة لسنة ${years.join("، ")} لا للسنة المطلوبة — ` +
          `أضِف تسعيرة لهذه السنة الدراسية.`
      : "لا تسعيرة لهذه المادة في السنة الدراسية المطلوبة.";
  }

  const scopeMatches = thisYear.filter(matchesScope);

  if (scopeMatches.length === 0) {
    const scopes = [
      ...new Set(thisYear.map((fee) => describeScope(fee))),
    ];

    return (
      `توجد ${thisYear.length} تسعيرة لهذه المادة هذه السنة لكن لا شيء منها يشمل هذا الفوج — ` +
      `نطاقاتها: ${scopes.join("، ")}.`
    );
  }

  if (scopeMatches.every((fee) => !fee.isActive)) {
    return "التسعيرة المطابقة معطَّلة — فعّلها من المالية ← حقوق الاشتراك.";
  }

  return "لا تسعيرة مطابقة لهذه المادة وهذا الفوج في السنة المطلوبة.";
};

/** طريقٌ مختصر حين لا تكون النسب محمَّلة سلفاً */
export const resolveTuitionFeeForGroup = async (
  subjectId: string,
  studyGroupId: string,
  academicYearId: string,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ResolvedTuitionFee | null> => {
  const target = await loadPricingTarget(subjectId, studyGroupId, client);

  return target ? resolveTuitionFee(target, academicYearId, client) : null;
};
