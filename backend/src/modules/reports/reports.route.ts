import { Router, type Request, type Response } from "express";
import { asyncHandler } from "../../core/middleware/async-handler.middleware";
import { authMiddleware } from "../../core/middleware/auth.middleware";
import { requirePermission } from "../../core/middleware/permission.middleware";
import { validateQuery } from "../../core/middleware/validate.middleware";
import { ApiResponse } from "../../core/config/api-response";
import { NotFoundException } from "../../core/errors/app.errors";
import {
  exportQuerySchema,
  reportQuerySchema,
  type ReportQuery,
} from "./reports.filters";
import { EXPORT_PERMISSION, permissionForReport } from "./reports.permissions";
import { prisma } from "../../core/prisma/client";
import {
  GROUP_TITLE,
  REGISTRY_BY_KEY,
  REPORT_REGISTRY,
} from "./reports.registry";
import {
  CONTENT_TYPE,
  exportFilename,
  serialize,
  type ExportFormat,
} from "./reports.export";
import {
  attendanceReportService,
  financialReportService,
  overviewReportService,
  studentsReportService,
  teachersReportService,
} from "./reports.service";
import {
  allocationsReportService,
  auditReportService,
  cancellationsReportService,
  dataQualityReportService,
  debtCollectionsReportService,
  debtsReportService,
  invoicesReportService,
  paymentsReportService,
  receiptsReportService,
  settlementsReportService,
  teacherPaymentsReportService,
} from "./reports.service.finance";
import {
  academicReportService,
  assignmentsReportService,
  groupsReportService,
  levelsReportService,
  sessionsReportService,
  settlementDetailReportService,
  stagesReportService,
  studentDetailReportService,
  subjectsReportService,
  teacherDetailReportService,
} from "./reports.service.academic";

// ======================================================
// مسارات التقارير — §56
//
// وحدةٌ مستقلّة عن `modules/report` القائمة ولا تمسّها: تلك تخدم
// شاشاتٍ تعمل اليوم، وهذه تُبنى إلى جانبها ثمّ تحلّ محلَّها متى
// اكتملت — استبدالٌ على مراحل لا قطعٌ مفاجئ.
//
// وكلُّ مسارٍ يُسجَّل بمفتاح تقريره، ومنه تُشتقّ ثلاثةُ أشياء:
// الصلاحية (§54)، والفلاتر المدعومة (§4)، والتحقّق من المدخلات.
// فمن يضيف تقريراً لا ينسى حارساً ولا يختاره ارتجالاً.
// ======================================================

const router = Router();

router.use(authMiddleware);

// ======================================================
// مركزُ التصدير والتصدير — §42 §63
//
// يُسجَّلان **قبل** كلّ شيء لأنّ `/exports` و `/:report/export`
// لو جاءا بعد `/students/:studentId` لالتقطهما ذاك كمعرّفَي
// طالب — فيردّ 404 على مسارٍ موجود.
// ======================================================

/**
 * قائمةُ التقارير المتاحة لهذا المستخدم — §63.
 *
 * تُصفّى بصلاحياته لا تُعرض كاملة: قائمةٌ تحوي «سجلّ التدقيق»
 * لمن لا يراه تكشف وجودَه وتدعوه إلى محاولةٍ تُرفض. والتصفيةُ
 * هنا لا في الواجهة (§67).
 *
 * ولا يُدرَج «التصديرات الأخيرة» الذي تطلبه §63: تسجيلُها يحتاج
 * جدولاً في القاعدة، و§1 يمنع إنشاء نموذجٍ للتقارير. فالمسألةُ
 * قرارٌ لم يُتَّخذ بعد، وإغفالُها أصدقُ من قائمةٍ فارغة تُوهم
 * بميزةٍ لا تعمل.
 */
