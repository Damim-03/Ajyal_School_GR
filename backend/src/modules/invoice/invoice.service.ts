import { Prisma, InvoiceStatus } from "../../../generated/prisma";
import { prisma } from "../../core/prisma/client";
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import { getPagination, buildPagination } from "../../core/config/api-response";
import { startOfUtcDay } from "../../core/utils/time";
import { uniqueDocumentNumber } from "../../core/utils/document-number";
import {
  resolveTuitionFeeForGroup,
  loadPricingTarget,
  explainMissingFee,
} from "../../core/pricing/tuition-scope";
import { computeCharge, countEligible } from "../../core/pricing/eligibility";
import {
  CreateInvoiceInput,
  GenerateInvoicesInput,
  UpdateInvoiceInput,
  InvoiceQueryInput,
  CancelInvoiceInput,
} from "./invoice.schema";
import {
  containsOn,
  matchTextIds,
  words,
} from "../../core/search/text-match";

/**
 * الدفعات الموزَّعة على الفاتورة — في القائمة كما في التفصيل.
 *
 * كانت في التفصيل وحده، فكان كشفُ حقوقٍ يعرض ثلاثين طالباً مضطراً إلى
 * ثلاثين طلباً ليكتب عمود «التاريخ». والتاريخ ليس زينة: الورقة تُوقَّع
 * على «دُفع في 13/01» لا على «مسدَّدة».
 */
const paymentInvoicesSelect = {
  select: {
    id: true,
    paidAmount: true,
    createdAt: true,
    payment: {
      select: {
        id: true,
        paymentNumber: true,
        paymentMethod: true,
        paymentDate: true,
        status: true,
      },
    },
  },
  orderBy: { createdAt: "asc" },
} as const;

