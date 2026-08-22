/**
 * تقسيمُ صفوف الورقة على الأوراق — بالقياس لا بالعدّ المفترض.
 *
 * كان عدد الصفوف في الورقة رقماً ثابتاً (25 في كشف الحضور و26×2 في كشف
 * الحقوق)، محسوباً على أنّ ارتفاع الصفّ 4.9mm. والقياس يقول 5.95mm —
 * فحتى الصفوف من سطرٍ واحد كانت تتجاوز الورقة قليلاً. ويسقط التقدير
 * تماماً عند أوّل نصٍّ يلتفّ سطرين: «مخلف — من كشف الفوج 2 — الترتيب 9»
 * في عمودٍ عرضه 12% تصير سطرين، فيصير الصفّ 10.75mm، فتخرج آخرُ الصفوف
 * **خارج الورقة** — لا تُقصّ فيُنتبه إليها، بل تُطبع حيث لا يبلغ الحبر.
 *
 * ولا سبيل إلى معرفة ارتفاع الصفّ قبل رسمه: يتعلّق بنصٍّ يكتبه الموظّف،
 * وباسمٍ قد يطول، وبعرض الأعمدة، وبالخطّ. فالحلّ أن تُرسم الصفوف كلُّها
 * مرّةً في ورقةٍ خفيّة، وتُقاس، ثمّ تُوزَّع بارتفاعها الحقيقي.
 *
 * وهنا قياسان لأنّ للكشفين بنيتين:
 *   • `usePagedRows` — صفٌّ لطالبٍ واحد، فتُوزَّع الصفوف بأطوالها.
 *   • `usePagedBlocks` — صفٌّ لطالبين (كشف الحقوق نصفان)، فيُعطى الجميع
 *     ارتفاع أطولهم لأنّ الاقتران يتبدّل بتبدّل السعة.
 */

import { useLayoutEffect, useRef, useState } from "react";

/** مقاسات الورقة كما هي في `index.css` — القسمة تحتاجها أرقاماً */
export const SHEET_MM = { width: 297, height: 210, padding: 6 } as const;

/** احتياطٌ ضدّ تقريب الكسور — أقلُّ من نصف مليمتر لا يُرى ويمنع التجاوز */
export const SAFETY_MM = 0.6;

interface Measured {
  /** ما بقي من الورقة للصفوف، بالبكسل المرسوم */
  budget: number;
  /** ارتفاع كل صفّ بالترتيب */
  heights: number[];
}

/**
 * قياسُ ورقة القياس الخفيّة.
 *
 * كلُّ القياسات بـ`getBoundingClientRect` — المعاينة مصغَّرة بـ`zoom`،
 * فخلطُ `offsetHeight` (بلا تصغير) بها يعطي نسباً كاذبة. ووحدةُ التحويل
 * تُشتقّ من عرض الورقة لأنّه ثابتٌ معلوم: 297mm.
 *
 * ويُعيد `null` إن لم تكتمل الورقة بعد — أو إن بقيت صورة الشعار في
 * الطريق، فقياسُ الترويسة قبل وصولها يقرأ ارتفاعاً ناقصاً.
 */
function measure(
  root: HTMLElement | null,
  onImages: () => void,
): Measured | null | "waiting" {
  const page = root?.querySelector<HTMLElement>("[data-measure-page]");
  const table = page?.querySelector("table");
  const foot = page?.querySelector<HTMLElement>("[data-measure-foot]");
  const rows = Array.from(table?.tBodies[0]?.rows ?? []);

  if (!page || !table || !foot || rows.length === 0) return null;

  const pending = Array.from(page.querySelectorAll("img")).filter((img) => !img.complete);

  if (pending.length > 0) {
    Promise.all(
      pending.map(
        (img) =>
          new Promise<void>((done) => {
            img.addEventListener("load", () => done(), { once: true });
            img.addEventListener("error", () => done(), { once: true });
          }),
      ),
    ).then(onImages);

    return "waiting";
  }

  const box = page.getBoundingClientRect();
  const pxPerMm = box.width / SHEET_MM.width;
  const gap = Math.max(0, foot.getBoundingClientRect().top - table.getBoundingClientRect().bottom);

  /* من أعلى أوّل صفٍّ إلى حافّة الحشوة السفلى، ناقصاً التذييل وفراغه */
  const budget =
    box.bottom -
    (SHEET_MM.padding + SAFETY_MM) * pxPerMm -
    rows[0].getBoundingClientRect().top -
    (foot.getBoundingClientRect().height + gap);

  return { budget, heights: rows.map((row) => row.getBoundingClientRect().height) };
}

/**
 * توزيعُ صفوفٍ متفاوتة الارتفاع.
 *
 * `signature` بصمةُ ما يغيّر الارتفاعات. إذا تبدّلت أُعيد القياس؛ وإلّا
 * فالتوزيع محفوظ فلا يُقاس مع كل رسمة.
 *
 * ويُعيد `pages = null` في الرسمة الأولى — وهي إشارةُ المستدعي إلى أن
 * يرسم ورقةَ القياس الخفيّة، ثمّ يُعيد فهارسَ صفوف كلِّ ورقة.
 */
