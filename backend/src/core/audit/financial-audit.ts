import { FinancialAuditAction, Prisma } from "../../../generated/prisma";
import { prisma } from "../prisma/client";

/**
 * أثر التغيير المالي — §20.
 *
 * آثارُ الإلغاء على الفاتورة والدفعة تجيب عن «مَن ألغى ولماذا»، لكنها
 * لا تجيب عن «كم كان السعر قبل أن يُرفع». هذا السجل يحفظ الطرفين.
 *
 * والكتابة **لا تُفشل العملية الأصلية**: سقوطُ سطرٍ في دفتر التدقيق
 * لا يجوز أن يمنع قبض مالٍ من طالب. يُسجَّل الخطأ في السجلّ ويمضي
 * الطلب — والنقصُ في الدفتر يُكتشف بمراجعته، لا بتعطيل الصندوق.
 */

export interface AuditEntry {
  entity: string;
  entityId: string;
  action: FinancialAuditAction;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  reason?: string | null;
  userId?: string | null;
}

export const recordAudit = async (
  entry: AuditEntry,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> => {
  try {
    await client.financialAuditLog.create({
      data: {
        entity: entry.entity,
        entityId: entry.entityId,
        action: entry.action,
        field: entry.field ?? null,
        oldValue: entry.oldValue ?? null,
        newValue: entry.newValue ?? null,
        reason: entry.reason ?? null,
        userId: entry.userId ?? null,
      },
    });
  } catch (error) {
    console.error("[audit] failed to record entry", entry, error);
  }
};

/** أثر التغييرات بين حالتين — يكتب سطراً لكل حقل تبدّل فعلاً */
export const recordFieldChanges = async <T extends Record<string, unknown>>(
  entity: string,
  entityId: string,
  before: T,
  after: T,
  fields: readonly (keyof T & string)[],
  userId?: string | null,
  client: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<void> => {
  for (const field of fields) {
    const from = before[field];
    const to = after[field];

    if (String(from) === String(to)) continue;

    await recordAudit(
      {
        entity,
        entityId,
        action: "UPDATE",
        field,
        oldValue: from == null ? null : String(from),
        newValue: to == null ? null : String(to),
        userId,
      },
      client,
    );
  }
};
