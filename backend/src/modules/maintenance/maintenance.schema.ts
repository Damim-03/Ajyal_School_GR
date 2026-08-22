import { z } from "zod";

/** مجموعاتُ ما يُبقى — والحسابات ليست فيها لأنّها لا تُمحى أصلاً */
export const KEEP_KEYS = ["identity", "structure", "staff", "pricing"] as const;

export const resetSchema = z.object({
  keep: z.array(z.enum(KEEP_KEYS)).default([]),
  /** حذفُ ما لم يعد أحدٌ يشير إليه من الصور والوثائق */
  purgeFiles: z.boolean().default(false),
  /**
   * تأكيدٌ مكتوبٌ بيد المستخدم.
   *
   * زرٌّ واحدٌ يمحو مؤسسةً كاملة لا يكفيه تأكيدُ نافذة: النقرُ يقع
   * سهواً، والكتابةُ لا تقع سهواً. والكلمةُ تُطلب في الخادم أيضاً لا
   * في الواجهة وحدها — من ناداه بغير الشاشة يُطالَب بها كما يُطالَب
   * من ناداه بها.
   */
  confirm: z.literal("إعادة التهيئة", {
    error: "اكتب «إعادة التهيئة» للتأكيد",
  }),
});

export type ResetInput = z.infer<typeof resetSchema>;
