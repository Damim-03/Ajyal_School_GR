/**
 * الصيانة — نسخٌ واستعادةٌ وإعادةُ تهيئة.
 *
 * والنسخُ تُكتب على قرص الجهاز لا تُنزَّل إلى المتصفّح: الواجهة تعمل
 * في WebView، والخادمُ على الجهاز نفسه. فيُرجع الخادمُ مسارَ الملفّ
 * ويعرضه المستخدم، ويستعيد منه بضغطةٍ بلا رفع.
 */

import { apiClient } from "../../core/api/client";

/** مجموعاتُ ما يُبقى من إعادة التهيئة — والحسابات ليست منها لأنّها لا تُمحى */
export type KeepGroup = "identity" | "structure" | "staff" | "pricing";

export interface MaintenanceOverview {
  tables: {
    name: string;
    rows: number;
    /** لا يُمحى أبداً — جداولُ الحسابات وأدوارها */
    locked: boolean;
    group: KeepGroup | null;
  }[];
  uploads: { files: number; bytes: number };
  backupsDir: string;
  groups: { key: KeepGroup; label: string; tables: string[]; rows: number }[];
}

export interface BackupFile {
  name: string;
  bytes: number;
  createdAt: string;
}

export const getMaintenance = async () => {
  const { data } = await apiClient.get("/maintenance");
  return data.data as MaintenanceOverview;
};

export const listBackups = async () => {
  const { data } = await apiClient.get("/maintenance/backups");
  return data.data as BackupFile[];
};

export const createBackup = async () => {
  const { data } = await apiClient.post("/maintenance/backup");
  return data.data as {
    name: string;
    path: string;
    bytes: number;
    tables: Record<string, number>;
  };
};

export const deleteBackup = async (name: string) => {
  await apiClient.delete(`/maintenance/backups/${encodeURIComponent(name)}`);
};

/** الاستعادة من نسخةٍ محفوظة — لا رفعَ ولا نقلَ عبر الشبكة */
export const restoreBackup = async (name: string) => {
  const { data } = await apiClient.post("/maintenance/restore", { name });
  return data.data as { tables: Record<string, number>; files: number };
};

/** الاستعادة من ملفٍّ جاء من قرصٍ خارجيّ أو جهازٍ آخر */
export const restoreFromFile = async (file: File) => {
  const form = new FormData();
  form.append("file", file);

  const { data } = await apiClient.post("/maintenance/restore", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return data.data as { tables: Record<string, number>; files: number };
};

export const resetSystem = async (body: {
  keep: KeepGroup[];
  purgeFiles: boolean;
}) => {
  const { data } = await apiClient.post("/maintenance/reset", {
    ...body,
    /* الكلمةُ يتحقّق منها الخادم أيضاً — لا الواجهةُ وحدها */
    confirm: "إعادة التهيئة",
  });

  return data.data as {
    deleted: Record<string, number>;
    kept: string[];
    purgedFiles: number;
  };
};

/** «9.9 م.ب» — الحجم يُقرأ لا يُحسب */
export const humanBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} بايت`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} ك.ب`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
};
