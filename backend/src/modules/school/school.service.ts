import { prisma } from "../../core/prisma/client";
import {
  SCHOOL_DEFAULTS,
  SCHOOL_KEYS,
  type SchoolKey,
  type UpdateSchoolInput,
  type ResetSchoolInput,
} from "./school.schema";

/**
 * هوية المدرسة.
 *
 * القراءة تدمج المخزَّن فوق الافتراضي، فالواجهة تتلقّى دائماً مجموعة
 * كاملة من المفاتيح ولا تحتاج أن تعرف أيّها مضبوط. وهذا يجعل أوّل
 * تشغيل — وقاعدة البيانات فارغة — يعمل بلا حالة خاصّة.
 */

export type SchoolIdentity = Record<SchoolKey, string>;

const withDefaults = (stored: Map<string, string>): SchoolIdentity =>
  Object.fromEntries(
    SCHOOL_KEYS.map((key) => [key, stored.get(key) ?? SCHOOL_DEFAULTS[key]]),
  ) as SchoolIdentity;

// --------------------------------------------------
// Read
// --------------------------------------------------

export const getSchoolService = async () => {
  const rows = await prisma.setting.findMany({
    where: { key: { in: SCHOOL_KEYS } },
    select: { key: true, value: true, updatedAt: true },
  });

  const stored = new Map(rows.map((row) => [row.key, row.value]));

  /*
   * آخر تعديل يُرسَل مع القيم: الواجهة تستعمله لتعرف متى تُبطل
   * نسختها المخزّنة محلياً بدل أن تُعيد الجلب في كل شاشة.
   */
  const updatedAt = rows.reduce<Date | null>(
    (latest, row) => (!latest || row.updatedAt > latest ? row.updatedAt : latest),
    null,
  );

  return {
    settings: withDefaults(stored),
    /** المفاتيح المضبوطة فعلاً — ما عداها افتراضي */
    configured: rows.map((row) => row.key),
    updatedAt,
  };
};

// --------------------------------------------------
// Update
// --------------------------------------------------

export const updateSchoolService = async (body: UpdateSchoolInput) => {
  const entries = Object.entries(body) as [SchoolKey, string][];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    ),
  );

  return getSchoolService();
};

// --------------------------------------------------
// Reset
//
// الحذف لا الكتابة بالقيمة الافتراضية: الصفّ الغائب يعني «غير مضبوط»
// فتتبع المدرسةُ أيَّ تغييرٍ لاحقٍ في الافتراضيات تلقائياً.
// --------------------------------------------------

export const resetSchoolService = async (body: ResetSchoolInput) => {
  await prisma.setting.deleteMany({ where: { key: { in: body.keys } } });

  return getSchoolService();
};
