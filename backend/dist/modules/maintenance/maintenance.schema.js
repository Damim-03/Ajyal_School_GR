"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resetSchema = exports.KEEP_KEYS = void 0;
const zod_1 = require("zod");
/** مجموعاتُ ما يُبقى — والحسابات ليست فيها لأنّها لا تُمحى أصلاً */
exports.KEEP_KEYS = ["identity", "structure", "staff", "pricing"];
exports.resetSchema = zod_1.z.object({
    keep: zod_1.z.array(zod_1.z.enum(exports.KEEP_KEYS)).default([]),
    /** حذفُ ما لم يعد أحدٌ يشير إليه من الصور والوثائق */
    purgeFiles: zod_1.z.boolean().default(false),
    /**
     * تأكيدٌ مكتوبٌ بيد المستخدم.
     *
     * زرٌّ واحدٌ يمحو مؤسسةً كاملة لا يكفيه تأكيدُ نافذة: النقرُ يقع
     * سهواً، والكتابةُ لا تقع سهواً. والكلمةُ تُطلب في الخادم أيضاً لا
     * في الواجهة وحدها — من ناداه بغير الشاشة يُطالَب بها كما يُطالَب
     * من ناداه بها.
     */
    confirm: zod_1.z.literal("إعادة التهيئة", {
        error: "اكتب «إعادة التهيئة» للتأكيد",
    }),
});
//# sourceMappingURL=maintenance.schema.js.map