"use strict";
// --------------------------------------------------
// أدوات الوقت — حقول @db.Time في Prisma
//
// Prisma يمثّل عمود TIME كـ DateTime، فنخزّن الوقت على
// تاريخ ثابت (1970-01-01 UTC) ونتعامل معه كنص "HH:mm" في الـ API.
// --------------------------------------------------
Object.defineProperty(exports, "__esModule", { value: true });
exports.DAY_OF_WEEK_INDEX = exports.formatDate = exports.addUtcDays = exports.startOfUtcDay = exports.toMinutes = exports.formatTime = exports.parseTime = exports.TIME_PATTERN = void 0;
exports.TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
/**
 * "08:30" → Date(1970-01-01T08:30:00.000Z)
 */
const parseTime = (value) => {
    const match = exports.TIME_PATTERN.exec(value);
    if (!match) {
        throw new Error(`Invalid time value: ${value}`);
    }
    return new Date(`1970-01-01T${match[1]}:${match[2]}:00.000Z`);
};
exports.parseTime = parseTime;
/**
 * Date | string → "08:30"
 *
 * سائق MariaDB قد يُرجع عمود TIME كنص ("08:30:00")
 * أو كـ Date حسب النوع المُعلن، لذلك ندعم الحالتين.
 */
const formatTime = (value) => {
    if (typeof value === "string") {
        return value.slice(0, 5);
    }
    const hours = String(value.getUTCHours()).padStart(2, "0");
    const minutes = String(value.getUTCMinutes()).padStart(2, "0");
    return `${hours}:${minutes}`;
};
exports.formatTime = formatTime;
/**
 * "08:30" → 510 (دقائق منذ منتصف الليل) — للمقارنة والتداخل
 */
const toMinutes = (value) => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
};
exports.toMinutes = toMinutes;
// --------------------------------------------------
// أدوات التاريخ
//
// نثبّت كل التواريخ على منتصف ليل UTC حتى لا ينزلق
// اليوم بفارق المنطقة الزمنية بين الخادم والعميل.
// --------------------------------------------------
const startOfUtcDay = (value) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
exports.startOfUtcDay = startOfUtcDay;
const addUtcDays = (value, days) => new Date(value.getTime() + days * 24 * 60 * 60 * 1000);
exports.addUtcDays = addUtcDays;
/** YYYY-MM-DD — للمقارنة والرسائل */
const formatDate = (value) => value.toISOString().slice(0, 10);
exports.formatDate = formatDate;
/**
 * ترتيب أيام DayOfWeek في الـ schema يبدأ بالسبت،
 * بينما Date.getUTCDay() يبدأ بالأحد (0).
 */
exports.DAY_OF_WEEK_INDEX = {
    SUNDAY: 0,
    MONDAY: 1,
    TUESDAY: 2,
    WEDNESDAY: 3,
    THURSDAY: 4,
    FRIDAY: 5,
    SATURDAY: 6,
};
//# sourceMappingURL=time.js.map