router.get(
  "/exports",
  requirePermission("report.view"),
  asyncHandler(async (req: Request, res: Response) => {
    const roleId = req.user?.roleId;

    const granted = roleId
      ? new Set(
          (
            await prisma.rolePermission.findMany({
              where: { roleId },
              select: { permission: { select: { name: true } } },
            })
          ).map((row) => row.permission.name),
        )
      : new Set<string>();

    const available = REPORT_REGISTRY.filter((report) =>
      granted.has(permissionForReport(report.key)),
    ).map((report) => ({
      key: report.key,
      title: report.title,
      description: report.description,
      group: report.group,
      groupTitle: GROUP_TITLE[report.group],
      hasTable: report.hasTable,
      path: `/reports/v2/${report.key}`,
      exportPath: `/reports/v2/${report.key}/export`,
      formats: ["csv", "xlsx"] as const,
    }));

    return ApiResponse.success(
      res,
      {
        reports: available,
        formats: [
          { key: "csv", label: "CSV", contentType: CONTENT_TYPE.csv },
          { key: "xlsx", label: "Excel", contentType: CONTENT_TYPE.xlsx },
        ],
        /*
         * §42 يطلب PDF والطباعة أيضاً — وهما من الواجهة لا من
         * الخادم. والسببُ مذكورٌ في `reports.export.ts`: PDFKit
         * لا يشكّل العربية. فيُبلَّغ العميلُ صراحةً بدل أن يجد
         * صيغةً ناقصة بلا تفسير.
         */
        clientRendered: ["pdf", "print"],
        note: "PDF والطباعة تُولَّدان في التطبيق لأنّ تشكيل العربية يحتاج محرّك عرض.",
      },
      "Export center retrieved",
    );
  }),
);

/**
 * تصديرُ أيِّ تقرير — مسارٌ واحد لكلّها.
 *
 * والصلاحيةُ **مزدوجة**: صلاحيةُ قراءة التقرير نفسه، وفوقها
 * `report.export` (§54). فمن يرى الأرقام على الشاشة لا يُخرجها
 * بالضرورة في ملفٍّ يُنقل — والفصلُ بينهما مقصودٌ في المواصفة.
 */
router.get(
  "/:report/export",
  validateQuery(exportQuerySchema),
  asyncHandler(async (req: Request, res: Response) => {
    const key = req.params.report as string;
    const registered = REGISTRY_BY_KEY.get(key);

    if (!registered) {
      throw new NotFoundException(`Unknown report: ${key}`);
    }

    /*
     * الحارسان يُطبَّقان يدوياً هنا لا كوسيطَين في التعريف.
     *
     * لأنّ الصلاحيةَ الأولى تعتمد على `:report` الذي لا يُعرف إلا
     * وقت الطلب — و`requirePermission` تُبنى بقيمةٍ ثابتة. فيُنادى
     * الوسيطان تباعاً بعد استخراج المفتاح.
     */
    await new Promise<void>((resolve, reject) =>
      requirePermission(permissionForReport(key))(req, res, (error?: unknown) =>
        error ? reject(error) : resolve(),
      ),
    );

    if (res.headersSent) return;

    await new Promise<void>((resolve, reject) =>
      requirePermission(EXPORT_PERMISSION)(req, res, (error?: unknown) =>
        error ? reject(error) : resolve(),
      ),
    );

    if (res.headersSent) return;

    const query = req.query as unknown as ReportQuery & {
      format?: ExportFormat;
      columns?: string;
    };

    const report = await registered.service(query);

    const format: ExportFormat = query.format ?? "xlsx";
    const buffer = serialize(report, format, {
      columns: query.columns
        ? String(query.columns)
            .split(",")
            .map((column) => column.trim())
            .filter(Boolean)
        : undefined,
    });

    res.setHeader("Content-Type", CONTENT_TYPE[format]);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${exportFilename(report, format)}"`,
    );
    res.setHeader("Content-Length", buffer.length);

    return res.end(buffer);
  }),
);

const register = (
  path: string,
  key: string,
  service: (query: ReportQuery) => Promise<unknown>,
) =>
  router.get(
    path,
    requirePermission(permissionForReport(key)),
    validateQuery(reportQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const report = await service(req.query as unknown as ReportQuery);

      return ApiResponse.success(res, report, `${key} report retrieved`);
    }),
  );