export function usePagedRows(
  signature: string,
  /** ما يُقسَّم به الجدول إن تعذّر القياس — العدد القديم المفترض */
  fallback: { rowCount: number; perPage: number },
) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<{ signature: string; pages: number[][] } | null>(null);

  /* بصمةٌ أخرى ← لا نتيجة، فتُرسم ورقة القياس من جديد */
  const pages = result && result.signature === signature ? result.pages : null;

  /** يُزاد حين تصل صورة الشعار متأخّرةً فيلزم قياسٌ ثانٍ */
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    if (pages) return;

    let alive = true;
    const measured = measure(measureRef.current, () => alive && setTick((t) => t + 1));

    if (measured === "waiting") {
      return () => {
        alive = false;
      };
    }

    /*
     * تعذّر القياس ← تقسيمٌ بالعدد المفترض.
     *
     * ورقةٌ بصفوفٍ قد تتجاوز حافّتها خيرٌ من معاينةٍ بيضاء لا تُطبع:
     * العودةُ بلا نتيجة تترك المستدعي في طور القياس إلى الأبد.
     */
    if (!measured) {
      const chunks: number[][] = [];

      for (let start = 0; start < Math.max(1, fallback.rowCount); start += fallback.perPage) {
        chunks.push(
          Array.from(
            { length: Math.min(fallback.perPage, fallback.rowCount - start) },
            (_, offset) => start + offset,
          ),
        );
      }

      setResult({ signature, pages: chunks });
      return;
    }

    const out: number[][] = [];
    let current: number[] = [];
    let used = 0;

    measured.heights.forEach((height, index) => {
      /* الصفّ الأوّل يبقى مهما طال — وإلّا دارت الحلقة بلا ورقة تسعه */
      if (current.length > 0 && used + height > measured.budget) {
        out.push(current);
        current = [];
        used = 0;
      }

      current.push(index);
      used += height;
    });

    if (current.length > 0) out.push(current);

    setResult({ signature, pages: out });
  }, [pages, signature, tick, fallback.rowCount, fallback.perPage]);

  return { measureRef, pages };
}

/**
 * سعةُ النصف الواحد في كشفٍ صفُّه طالبان.
 *
 * كشف الحقوق نصفان على ورقة: 1..26 يميناً و27..52 يساراً. وارتفاع
 * الصفّ فيه أطولُ الاسمين لا اسمٌ بعينه، والاقتران نفسُه يتبدّل بتبدّل
 * السعة — فلا يصحّ توزيعٌ بأطوالٍ مفردة. فيُؤخذ **أطولُ صفٍّ** ويُعمَّم:
 * سعةٌ أقلّ من الممكن أحياناً، لكنّها لا تتجاوز الورقة أبداً.
 *
 * والحدُّ الأعلى `max` هو عُرف الورقة الأصلية (26) — لا تُزاد فوقه ولو
 * اتّسعت، لأنّ مَن اعتاد أن يجد الطالب 30 في أعلى النصف الأيسر يضيع إن
 * نُقل.
 */
export function usePagedBlocks(signature: string, max: number) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<{ signature: string; perBlock: number } | null>(null);

  const perBlock = result && result.signature === signature ? result.perBlock : null;

  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    if (perBlock) return;

    let alive = true;
    const measured = measure(measureRef.current, () => alive && setTick((t) => t + 1));

    if (measured === "waiting") {
      return () => {
        alive = false;
      };
    }

    /* تعذّر القياس ← عُرف الورقة كما كان */
    if (!measured) {
      setResult({ signature, perBlock: max });
      return;
    }

    const tallest = Math.max(...measured.heights);
    const fits = tallest > 0 ? Math.floor(measured.budget / tallest) : max;

    setResult({ signature, perBlock: Math.max(1, Math.min(max, fits)) });
  }, [perBlock, signature, tick, max]);

  return { measureRef, perBlock };
}

/**
 * إسقاطُ الأوراق التي لا تحمل إلّا صفوفاً فارغة.
 *
 * الورقة تُملأ إلى آخرها بصفوفٍ مرقَّمة فارغة تُكتب بالقلم — هكذا
 * الأصل الورقي. فإذا التفّت الملاحظات وطالت الصفوف، دُفعت تلك الفراغات
 * إلى ورقةٍ ثانية ليس فيها اسمٌ واحد: ورقةٌ تُهدر لتحمل أرقاماً.
 *
 * فما بعد آخر ورقةٍ فيها طالبٌ يُسقط، وتبقى ورقةٌ واحدة على الأقلّ.
 */
export function dropBlankPages(pages: number[][], filled: number): number[][] {
  const kept = pages.filter((rows) => rows.some((index) => index < filled));
  return kept.length > 0 ? kept : pages.slice(0, 1);
}