const invoiceSelect = {
  id: true,
  invoiceNumber: true,
  studentEnrollmentId: true,
  academicYearId: true,
  month: true,
  year: true,
  amount: true,
  discount: true,
  total: true,
  remaining: true,
  status: true,
  dueDate: true,
  note: true,
  createdById: true,
  cancelledAt: true,
  cancelledById: true,
  cancelReason: true,
  createdAt: true,
  updatedAt: true,
  studentEnrollment: {
    select: {
      id: true,
      isActive: true,
      student: {
        select: { id: true, firstName: true, lastName: true, parentPhone: true },
      },
      teachingAssignment: {
        select: {
          id: true,
          subject: { select: { id: true, name: true } },
          teacher: { select: { id: true, firstName: true, lastName: true } },
          /* المستوى والطور معه — الفوج وحده لا يُعرِّف موضعَ الطالب */
          studyGroup: {
            select: {
              id: true,
              name: true,
              level: {
                select: {
                  id: true,
                  name: true,
                  educationStage: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  },
  academicYear: { select: { id: true, name: true } },
  attendanceSheetId: true,
  attendanceSheet: { select: { id: true, number: true, label: true } },
  createdBy: { select: { id: true, username: true } },
  cancelledBy: { select: { id: true, username: true } },
  paymentInvoices: paymentInvoicesSelect,
} as const;

type RawInvoice = {
  amount: Prisma.Decimal;
  discount: Prisma.Decimal;
  total: Prisma.Decimal;
  remaining: Prisma.Decimal;
  paymentInvoices?: { paidAmount: Prisma.Decimal }[];
  [key: string]: unknown;
};

/** المبالغ تُرسل أرقاماً لا كائنات Decimal */
const toResponse = <T extends RawInvoice>(invoice: T) => ({
  ...invoice,
  amount: Number(invoice.amount),
  discount: Number(invoice.discount),
  total: Number(invoice.total),
  remaining: Number(invoice.remaining),
  ...(invoice.paymentInvoices && {
    paymentInvoices: invoice.paymentInvoices.map((pi) => ({
      ...pi,
      paidAmount: Number(pi.paidAmount),
    })),
  }),
});

// --------------------------------------------------
// حساب الحقول المشتقّة
//
//   total     = amount - discount
//   remaining = total - المدفوع
//   status    مشتقّة من remaining والمدفوع
//
// (موثَّقة في schema.prisma كقاعدة على service layer)
// --------------------------------------------------

const computeTotals = (
  amount: Prisma.Decimal,
  discount: Prisma.Decimal,
  paid: Prisma.Decimal,
) => {
  const total = amount.minus(discount);
  const remaining = total.minus(paid);

  const status: InvoiceStatus = remaining.lte(0)
    ? "PAID"
    : paid.gt(0)
      ? "PARTIAL"
      : "PENDING";

  return { total, remaining, status };
};

/**
 * المدفوع فعلياً — الدفعات الملغاة لا تُحتسب.
 * صفوف PaymentInvoice تبقى بعد الإلغاء للتدقيق.
 */
const paidAmountOf = async (invoiceId: string): Promise<Prisma.Decimal> => {
  const result = await prisma.paymentInvoice.aggregate({
    where: { invoiceId, payment: { status: "ACTIVE" } },
    _sum: { paidAmount: true },
  });

  return result._sum.paidAmount ?? new Prisma.Decimal(0);
};

// --------------------------------------------------
// أدوات الشهر
// --------------------------------------------------

const firstDayOfMonth = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month - 1, 1));

const lastDayOfMonth = (year: number, month: number): Date =>
  new Date(Date.UTC(year, month, 0));

// --------------------------------------------------
// ترقيم الفواتير — ثلاث عشرة خانة عشوائية
//
// كان `INV-2026-08-0001`: يُقرأ، لكنّه لا يُمسح ويُفشي حجم الحركة —
// من رأى `0037` عرف أنّ المؤسسة أصدرت سبعاً وثلاثين فاتورة هذا الشهر.
// وصار كرقم الدفعة والإيصال: ثلاث عشرة خانة تُشفَّر في باركود Code128
// أسفل الورقة، فتُسترجع الفاتورة بمسحةٍ بدل نقل رقمها باليد.
//
// والتفرّد محروسٌ بطبقتين: فحصٌ قبل الحفظ، وقيد `@@unique` في القاعدة.
// --------------------------------------------------

/**
 * رقمُ فاتورةٍ لم يُستعمل.
 *
 * و`reserved` للتوليد الجُملي: عشرون فاتورةً تُنشأ في نداءٍ واحد لم
 * تُكتب بعدُ في القاعدة، فلا يراها الفحص — والمجموعة تمنع تصادمها
 * فيما بينها.
 */
const nextInvoiceNumber = async (
  reserved?: Set<string>,
): Promise<string> => {
  const number = await uniqueDocumentNumber(async (candidate) => {
    if (reserved?.has(candidate)) return true;

    return (await prisma.invoice.count({ where: { invoiceNumber: candidate } })) > 0;
  });

  if (!number) {
    throw new ConflictException(
      "تعذّر توليد رقمٍ فريد للفاتورة — أعد المحاولة",
      ErrorCodeEnum.RESOURCE_ALREADY_EXISTS,
    );
  }

  reserved?.add(number);

  return number;
};

// --------------------------------------------------
// Helpers
// --------------------------------------------------

const findOrThrow = async (id: string) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: {
      id: true,
      amount: true,
      discount: true,
      status: true,
      month: true,
      year: true,
    },
  });

  if (!invoice) {
    throw new NotFoundException(
      "Invoice not found",
      ErrorCodeEnum.INVOICE_NOT_FOUND,
    );
  }

  return invoice;
};

/**
 * سعر هذا (مادة + فوج) في سنةٍ دراسية.
 *
 * الترجيح في core/pricing: الفوج لم يعد الطريق الوحيد إلى السعر، فقد
 * يأتي من المستوى أو الطور أو نوعية الفوج. وأخصُّ نطاقٍ مطابق يفوز،
 * فسلوكُ «سعرٌ لهذا الفوج بعينه» يبقى كما كان — أعلى الأوزان.
 *
 * والمعيار السنةُ لا تاريخُ الشهر: المؤسسة تسعّر لسنةٍ دراسية،
 * وحمايةُ التاريخ المالي بنسخ `amount` في الفاتورة لا بفترة سريان.
 */
const resolveTuitionFee = async (
  subjectId: string,
  studyGroupId: string,
  academicYearId: string,
): Promise<Prisma.Decimal | null> => {
  const fee = await resolveTuitionFeeForGroup(
    subjectId,
    studyGroupId,
    academicYearId,
  );

  return fee?.amount ?? null;
};

/**
 * كشفُ هذا الإسناد في هذا الشهر — بالمقياس الذي تراه الشاشة.
 *
 * الكشفُ ثماني حصصٍ لا شهرٌ تقويمي، فيمتدّ بطبعه على شهرين: كشفٌ من
 * 26 أكتوبر إلى 25 نوفمبر أمرٌ عادي لا شاذّ. وكانت القسمة هنا
 * «كشفٌ واحدٌ له حصصٌ في الشهر وإلّا فلا شيء»، فما إن تلامس كشفان
 * شهراً واحداً حتّى تفرغ النسبة. وفي بيانات الاستعمال الحقيقي كان
 * ذلك هو الغالب لا النادر: أكتوبر يلمسه كشفان، ونوفمبر كشفان.
 *
 * والنتيجة لم تكن فراغاً بريئاً: `attendanceSheetId` هو الطريق الوحيد
 * إلى حصة الأستاذ من دَينٍ حُصّل بعد تخليصه (انظر `recordDebtCollections`)،
 * فكان المخلَّف يسدّد ولا تنشأ لأستاذه حصة، ولا يظهر في كشفه الجديد
 * شيء — مالٌ قُبض وحقٌّ سقط بصمت.
 *
 * فصار المقياس **شهرَ أوّل حصة**: الكشف يملك الشهر الذي بدأ فيه.
 * وهو نفسه مقياسُ الكشف التقديري وكشف الحقوق (`referenceDate` في
 * `settlement.service`) — فما تطابقه الشاشةُ تطابقه الفاتورة، ولا
 * يفترق حسابان على شيءٍ واحد.
 *
 * وإن بدأ كشفان في شهرٍ واحد — وهو ممكنٌ نادر — فالأسبقُ بداية أولى
 * به: الفاتورة الشهرية حقُّ أوّل ما فُتح في الشهر.
 */
export const monthSheet = async (
  teachingAssignmentId: string,
  year: number,
  month: number,
): Promise<string | null> => {
  const sheets = await prisma.attendanceSheet.findMany({
    where: { teachingAssignmentId },
    select: {
      id: true,
      sessions: {
        where: { status: { not: "CANCELLED" } },
        select: { sessionDate: true },
        orderBy: { sessionDate: "asc" },
        take: 1,
      },
    },
  });

  const from = firstDayOfMonth(year, month);
  const to = lastDayOfMonth(year, month);

  const opened = sheets
    .map((sheet) => ({ id: sheet.id, start: sheet.sessions[0]?.sessionDate }))
    .filter(
      (sheet): sheet is { id: string; start: Date } =>
        sheet.start !== undefined && sheet.start >= from && sheet.start <= to,
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());

  return opened[0]?.id ?? null;
};

/**
 * حصصُ الإسناد في شهر الفاتورة — مرتَّبةً بالتاريخ.
 *
 * لا تُطلب إلّا لمن قُيّدت أهليتُه بتاريخ، وهم القلّة. فالمسارُ الغالب
 * — مؤهَّلٌ من البداية — لا يمسّ القاعدة بعد.
 */
const monthSessions = async (
  teachingAssignmentId: string,
  year: number,
  month: number,
) =>
  prisma.session.findMany({
    where: {
      schedule: { teachingAssignmentId },
      status: { not: "CANCELLED" },
      sessionDate: {
        gte: firstDayOfMonth(year, month),
        lte: lastDayOfMonth(year, month),
      },
    },
    select: { sessionDate: true },
    orderBy: { sessionDate: "asc" },
  });

const getEnrollmentOrThrow = async (studentEnrollmentId: string) => {
  const enrollment = await prisma.studentEnrollment.findUnique({
    where: { id: studentEnrollmentId },
    select: {
      id: true,
      isActive: true,
      teachingAssignment: {
        select: {
          subjectId: true,
          studyGroupId: true,
          academicYearId: true,
          subject: { select: { name: true } },
          studyGroup: { select: { name: true } },
        },
      },
    },
  });

  if (!enrollment) {
    throw new NotFoundException(
      "Enrollment not found",
      ErrorCodeEnum.ENROLLMENT_NOT_FOUND,
    );
  }

  return enrollment;
};

// --------------------------------------------------
// List
// --------------------------------------------------

export const listInvoicesService = async (query: InvoiceQueryInput) => {
  const { skip, take, page, limit } = getPagination(query.page, query.limit);

  const assignmentFilter: Prisma.TeachingAssignmentWhereInput = {
    ...(query.subjectId && { subjectId: query.subjectId }),
    ...(query.studyGroupId && { studyGroupId: query.studyGroupId }),
  };

  const enrollmentFilter: Prisma.StudentEnrollmentWhereInput = {
    ...(query.studentId && { studentId: query.studentId }),
    ...(Object.keys(assignmentFilter).length > 0 && {
      teachingAssignment: assignmentFilter,
    }),
  };

  /*
   * المطابقةُ بترتيبٍ صريح — انظر `core/search/text-match`.
   *
   * وطرفان لا واحد: رقمُ الفاتورة في جدولها، واسمُ الطالب في جدوله.
   * والاسمُ يُقسَّم كلماتٍ لأنّه في حقلين — «سعد الله تسنيم» لا يوجد
   * في `lastName` وحده ولا في `firstName` وحده.
   */
  const invoiceIds = query.search
    ? await matchTextIds("Invoice", [
        containsOn(["invoiceNumber"], query.search),
      ])
    : null;

  const studentIds = query.search
    ? await matchTextIds(
        "Student",
        words(query.search).length > 1
          ? words(query.search).map((token) =>
              containsOn(["firstName", "lastName"], token),
            )
          : [containsOn(["firstName", "lastName"], query.search)],
      )
    : null;

  const where: Prisma.InvoiceWhereInput = {
    ...(query.status && { status: query.status }),
    ...(query.month !== undefined && { month: query.month }),
    ...(query.year !== undefined && { year: query.year }),
    ...(query.academicYearId && { academicYearId: query.academicYearId }),
    ...(query.studentEnrollmentId && {
      studentEnrollmentId: query.studentEnrollmentId,
    }),
    /*
     * البحث الواحد يقبل الثلاثة: رقم الفاتورة (وهو ما يُشفّره الباركود
     * أسفل الورقة)، أو لقب الطالب، أو اسمه.
     *
     * ومسحُ الباركود يكتب الرقم في الحقل نفسه كأنّه طُبع بلوحة مفاتيح،
     * فلا يحتاج مسلكاً ثانياً — يكفي أن يُطابَق رقمُ الفاتورة.
     */
    ...(query.search && {
      OR: [
        { id: { in: invoiceIds ?? [] } },
        { studentEnrollment: { studentId: { in: studentIds ?? [] } } },
      ],
    }),
    ...(Object.keys(enrollmentFilter).length > 0 && {
      studentEnrollment: enrollmentFilter,
    }),
    // متأخرة: تجاوزت الاستحقاق ولها متبقٍّ ولم تُلغَ
    ...(query.overdue === true && {
      dueDate: { lt: startOfUtcDay(new Date()) },
      remaining: { gt: 0 },
      status: { not: "CANCELLED" },
    }),
  };

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      select: { ...invoiceSelect, _count: { select: { paymentInvoices: true } } },
      skip,
      take,
      orderBy: [{ year: "desc" }, { month: "desc" }, { invoiceNumber: "asc" }],
    }),
    prisma.invoice.count({ where }),
  ]);

  return {
    invoices: invoices.map(toResponse),
    pagination: buildPagination(total, page, limit),
  };
};

