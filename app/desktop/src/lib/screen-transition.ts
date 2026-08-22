import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { sfx } from "./sound";
import { moduleOf } from "../features/home/modules";
import { motionDispatch } from "../motion/orchestrator";
import { LAYER } from "../motion/layers";

/**
 * رحلة العودة إلى الرئيسية.
 *
 * ما كان: حجابٌ بلونٍ **يُمرَّر يدوياً** في كل نقطة استدعاء —
 * `exitToHome(PATHS.home, "#7dd3fc")` — يُلحَق بـbody، ثم انتقال، ثم
 * تلاشٍ. عمليّاً ستارةٌ تُسدَل ثم تُرفع عن مكان آخر. وهذا نقيض ما يجب أن
 * تكونه العودة: أنت لا تفتح الرئيسية، أنت **ترجع** إلى مكان لم يبرح
 * موضعه.
 *
 * ما صار:
 *
 *   • اللون يُشتقّ من القسم الذي تغادره لا يُكتب بيده. لا احتمال أن
 *     يتناقض مع البطل الذي دخلتَ منه، ولا أن يُنسى عند إضافة شاشة.
 *
 *   • الحجاب ينكمش **نحو موضع البلاطة** في الرئيسية بدل أن يتوسّع من
 *     مركز الشاشة. الدخول كان تمدّداً من منطقة البطل؛ فالعودة انكماشٌ
 *     إلى حيث ينتظرك رمز القسم. للحركة وجهة، وللعين ما تتبعه.
 *
 *   • تُعلَن `RETURN_START` فيعرف النظام أنّ رحلةً جارية، فلا يُعامَل
 *     تركيبُ الرئيسية بعدها كأنّه فتحُ شاشة جديدة.
 *
 * لماذا لا يزال عنصر DOM خاماً: الحجاب يجب أن يعيش **عبر** تغيّر المسار.
 * أي JSX داخل صفحة يُفكَّك في اللحظة التي نحتاجه فيها بالضبط.
 */

/** ظهور الحجاب قبل تبديل المسار. */
const COVER_MS = 360;
/** انكشافه بعده — أبطأ عمداً، فيصل المستخدمُ والمشهدُ يستقرّ. */
const REVEAL_MS = 750;
/**
 * موضع صفّ البلاطات في الرئيسية (نسبة من العرض والارتفاع، تخطيط RTL).
 * هذه هي «الوجهة»: النقطة التي سيجد فيها المستخدم رمز القسم لحظة الوصول.
 */
const HOME_ANCHOR = "78% 22%";

export function useScreenExit() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return useCallback(
    (to: string, accentOverride?: string) => {
      const mod = moduleOf(pathname);
      const accent = accentOverride ?? mod?.accent ?? "#ff8fb1";
      const deep = mod?.end ?? "#04060c";

      sfx("openHome", 0.85);
      motionDispatch({ type: "RETURN_START" });

      /*
       * لا رحلة رمزٍ في العودة أيضاً — أُزيلت بطلبٍ صريح.
       *
       * العبور كلّه صار على عاتق الحجاب وحده: ينمو من موضع البلاطة في
       * الرئيسية ثم ينكشف عنها. لا جسم يعبر الشاشة في أيّ من الاتجاهين.
       */
      const o = document.createElement("div");
      Object.assign(o.style, {
        position: "fixed",
        inset: "0",
        zIndex: String(LAYER.transition),
        background: `radial-gradient(circle at ${HOME_ANCHOR}, ${accent}2e, ${deep} 62%)`,
        pointerEvents: "none",
        transformOrigin: HOME_ANCHOR,
        // keyframes أوثق من rAF في بيئات مخنوقة
        animation: `skk-backdrop-in ${COVER_MS}ms ease-in both`,
      } as Partial<CSSStyleDeclaration> as CSSStyleDeclaration);
      document.body.appendChild(o);

      window.setTimeout(() => {
        navigate(to);
        o.style.animation = "";
        o.style.opacity = "1";
        /* ينكمش قليلاً وهو يتلاشى: انسحابٌ باتجاه الوجهة لا تبخّرٌ في المكان. */
        o.style.transition =
          `opacity ${REVEAL_MS}ms ease-out, transform ${REVEAL_MS}ms cubic-bezier(0.22,1,0.36,1)`;
        window.setTimeout(() => {
          o.style.opacity = "0";
          o.style.transform = "scale(0.94)";
        }, 20);
        window.setTimeout(() => o.remove(), REVEAL_MS + 70);
      }, COVER_MS);
    },
    [navigate, pathname],
  );
}
