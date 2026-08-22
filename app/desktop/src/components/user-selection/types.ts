/**
 * أنواعُ شاشة اختيار المستخدم.
 */

import type { AvatarGender } from "../../lib/identity";

/**
 * بطاقةُ حساب — ما يُرجعه `/auth/profiles` العامّ ولا شيء سواه.
 *
 * **ولا `username` فيها عمداً.** المسارُ عامٌّ يُقرأ قبل المصادقة،
 * فإرجاعُ اسم الدخول تسليمٌ لنصف بيانات الاعتماد. والدخولُ يقبل `id`
 * (`loginSchema` على الخادم)، فالشاشةُ لا تحتاج الاسمَ أصلاً.
 */
export interface Profile {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
  gender: AvatarGender | null;
}

/**
 * عنصرُ الكاروسيل — «إضافة» أو حساب.
 *
 * صنفٌ واحدٌ يجمعهما لأنّ التنقّل لا يفرّق بينهما: السهمُ يمرّ عليهما
 * سواءً، والمنطقُ يعرف الفرقَ عند التفعيل وحده.
 */
export type Slot =
  | { kind: "add" }
  | { kind: "user"; profile: Profile };

/** مرحلةُ الشاشة — تقود الظهور التدريجي والانتقال إلى كلمة المرور */
export type Stage = "loading" | "choosing" | "password" | "leaving";