// --------------------------------------------------
// Get by id — مع تفصيل الدفعات
// --------------------------------------------------

export const getInvoiceService = async (id: string) => {
  await findOrThrow(id);

  const invoice = await prisma.invoice.findUnique({
    where: { id },
    select: invoiceSelect,
  });

  if (!invoice) return null;

  return toResponse(invoice);
};

// --------------------------------------------------
// Create — فاتورة واحدة
// --------------------------------------------------

export const createInvoiceService = async (
  body: CreateInvoiceInput,
  createdById?: string,
) => {
  const enrollment = await getEnrollmentOrThrow(body.studentEnrollmentId);

  const duplicate = await prisma.invoice.findFirst({
    where: {
      studentEnrollmentId: body.studentEnrollmentId,
      month: body.month,
      year: body.year,
    },
    select: { invoiceNumber: true },
  });

  if (duplicate) {
    throw new ConflictException(
      `An invoice already exists for this enrollment in ${body.month}/${body.year} ` +
        `(${duplicate.invoiceNumber})`,
      ErrorCodeEnum.INVOICE_ALREADY_EXISTS,
    );
  }

  const periodStart = firstDayOfMonth(body.year, body.month);

  // المبلغ من الطلب، وإلا من حقوق الاشتراك السارية
  let amount: Prisma.Decimal;

  if (body.amount !== undefined) {
    amount = new Prisma.Decimal(body.amount);
  } else {
    const fee = await resolveTuitionFee(
      enrollment.teachingAssignment.subjectId,
      enrollment.teachingAssignment.studyGroupId,
      enrollment.teachingAssignment.academicYearId,
    );

    if (!fee) {
      const target = await loadPricingTarget(
        enrollment.teachingAssignment.subjectId,
        enrollment.teachingAssignment.studyGroupId,
      );

      const reason = target
        ? await explainMissingFee(
            target,
            enrollment.teachingAssignment.academicYearId,
          )
        : "تعذّر قراءة نسب الفوج.";

      throw new NotFoundException(
        `لا حقّ اشتراك ساري لـ${enrollment.teachingAssignment.subject.name} — ` +
          `${enrollment.teachingAssignment.studyGroup.name} في ${body.month}/${body.year}. ${reason}`,
        ErrorCodeEnum.TUITION_FEE_NOT_FOUND,
      );
    }

    amount = fee;
  }

  const discount = new Prisma.Decimal(body.discount ?? 0);

  if (discount.gt(amount)) {
    throw new BadRequestException(
      "Discount must not exceed the amount",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const { total, remaining, status } = computeTotals(
    amount,
    discount,
    new Prisma.Decimal(0),
  );



  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: await nextInvoiceNumber(),
      studentEnrollmentId: body.studentEnrollmentId,
      academicYearId: enrollment.teachingAssignment.academicYearId,
      month: body.month,
      year: body.year,
      amount,
      discount,
      total,
      remaining,
      status,
      dueDate: body.dueDate
        ? startOfUtcDay(body.dueDate)
        : lastDayOfMonth(body.year, body.month),
      note: body.note ?? null,
      createdById: createdById ?? null,
    },
    select: invoiceSelect,
  });

  return toResponse(invoice);
};

