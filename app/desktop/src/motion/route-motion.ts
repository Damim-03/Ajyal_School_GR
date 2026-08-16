import { useState } from "react";
import { useLocation } from "react-router-dom";
import { PATHS } from "../routes/paths";
import { MOTION } from "./system";

/**
 * دلالة انتقال المسار: الحركة يجب أن تفسّر تغيّر الحالة، لا أن تُزيّنه.
 * الانتقال «للأمام» و«للخلف» و«بين شقيقين» ليست الشيء نفسه، فلا يصحّ أن
 * تتشارك تلاشياً واحداً.
 *
 * العمق يُشتقّ من بنية المسار نفسها، فلا يحتاج كل مسار جديد إلى تسجيل يدوي.
 */
export type RouteMotion = "forward" | "back" | "sibling" | "modal" | "replace" | "none";

/** الرئيسية جذر المساحة؛ وكل ما تحتها أعمق منها بدرجة على الأقل. */
function depthOf(pathname: string): number {
  if (pathname === PATHS.home || pathname === "/") return 0;
  // /inventory → 1 ، /inventory/add → 2 …
  return pathname.split("/").filter(Boolean).length;
}

/**
 * يصنّف الانتقال الحالي ويعطي اتجاهه.
 * `direction` بالمعنى المنطقي (‎+1 للأمام) لا البصري؛ الشاشات العربية
 * تعكسه عند العرض بنفسها كي لا يُفترض أن اليمين = التالي.
 */
export function useRouteMotion(): { motion: RouteMotion; direction: number; depth: number } {
  const { pathname } = useLocation();
  // نمط React الموثّق لتذكّر القيمة السابقة: ضبط الحالة أثناء العرض،
  // لا كتابة ref (قراءة/كتابة الـrefs أثناء العرض ممنوعة).
  const [seen, setSeen] = useState(pathname);
  const [from, setFrom] = useState<string | null>(null);
  if (seen !== pathname) {
    setFrom(seen);
    setSeen(pathname);
  }

  const depth = depthOf(pathname);
  if (from === null) return { motion: "none", direction: 0, depth };

  const prevDepth = depthOf(from);
  if (depth > prevDepth) return { motion: "forward", direction: 1, depth };
  if (depth < prevDepth) return { motion: "back", direction: -1, depth };
  // نفس العمق ⇒ شقيقان، سواء في العائلة نفسها أو بين وحدتين مختلفتين
  // (مبيعات ← مخزون). كلاهما تنقّل جانبي لا عمقي.
  return { motion: "sibling", direction: 1, depth };
}

/**
 * الشكل البصري لكل دلالة — يُقرأ من MotionPage.
 * «للأمام» عمق يتقدّم نحو المستخدم، و«للخلف» يتراجع، و«الشقيق» إزاحة
 * أفقية صغيرة. كلها مقيَّدة: الحركة تشرح ولا تستعرض.
 */
export const routeVariants = {
  /** أعمق: المحتوى يتقدّم نحو المستخدم من الأسفل. */
  forward: {
    from: { opacity: 0, y: 16, scale: 0.99 },
    to: { opacity: 1, y: 0, scale: 1 },
    transition: { ...MOTION.spring.overlay },
  },
  /** رجوع: عكس العمق — المكان كان موجوداً وعاد إلى التركيز. أسرع من الدخول. */
  back: {
    from: { opacity: 0, y: -10, scale: 1.008 },
    to: { opacity: 1, y: 0, scale: 1 },
    transition: { duration: MOTION.duration.normal * 0.8, ease: MOTION.easing.enter },
  },
  /** شقيق: حركة جانبية لا عمقية — الانتقال أفقي على المستوى نفسه. */
  sibling: {
    from: { opacity: 0, x: 14 },
    to: { opacity: 1, x: 0 },
    transition: { duration: MOTION.duration.normal, ease: MOTION.easing.enter },
  },
  /** طبقة فوق المشهد — أقرب للمستخدم، بنابض أليَن. */
  modal: {
    from: { opacity: 0, y: 12, scale: 0.985 },
    to: { opacity: 1, y: 0, scale: 1 },
    transition: { ...MOTION.spring.overlay },
  },
  /** استبدال بلا معنى مكاني (تبديل جلسة مثلاً) — تلاشٍ محض. */
  replace: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    transition: { duration: MOTION.duration.fast, ease: MOTION.easing.standard },
  },
  none: {
    from: { opacity: 0 },
    to: { opacity: 1 },
    transition: { duration: MOTION.duration.instant, ease: MOTION.easing.standard },
  },
} as const;
