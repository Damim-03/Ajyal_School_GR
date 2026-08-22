import { Request, Response } from "express";

import { ApiResponse } from "../../core/config/api-response";
import { BadRequestException } from "../../core/errors/app.errors";
import { ErrorCodeEnum } from "../../core/enums/error-code.enum";
import {
  backupService,
  deleteBackupService,
  listBackupsService,
  overviewService,
  readBackupService,
  resetService,
  restoreService,
} from "./maintenance.service";
import type { ResetInput } from "./maintenance.schema";

// GET /api/maintenance
export const overviewController = async (_req: Request, res: Response) => {
  return ApiResponse.success(res, await overviewService(), "Maintenance overview");
};

// POST /api/maintenance/backup
export const backupController = async (_req: Request, res: Response) => {
  return ApiResponse.created(res, await backupService(), "Backup created");
};

// GET /api/maintenance/backups
export const listBackupsController = async (_req: Request, res: Response) => {
  return ApiResponse.success(res, await listBackupsService(), "Backups");
};

/*
 * التنزيل يخرج من `res` مباشرةً لا عبر `ApiResponse`.
 *
 * الأرشيفُ ثنائيّ، ولفُّه في JSON يُضخّمه الثلث ويُجبر الواجهة على
 * فكّ base64 في الذاكرة. فيُرسل كما هو بترويسةٍ تحمل اسمه.
 */
// GET /api/maintenance/backups/:name/download
export const downloadBackupController = async (req: Request, res: Response) => {
  const { name, buffer } = await readBackupService(req.params.name as string);

  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${name}"`);

  return res.send(buffer);
};

// DELETE /api/maintenance/backups/:name
export const deleteBackupController = async (req: Request, res: Response) => {
  const result = await deleteBackupService(req.params.name as string);

  return ApiResponse.success(res, result, "Backup deleted");
};

/**
 * الاستعادة من ملفٍّ مرفوع أو من نسخةٍ محفوظة باسمها.
 *
 * والثانيةُ هي الغالبة: النسخُ على الجهاز نفسه، فرفعُها إلى الخادم
 * الذي كتبها عبثٌ ينقل عشرات الميغا بلا سبب. والرفعُ يبقى لمن جاء
 * بنسخةٍ من قرصٍ خارجيّ أو من جهازٍ آخر.
 */
// POST /api/maintenance/restore
export const restoreController = async (req: Request, res: Response) => {
  const name = (req.body as { name?: string } | undefined)?.name;

  if (!req.file && !name) {
    throw new BadRequestException(
      "اختر نسخةً محفوظة أو ارفع ملفَّ نسخة",
      ErrorCodeEnum.VALIDATION_ERROR,
    );
  }

  const result = await restoreService(
    req.file ? req.file.buffer : { name: name as string },
  );

  return ApiResponse.success(res, result, "Restored");
};

// POST /api/maintenance/reset
export const resetController = async (req: Request, res: Response) => {
  const body = req.body as ResetInput;

  return ApiResponse.success(res, await resetService(body), "Reset done");
};