// --------------------------------------------------
// Generate — فواتير الشهر لكل المسجَّلين النشطين
//
// تُتخطّى الفواتير القائمة، وتُجمَع التسجيلات التي
// لا سعر لها في تقرير منفصل بدل إفشال العملية كلها.
// --------------------------------------------------

export const generateInvoicesService = async (
  body: GenerateInvoicesInput,
  createdById?: string,
) => {
  const academicYear = await prisma.academicYear.findUnique({
    where: { id: body.academicYearId },
    select: { id: true },
  });

  if (!academicYear) {
    throw new NotFoundException(
      "Academic year not found",
      ErrorCodeEnum.ACADEMIC_YEAR_NOT_FOUND,
    );
  }

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      isActive: true,
      teachingAssignment: {
        academicYearId: body.academicYearId,
        isActive: true,
        ...(body.studyGroupIds?.length && {
          studyGroupId: { in: body.studyGroupIds },
        }),
      },
      ...(body.studentIds?.length && { studentId: { in: body.studentIds } }),
    },
    select: {
      id: true,
      /** فارغُه أهليةٌ كاملة — وهو الغالب، فلا حساب إضافيّ له */
      eligibleFrom: true,
      teachingAssignmentId: true,
      teachingAssignment: {
        select: {
          subjectId: true,
          studyGroupId: true,
          subject: { select: { name: true } },
          studyGroup: { select: { name: true } },
        },
      },
      student: { select: { firstName: true, lastName: true } },
    },
  });

  const existing = await prisma.invoice.findMany({
    where: {
      month: body.month,
      year: body.year,
      studentEnrollmentId: { in: enrollments.map((e) => e.id) },
    },
    select: { studentEnrollmentId: true },
  });

  const alreadyInvoiced = new Set(
    existing.map((invoice) => invoice.studentEnrollmentId),
  );

  const periodStart = firstDayOfMonth(body.year, body.month);
  const dueDate = body.dueDate
    ? startOfUtcDay(body.dueDate)
    : lastDayOfMonth(body.year, body.month);

  // السعر يتكرر كثيراً لنفس (مادة + فوج) — نُخزّنه مؤقتاً
  const feeCache = new Map<string, Prisma.Decimal | null>();
  /** هل تُناسَب رسومُ الملتحق متأخّراً؟ قاعدةٌ في `TuitionFee` لكل نطاق */
  const prorateByScope = new Map<string, boolean>();
  /** حصصُ الشهر لكل إسناد — تُجلب لمن قُيّدت أهليتُه وحده */
  const sessionSchema = new Map<string, { sessionDate: Date }[]>();
  const sessionCache = sessionSchema;
  /** كشفُ الشهر لكل إسناد — يُحلّ مرّةً ويُعاد استعمالُه لطلبة الفوج كلِّهم */
  const sheetCache = new Map<string, string | null>();

  /*
   * الحصص المعتمدة للشهر — من سياسة السنة.
   *
   * سقفٌ لا يُنزَل عنه: لو أُنجزت خمسُ حصصٍ من ثمانٍ ثم وُلّدت الفواتير،
   * لكان القسمة على خمسٍ تجعل حصة الملتحق أغلى من حصة القديم.
   */
  const sheetSessions = (
    await prisma.academicYear.findUnique({
      where: { id: body.academicYearId },
      select: { sessionsPerMonth: true },
    })
  )?.sessionsPerMonth ?? 0;

  const missingFee: {
    studentEnrollmentId: string;
    student: string;
    subject: string;
    studyGroup: string;
  }[] = [];

  /** المتعثّرون مجمَّعين بـ (مادة + فوج) — سببُهم واحد لا يُكرَّر */
  const missingByScope = new Map<
    string,
    {
      subjectId: string;
      studyGroupId: string;
      subject: string;
      studyGroup: string;
      students: number;
    }
  >();

  const rows: Prisma.InvoiceCreateManyInput[] = [];

  /* أرقامُ هذه الدفعة — تمنع تصادمها فيما بينها قبل أن تُكتب */
  const reserved = new Set<string>();

  for (const enrollment of enrollments) {
    if (alreadyInvoiced.has(enrollment.id)) continue;

    const { subjectId, studyGroupId } = enrollment.teachingAssignment;
    const key = `${subjectId}:${studyGroupId}`;

    if (!feeCache.has(key)) {
      const resolved = await resolveTuitionFeeForGroup(
        subjectId,
        studyGroupId,
        body.academicYearId,
      );

      feeCache.set(key, resolved?.amount ?? null);
      prorateByScope.set(
        key,
        resolved?.lateEnrollmentMode !== "FULL_MONTH",
      );
    }

    const fee = feeCache.get(key) ?? null;

    if (!fee) {
      const subject = enrollment.teachingAssignment.subject.name;
      const studyGroup = enrollment.teachingAssignment.studyGroup.name;

      missingFee.push({
        studentEnrollmentId: enrollment.id,
        student: `${enrollment.student.firstName} ${enrollment.student.lastName}`,
        subject,
        studyGroup,
      });

      const entry = missingByScope.get(key);

      if (entry) entry.students++;
      else
        missingByScope.set(key, {
          subjectId,
          studyGroupId,
          subject,
          studyGroup,
          students: 1,
        });

      continue;
    }

    /*
     * الالتحاق المتأخّر — يُحسب الحقُّ بقدر ما صار الطالب مسؤولاً عنه.
     *
     * ولا يُقرأ إلّا لمن قُيّدت أهليتُه بتاريخ: `eligibleFrom` فارغٌ في
     * كل تسجيلٍ قائم، فالمسار الغالب يمرّ بلا استعلامٍ واحد ولا يتغيّر
     * فيه رقم. والغيابُ بعد الالتحاق لا ينقص شيئاً — المقياس الحصصُ
     * المؤهَّلة لا المحضورة.
     */
    let charge = {
      amount: fee,
      approvedSessions: null as number | null,
      eligibleSessions: null as number | null,
      sessionRate: null as Prisma.Decimal | null,
    };

    if (enrollment.eligibleFrom) {
      const key2 = enrollment.teachingAssignmentId;

      if (!sessionCache.has(key2)) {
        sessionCache.set(
          key2,
          await monthSessions(key2, body.year, body.month),
        );
      }

      const sessions = sessionCache.get(key2)!;
      const approved = Math.max(sessions.length, sheetSessions);

      charge = computeCharge({
        tuition: fee,
        approvedSessions: approved,
        eligibleSessions: countEligible(enrollment, sessions),
        prorate: prorateByScope.get(key) ?? true,
      });
    }

    /* كشفُ الفترة — يُنسب مرّةً للإسناد ويُشارَك بين طلبته */
    if (!sheetCache.has(enrollment.teachingAssignmentId)) {
      sheetCache.set(
        enrollment.teachingAssignmentId,
        await monthSheet(enrollment.teachingAssignmentId, body.year, body.month),
      );
    }

    const discount = new Prisma.Decimal(0);
    const { total, remaining, status } = computeTotals(
      charge.amount,
      discount,
      new Prisma.Decimal(0),
    );

    rows.push({
      invoiceNumber: await nextInvoiceNumber(reserved),
      studentEnrollmentId: enrollment.id,
      academicYearId: body.academicYearId,
      month: body.month,
      year: body.year,
      amount: charge.amount,
      approvedSessions: charge.approvedSessions,
      eligibleSessions: charge.eligibleSessions,
      sessionRate: charge.sessionRate,
      attendanceSheetId: sheetCache.get(enrollment.teachingAssignmentId) ?? null,
      discount,
      total,
      remaining,
      status,
      dueDate,
      createdById: createdById ?? null,
    });
  }

  if (rows.length > 0) {
    await prisma.invoice.createMany({ data: rows });
  }

  const invoices = await prisma.invoice.findMany({
    where: { invoiceNumber: { in: rows.map((row) => row.invoiceNumber) } },
    select: invoiceSelect,
    orderBy: { invoiceNumber: "asc" },
  });

  /*
   * لماذا لم يُولَّد.
   *
   * «بلا حقّ اشتراك» جوابٌ صحيح لا يُفيد: المستخدم يرى التسعيرة أمامه
   * في القائمة ويقرأ أنها غير موجودة، فيظنّ الخلل في النظام. والسببُ
   * الغالب تاريخُ السريان لا الغياب.
   *
   * والتشخيص لكل (مادة + فوج) مرّة لا لكل طالب: خمسة عشر طالباً في
   * فوجٍ واحد سببُهم واحد.
   */
  const diagnoses: {
    subject: string;
    studyGroup: string;
    students: number;
    reason: string;
  }[] = [];

  for (const [key, group] of missingByScope) {
    const target = await loadPricingTarget(group.subjectId, group.studyGroupId);

    diagnoses.push({
      subject: group.subject,
      studyGroup: group.studyGroup,
      students: group.students,
      reason: target
        ? await explainMissingFee(target, body.academicYearId)
        : "تعذّر قراءة نسب الفوج.",
    });

    void key;
  }

  return {
    invoices: invoices.map(toResponse),
    created: rows.length,
    skippedExisting: alreadyInvoiced.size,
    skippedNoFee: missingFee,
    feeDiagnoses: diagnoses,
  };
};

