import { Prisma, StudyGroupType } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  buildScopeKey,
  describeScope,
  scopeSpecificity,
} from "../../core/pricing/tuition-scope";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import {
  CreateTuitionFeeInput,
  UpdateTuitionFeeInput,
  TuitionFeeQueryInput,
} from "./tuition-fee.schema";

const tuitionFeeSelect = {
  id: true,
  academicYearId: true,
  subjectId: true,
  studyGroupId: true,
  levelId: true,
  educationStageId: true,
  groupType: true,
  scopeKey: true,
  amount: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
  academicYear: { select: { id: true, name: true } },
  subject: { select: { id: true, name: true, code: true } },
  studyGroup: {
    select: {
      id: true,
      name: true,
      type: true,
      level: { select: { id: true, name: true } },
    },
  },
  level: { select: { id: true, name: true } },
  educationStage: { select: { id: true, name: true } },
} as const;

type RawTuitionFee = {
  amount: Prisma.Decimal;
  studyGroupId: string | null;
  levelId: string | null;
  educationStageId: string | null;
  groupType: StudyGroupType | null;
  studyGroup?: { name: string } | null;
  level?: { name: string } | null;
  educationStage?: { name: string } | null;
  [key: string]: unknown;
};

/**
 * Decimal → number، مع وصفٍ جاهز للنطاق.
 *
 * المبالغ هنا صغيرة (حقوق شهرية) فالتحويل آمن، ويُجنّب الواجهة
 * التعامل مع كائن Decimal. و`scope` و`specificity` محسوبان هنا لا
 * في الواجهة، فترتيبُ الأخصّ واحدٌ في الطرفين.
 */
const toResponse = <T extends RawTuitionFee>(fee: T) => ({
  ...fee,
  amount: Number(fee.amount),
  scope: describeScope(fee),
  specificity: scopeSpecificity(fee),
});

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const fee = await prisma.tuitionFee.findUnique({
    where: { id },
    select: tuitionFeeSelect,
  });

  if (!fee) {
    throw new NotFoundException(
      "Tuition fee not found",
      ErrorCodeEnum.TUITION_FEE_NOT_FOUND,
    );
  }

  return fee;
};

const ensureSubjectExists = async (subjectId: string) => {
  const subject = await prisma.subject.findUnique({
    where: { id: subjectId },
    select: { id: true },
  });

  if (!subject) {
    throw new NotFoundException(
      "Subject not found",
      ErrorCodeEnum.SUBJECT_NOT_FOUND,
    );
  }
};

/** نطاق التسعير كما يصل من الطلب */
interface ScopeInput {
  studyGroupId?: string | null;
  levelId?: string | null;
  educationStageId?: string | null;
  groupType?: StudyGroupType | null;
}

/**
 * وجودُ كل مرجعٍ في النطاق.
 *
 * ولا يُتحقَّق من الاتّساق بينها — أي أنّ الفوج ينتمي فعلاً إلى
 * المستوى المذكور — عمداً: النطاق شروطٌ تُجتمع لا شجرةٌ تُتبع، وصفٌّ
 * بفوجٍ ومستوًى لا ينتمي إليه ببساطة لا يطابق شيئاً. منعُه يحتاج
 * استعلاماتٍ إضافية لحماية المستخدم من إدخالٍ لا يضرّ.
 */
const ensureScopeExists = async (scope: ScopeInput) => {
  if (scope.studyGroupId) {
    const studyGroup = await prisma.studyGroup.findUnique({
      where: { id: scope.studyGroupId },
      select: { id: true },
    });

    if (!studyGroup) {
      throw new NotFoundException(
        "Study group not found",
        ErrorCodeEnum.STUDY_GROUP_NOT_FOUND,
      );
    }
  }

  if (scope.levelId) {
    const level = await prisma.level.findUnique({
      where: { id: scope.levelId },
      select: { id: true },
    });

    if (!level) {
      throw new NotFoundException(
        "Level not found",
        ErrorCodeEnum.LEVEL_NOT_FOUND,
      );
    }
  }

  if (scope.educationStageId) {
    const stage = await prisma.educationStage.findUnique({
      where: { id: scope.educationStageId },
      select: { id: true },
    });

    if (!stage) {
      throw new NotFoundException(
        "Education stage not found",
        ErrorCodeEnum.EDUCATION_STAGE_NOT_FOUND,
      );
    }
  }
};

const ensureAcademicYearExists = async (academicYearId: string) => {
  const year = await prisma.academicYear.findUnique({
    where: { id: academicYearId },
    select: { id: true },
  });

  if (!year) {
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND,
    );
  }
};

