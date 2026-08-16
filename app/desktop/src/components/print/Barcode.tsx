import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

/**
 * باركود Code128 يُرسم SVG — قابل للمسح والطباعة.
 *
 * يشفّر رقم الفاتورة أو الإيصال، فيُمسح لاسترجاع المستند بدل قراءة
 * رقمٍ من ورقة وكتابته يدوياً.
 *
 * SVG لا canvas: المتّجه يخرج حادّاً على أي دقّة طباعة، والقماش يُنقّط
 * بدقّة الشاشة فتتشقّق القضبان على الحراري.
 */
export function Barcode({
  value,
  height = 40,
  fit,
  className,
}: {
  value: string;
  height?: number;
  /**
   * يملأ صندوقه بدل أن يفرض مقاسه بالبكسل.
   *
   * تحتاجه البطاقة: مقاساتها بالمليمتر (85.6×54)، والباركود المرسوم
   * بعرضٍ بالبكسل يخرج إمّا أعرضَ من البطاقة أو تائهاً في وسطها.
   * و`viewBox` يُضبط من مقاس المرسوم بعد الرسم لأنّ JsBarcode لا
   * يضعه، وبلا `viewBox` لا يتمدّد SVG لصندوقه أصلاً.
   */
  fit?: boolean;
  className?: string;
}) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !value) return;

    try {
      JsBarcode(ref.current, value, {
        format: "CODE128",
        height,
        width: 1.5,
        displayValue: false,
        margin: 0,
        background: "#ffffff",
        lineColor: "#000000",
      });

      if (fit) {
        const svg = ref.current;
        /*
         * `parseFloat` لا القيمة كما هي: JsBarcode يكتب «135px»، و
         * `viewBox="0 0 135px 40px"` يرفضه المتصفّح («Expected number»)
         * فيسقط الإطار كلّه ولا يظهر باركود.
         */
        const w = parseFloat(svg.getAttribute("width") ?? "");
        const h = parseFloat(svg.getAttribute("height") ?? "");

        if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) {
          svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
          /*
           * `none`: القضبان تتمدّد أفقياً بنسبةٍ واحدة فتبقى نسبُ
           * عروضها — وهي وحدها ما يقرؤه الماسح — والتمدّد الرأسي لا
           * معنى له عنده أصلاً.
           */
          svg.setAttribute("preserveAspectRatio", "none");
          svg.removeAttribute("width");
          svg.removeAttribute("height");
        }
      }
    } catch {
      /* رمز لا يقبله Code128 — يُترك فارغاً بدل إسقاط الورقة كلّها */
    }
  }, [value, height, fit]);

  return (
    <svg
      ref={ref}
      className={className ?? "mx-auto block max-w-full"}
      style={fit ? { width: "100%", height: "100%", display: "block" } : undefined}
    />
  );
}
