import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/**
 * ذاكرة الصفحات — استمرارية السياق عبر التنقّل.
 *
 * المبدأ (§SCROLL POSITION): «العودة» يجب أن تُعيدك إلى ما كنت عليه، لا
 * إلى أعلى الصفحة. فقدان موضع التمرير بعد فتح تفصيل والرجوع منه هو أكثر
 * ما يكسر الإحساس بأن التطبيق «مكان» لا سلسلة صفحات.
 *
 * التخزين في الذاكرة لا في localStorage: هذا سياق جلسة، وحفظه على القرص
 * يجعل فتح التطبيق غداً يستأنف تمريراً لا يتذكّره المستخدم.
 */

/** موضع التمرير لكل مسار. */
const scrollMemory = new Map<string, number>();
/** سياق حرّ لكل مسار: بحث، مرشِّحات، تبويب، صفّ مركَّز… */
const contextMemory = new Map<string, Record<string, unknown>>();

/**
 * يحفظ موضع تمرير العنصر ويستعيده عند العودة للمسار نفسه.
 * يُمرَّر ref لحاوية التمرير؛ فإن لم يُمرَّر استُعمل تمرير النافذة.
 */
export function useScrollMemory(ref?: React.RefObject<HTMLElement | null>) {
  const { pathname } = useLocation();
  const saved = useRef(0);

  useEffect(() => {
    const el = ref?.current;
    const read = () => (el ? el.scrollTop : window.scrollY);
    const write = (v: number) => (el ? (el.scrollTop = v) : window.scrollTo(0, v));

    // الاستعادة تُؤجَّل إطاراً واحداً: المحتوى قد لا يكون بارتفاعه النهائي
    // لحظة التركيب، فالضبط الفوري يقع على صفحة أقصر ثم يُقصّ.
    const restore = window.requestAnimationFrame(() => {
      const v = scrollMemory.get(pathname);
      if (v) write(v);
    });

    const target: HTMLElement | Window = el ?? window;
    const onScroll = () => { saved.current = read(); };
    target.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(restore);
      target.removeEventListener("scroll", onScroll);
      scrollMemory.set(pathname, saved.current);
    };
  }, [pathname, ref]);
}

/**
 * سياق الصفحة (بحث/مرشِّحات/تبويب…). يُقرأ مرّة عند التركيب ويُكتب عند
 * المغادرة، فلا يُعيد العرض في كل تغيّر.
 */
export function readPageContext<T extends Record<string, unknown>>(
  pathname: string,
  fallback: T,
): T {
  return { ...fallback, ...(contextMemory.get(pathname) as Partial<T> | undefined) };
}

export function writePageContext(pathname: string, ctx: Record<string, unknown>) {
  contextMemory.set(pathname, ctx);
}

/** يُنسى كل شيء عند تسجيل الخروج — جلسة جديدة تبدأ نظيفة. */
export function clearPageMemory() {
  scrollMemory.clear();
  contextMemory.clear();
}