/**
 * سعرٌ واحد لكل نطاق في كل سنة.
 *
 * كان هنا فحصُ تداخل فتراتٍ زمنية؛ وقد سقط مع التواريخ. والمقارنة
 * بالبصمة لا بالمادة والفوج: نطاقان مختلفان يتعايشان في السنة نفسها،
 * وذلك هو الغرض من التدرّج — سعرٌ للطور وسعرٌ أخصّ لفوجٍ فيه، والأخصّ
 * يفوز عند الحساب.
 */
const ensureScopeIsFree = async (
  scopeKey: string,
  scopeLabel: string,
  excludeId?: string,
) => {
  const existing = await prisma.tuitionFee.findFirst({
    where: {
      scopeKey,
      ...(excludeId && { NOT: { id: excludeId } }),
    },
    select: { amount: true },
  });

  if (existing) {
    throw new ConflictException(
      `يوجد حقّ اشتراك بنفس النطاق (${scopeLabel}) لهذه المادة والسنة ` +
        `بمبلغ ${Number(existing.amount)} — عدّله بدل إضافة صفٍّ ثانٍ.`,
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listTuitionFeesService = async (query: TuitionFeeQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const where: Prisma.TuitionFeeWhereInput = {
    ...(query.isActive !== undefined && { isActive: query.isActive }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
    ...(query.levelId && { levelId: query.levelId }),
    ...(query.educationStageId && {
      educationStageId: query.educationStageId,
    }),
    ...(query.groupType && { groupType: query.groupType }),
  };

  const [fees, total] = await Promise.all([
    prisma.tuitionFee.findMany({
      where,
      select: tuitionFeeSelect,
      skip,
      take,
      orderBy: [
        { subject: { name: "asc" } },
        { studyGroup: { name: "asc" } },
      ],
    }),
    prisma.tuitionFee.count({ where }),
  ]);

  return {
    tuitionFees: fees.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id
// --------------------------------------------------

export const getTuitionFeeService = async (id: string) => {
  const fee = await findOrThrow(id);

  return toResponse(fee);
};

// --------------------------------------------------
// Create
// --------------------------------------------------

export const createTuitionFeeService = async (body: CreateTuitionFeeInput) => {
  await ensureAcademicYearExists(body.academicYearId);
  await ensureSubjectExists(body.subjectId);
  await ensureScopeExists(body);

  const scope = {
    academicYearId: body.academicYearId,
    subjectId: body.subjectId,
    studyGroupId: body.studyGroupId ?? null,
    levelId: body.levelId ?? null,
    educationStageId: body.educationStageId ?? null,
    groupType: body.groupType ?? null,
  };

  const scopeKey = buildScopeKey(scope);

  await ensureScopeIsFree(scopeKey, describeScope(scope));

  const fee = await prisma.tuitionFee.create({
    data: {
      ...scope,
      scopeKey,
      amount: new Prisma.Decimal(body.amount),
      isActive: body.isActive ?? true,
    },
    select: tuitionFeeSelect,
  });

  return toResponse(fee);
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateTuitionFeeService = async (
  id: string,
  body: UpdateTuitionFeeInput,
) => {
  const existing = await findOrThrow(id);

  if (body.academicYearId) {
    await ensureAcademicYearExists(body.academicYearId);
  }

  if (body.subjectId) {
    await ensureSubjectExists(body.subjectId);
  }

  await ensureScopeExists(body);

  // النطاق بعد التعديل — الحقل غير المرسل يبقى على حاله،
  // والمرسل صراحةً بـ null يُفرَّغ
  const pick = <K extends keyof typeof existing>(
    sent: string | StudyGroupType | null | undefined,
    key: K,
  ) => (sent !== undefined ? (sent ?? null) : (existing[key] ?? null));

  const scope = {
    academicYearId: body.academicYearId ?? existing.academicYearId,
    subjectId: body.subjectId ?? existing.subjectId,
    studyGroupId: pick(body.studyGroupId, "studyGroupId") as string | null,
    levelId: pick(body.levelId, "levelId") as string | null,
    educationStageId: pick(body.educationStageId, "educationStageId") as
      | string
      | null,
    groupType: pick(body.groupType, "groupType") as StudyGroupType | null,
  };

  const scopeKey = buildScopeKey(scope);

  if (scopeKey !== existing.scopeKey) {
    await ensureScopeIsFree(scopeKey, describeScope(scope), id);
  }

  const fee = await prisma.tuitionFee.update({
    where: { id },
    data: {
      ...scope,
      scopeKey,
      ...(body.amount !== undefined && {
        amount: new Prisma.Decimal(body.amount),
      }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
    select: tuitionFeeSelect,
  });

  return toResponse(fee);
};

// --------------------------------------------------
// Delete
//
// لا يوجد FK من Invoice نحو TuitionFee — الفاتورة تُخزّن
// المبلغ لحظة الإصدار، فالحذف لا يكسر سجلات سابقة.
// --------------------------------------------------

export const deleteTuitionFeeService = async (id: string) => {
  await findOrThrow(id);

  await prisma.tuitionFee.delete({ where: { id } });
};