// --------------------------------------------------
// نظرة العموم والأكاديمي
// --------------------------------------------------

register("/overview", "overview", overviewReportService);
register("/students", "students", studentsReportService);
register("/attendance", "attendance", attendanceReportService);

// --------------------------------------------------
// المالية — جانب الطالب
// --------------------------------------------------

register("/financial", "financial", financialReportService);
register("/invoices", "invoices", invoicesReportService);
register("/payments", "payments", paymentsReportService);
register("/receipts", "receipts", receiptsReportService);

/* الأخصُّ قبل الأعمّ: `/debt-collections` قبل `/debts` */
register("/debt-collections", "debt-collections", debtCollectionsReportService);
register("/debts", "debts", debtsReportService);

// --------------------------------------------------
// المالية — جانب الأستاذ
// --------------------------------------------------

register("/teachers", "teachers", teachersReportService);
register("/settlements", "settlements", settlementsReportService);
register("/teacher-payments", "teacher-payments", teacherPaymentsReportService);
register("/allocations", "allocations", allocationsReportService);

// --------------------------------------------------
// الأكاديمي — §11 إلى §17
// --------------------------------------------------

register("/academic", "academic", academicReportService);
register("/stages", "stages", stagesReportService);
register("/levels", "levels", levelsReportService);
register("/subjects", "subjects", subjectsReportService);
register("/groups", "groups", groupsReportService);
register("/assignments", "assignments", assignmentsReportService);
register("/sessions", "sessions", sessionsReportService);

// --------------------------------------------------
// المراجعة — §37 §38 §39
// --------------------------------------------------

register("/audit", "audit", auditReportService);
register("/cancellations", "cancellations", cancellationsReportService);
register("/data-quality", "data-quality", dataQualityReportService);

// --------------------------------------------------
// التفصيل — §9 §28 §30
//
// تُسجَّل **بعد** مساراتها الجامعة: `/students` قبل
// `/students/:studentId`. ولولا الترتيب لالتقط المسارُ المعلَّم
// كلمةَ `students` نفسها في بعض المطابقات.
//
// وصلاحيةُ التفصيل هي صلاحيةُ الجامع: من يرى قائمةَ الأساتذة
// ومستحقّاتِهم يرى تفصيلَ واحدٍ منهم. والعكسُ ثغرة.
// --------------------------------------------------

const registerDetail = (
  path: string,
  key: string,
  param: string,
  service: (id: string, query: ReportQuery) => Promise<unknown>,
) =>
  router.get(
    path,
    requirePermission(permissionForReport(key)),
    validateQuery(reportQuerySchema),
    asyncHandler(async (req: Request, res: Response) => {
      const report = await service(
        req.params[param] as string,
        req.query as unknown as ReportQuery,
      );

      /*
       * الكيانُ غيرُ الموجود يردّ 404 لا 200 بجسمٍ فارغ.
       *
       * و200 بمظروفٍ خالٍ كان سيجعل الواجهةَ ترسم شاشةً بيضاء بلا
       * تفسير، ويخلط «طالبٌ لا وجود له» بـ«طالبٌ بلا نشاط».
       *
       * والرميُ لا الردُّ المباشر: `errorHandler` في التطبيق يوحّد
       * شكلَ الخطأ لكلّ المسارات، وصياغةُ 404 هنا بيدٍ كانت
       * ستُنتج شكلاً يخالف بقيةَ النظام.
       */
      if (!report) {
        throw new NotFoundException(`${key} not found`);
      }

      return ApiResponse.success(res, report, `${key} detail retrieved`);
    }),
  );

registerDetail(
  "/students/:studentId",
  "students",
  "studentId",
  studentDetailReportService,
);
registerDetail(
  "/teachers/:teacherId",
  "teachers",
  "teacherId",
  teacherDetailReportService,
);
registerDetail(
  "/settlements/:settlementId",
  "settlements",
  "settlementId",
  settlementDetailReportService,
);

export default router;
