/**
 * نظامُ دخول الرئيسية — نقطةُ الدخول الموحّدة.
 *
 * استورد من `"../../motion/home-entrance"` لا من الملفّات مباشرة، كما
 * في بقيّة `motion/`.
 *
 *   tokens.ts      الأرقامُ والجدول — لا منطق.
 *   controller.ts  الساعةُ والحالة — المالكُ الوحيد للتوقيت.
 *   variants.ts    اشتقاقُ الأشكال من الحالة.
 */
export * from "./tokens";
export * from "./controller";
export * from "./variants";