// --------------------------------------------------
// Update
//
// تعديل المبلغ أو التخفيض يُعيد حساب المشتقّات
// انطلاقاً من المدفوع فعلياً.
// --------------------------------------------------

export const updateInvoiceService = async (
  id: string,
  body: UpdateInvoiceInput,
) => {
  const existing = await findOrThrow(id);

  if (existing.status === "CANCELLED") {
    throw new ConflictException(
      "Cannot modify a cancelled invoice",
      ErrorCodeEnum.INVOICE_CANCELLED,
    );
  }

  const amount =
    body.amount !== undefined
      ? new Prisma.Decimal(body.amount)
      : existing.amount;

  const discount =
    body.discount !== undefined
      ? new Prisma.Decimal(body.discount)
      : existing.discount;

  if (discount.gt(amount)) {
    throw new BadRequestException(
      "Discount must not exceed the amount",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const recalculate = body.amount !== undefined || body.discount !== undefined;

  let derived: {
    total: Prisma.Decimal;
    remaining: Prisma.Decimal;
    status: InvoiceStatus;
  } | null = null;

  if (recalculate) {
    const paid = await paidAmountOf(id);

    if (amount.minus(discount).lt(paid)) {
      throw new BadRequestException(
        `Total (${amount.minus(discount)}) would be less than the amount already paid (${paid})`,
        ErrorCodeEnum.PAYMENT_AMOUNT_INVALID,
      );
    }

    derived = computeTotals(amount, discount, paid);
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      ...(body.amount !== undefined && { amount }),
      ...(body.discount !== undefined && { discount }),
      ...(body.dueDate !== undefined && {
        dueDate: startOfUtcDay(body.dueDate),
      }),
      ...(body.note !== undefined && { note: body.note }),
      ...(derived && {
        total: derived.total,
        remaining: derived.remaining,
        status: derived.status,
      }),
    },
    select: invoiceSelect,
  });

  return toResponse(invoice);
};

// --------------------------------------------------
// Cancel — بدل الحذف (سجل مالي)
// --------------------------------------------------

export const cancelInvoiceService = async (
  id: string,
  body: CancelInvoiceInput,
  cancelledById: string,
) => {
  const existing = await findOrThrow(id);

  if (existing.status === "CANCELLED") {
    throw new ConflictException(
      "Invoice is already cancelled",
      ErrorCodeEnum.INVOICE_CANCELLED,
    );
  }

  // الدفعات الملغاة لا تمنع إلغاء الفاتورة
  const payments = await prisma.paymentInvoice.count({
    where: { invoiceId: id, payment: { status: "ACTIVE" } },
  });

  if (payments > 0) {
    throw new ConflictException(
      `Cannot cancel: invoice has ${payments} active payment(s) applied. ` +
        `Cancel the payment first.`,
      ErrorCodeEnum.INVOICE_ALREADY_PAID,
    );
  }

  const invoice = await prisma.invoice.update({
    where: { id },
    data: {
      status: "CANCELLED",
      remaining: new Prisma.Decimal(0),
      cancelledAt: new Date(),
      cancelledById,
      cancelReason: body.reason ?? null,
    },
    select: invoiceSelect,
  });

  return toResponse(invoice);
};
