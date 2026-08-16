// --------------------------------------------------
// أدوات الوقت — حقول @db.Time في Prisma
//
// Prisma يمثّل عمود TIME كـ DateTime، فنخزّن الوقت على
// تاريخ ثابت (1970-01-01 UTC) ونتعامل معه كنص "HH:mm" في الـ API.
// --------------------------------------------------

export const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * "08:30" → Date(1970-01-01T08:30:00.000Z)
 */
export const parseTime = (value: string): Date => {
  const match = TIME_PATTERN.exec(value);

  if (!match) {
    throw new Error(`Invalid time value: ${value}`);
  }

  return new Date(`1970-01-01T${match[1]}:${match[2]}:00.000Z`);
};

/**
 * Date | string → "08:30"
 *
 * سائق MariaDB قد يُرجع عمود TIME كنص ("08:30:00")
 * أو كـ Date حسب النوع المُعلن، لذلك ندعم الحالتين.
 */
export const formatTime = (value: Date | string): string => {
  if (typeof value === "string") {
    return value.slice(0, 5);
  }

  const hours = String(value.getUTCHours()).padStart(2, "0");
  const minutes = String(value.getUTCMinutes()).padStart(2, "0");

  return `${hours}:${minutes}`;
};

/**
 * "08:30" → 510 (دقائق منذ منتصف الليل) — للمقارنة والتداخل
 */
export const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
};

// --------------------------------------------------
// أدوات التاريخ
//
// نثبّت كل التواريخ على منتصف ليل UTC حتى لا ينزلق
// اليوم بفارق المنطقة الزمنية بين الخادم والعميل.
// --------------------------------------------------

export const startOfUtcDay = (value: Date): Date =>
  new Date(
    Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
  );

export const addUtcDays = (value: Date, days: number): Date =>
  new Date(value.getTime() + days * 24 * 60 * 60 * 1000);

/** YYYY-MM-DD — للمقارنة والرسائل */
export const formatDate = (value: Date): string =>
  value.toISOString().slice(0, 10);

/**
 * ترتيب أيام DayOfWeek في الـ schema يبدأ بالسبت،
 * بينما Date.getUTCDay() يبدأ بالأحد (0).
 */
export const DAY_OF_WEEK_INDEX = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
} as const;
