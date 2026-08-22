/**
 * تقسيمُ ورقةٍ مركَّبة على أوراق — كتلةً كتلة، وصفّاً صفّاً.
 *
 * كشفُ الحضور وكشفُ الحقوق جدولٌ واحد، فيكفيهما توزيعُ صفوفه
 * (`paged-sheet`). والكشف التقديري ليس كذلك: جدولُ الحصص، ثمّ عنوانٌ
 * وجدولُ المجموعات، ثمّ فقرةُ الطريقة، ثمّ عنوانٌ وجدولُ المخلَّفين. وكان
 * يُرسم كلُّه في ورقةٍ واحدة مهما طال — ففوجٌ فيه عشرون مخلَّفاً يخرج
 * نصفُه خارج الورقة.
 *
 * والتقسيم هنا **تدفّقٌ بالكتل**:
 *   • الكتلةُ الصمّاء (فقرة، عنوان) لا تُقسَّم — تنتقل كاملةً.
 *   • والجدولُ يُقسَّم صفوفاً، ويتكرّر رأسُه في كلّ قطعة، ويبقى ذيلُه
 *     (سطرُ المجموع) مع آخر صفٍّ منه لا وحده في ورقة.
 *
 * والقياس قبل التقسيم كما في `paged-sheet`: ورقةٌ خفيّة تُرسم مرّةً
 * وتُقاس، لأنّ ارتفاع السطر يتعلّق بنصٍّ لا يُعرف طولُه قبل رسمه.
 */

import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { SAFETY_MM, SHEET_MM } from "./paged-sheet";

/**
 * كتلةٌ في ورقةٍ مركَّبة.
 *
 * الصمّاء تنتقل كاملةً (فقرةٌ لا تُقسَّم نصفين)، والجدولُ يُقسَّم صفوفاً:
 * `head` يتكرّر في كل قطعة، و`title` مع أوّلها، و`tail` — سطرُ المجموع —
 * مع آخر صفٍّ منه.
 */
export type PrintBlock =
  | { kind: "keep"; key: string; node: ReactNode }
  | {
      kind: "table";
      key: string;
      title?: ReactNode;
      head: ReactNode;
      rows: ReactNode[];
      tail?: ReactNode;
    };

/** قياسُ كتلةٍ واحدة — كلُّ الأطوال بالبكسل المرسوم */
export type FlowMeasure =
  | {
      kind: "keep";
      /** الفراغ الذي يفصلها عمّا قبلها (هوامش مطويّة) */
      gapBefore: number;
      height: number;
    }
  | {
      kind: "table";
      gapBefore: number;
      /** العنوان وفراغُه تحته — صفرٌ إن لا عنوان */
      titleHeight: number;
      headHeight: number;
      rowHeights: number[];
      /** سطر المجموع — صفرٌ إن لا ذيل */
      tailHeight: number;
    };

/** ما يُرسم في ورقةٍ بعينها */
export type FlowPiece =
  | { kind: "keep"; index: number }
  | {
      kind: "table";
      index: number;
      /** مدى الصفوف — و`to = -1` جدولٌ بلا صفوف */
      from: number;
      to: number;
      withTitle: boolean;
      withTail: boolean;
    };

/** ورقةٌ محسوبة — قطعُها وما شغلته من الميزانية */
export interface FlowPage {
  pieces: FlowPiece[];
  /** ما شغلته الكتل بالبكسل — وما بقي منه فراغٌ ينزل بالتذييل */
  used: number;
}

/**
 * أقلُّ ما يُقبل من جدولٍ في ذيل ورقة.
 *
 * عنوانٌ ورأسُ جدولٍ وصفٌّ واحد ثمّ انقطاع = سطرٌ يتيم يُقرأ خطأً على
 * أنّه كلُّ الجدول. فإن لم يسع صفّان انتقل الجدول كلُّه إلى ما بعد.
 */
const MIN_FIRST_ROWS = 2;

/**
 * جدولٌ بهذا القدر من الصفوف أو أقلّ لا يُقسَّم.
 *
 * قطعتان من جدولٍ رباعيّ الصفوف تكلفان رأسين وعنواناً وسطرَ مجموعٍ
 * موزَّعاً — أي أكثرَ ممّا توفّرانه. ويُقرأ أوضحَ كاملاً في الورقة
 * التالية.
 */
const KEEP_WHOLE_ROWS = 4;

/**
 * التوزيع — دالّةٌ خالصة، تُختبر وحدها بلا DOM.
 *
 * `budget` ما بقي من ارتفاع الورقة للمحتوى بعد الترويسة والتذييل.
 */
export function planFlow(measures: FlowMeasure[], budget: number): FlowPage[] {
  const pages: FlowPage[] = [];
  let page: FlowPiece[] = [];
  let used = 0;

  const flush = () => {
    if (page.length > 0) pages.push({ pieces: page, used });
    page = [];
    used = 0;
  };

  for (const [index, block] of measures.entries()) {
    if (block.kind === "keep") {
      if (page.length > 0 && used + block.gapBefore + block.height > budget) flush();

      used += (page.length > 0 ? block.gapBefore : 0) + block.height;
      page.push({ kind: "keep", index });
      continue;
    }

    const total = block.rowHeights.length;

    /* جدولٌ بلا صفوف — رأسُه وذيلُه كتلةٌ صمّاء */
    if (total === 0) {
      const chrome = block.titleHeight + block.headHeight + block.tailHeight;

      if (page.length > 0 && used + block.gapBefore + chrome > budget) flush();

      used += (page.length > 0 ? block.gapBefore : 0) + chrome;
      page.push({ kind: "table", index, from: 0, to: -1, withTitle: true, withTail: true });
      continue;
    }

    /* الصغير يُنقل كاملاً بدل أن يُشطر */
    if (total <= KEEP_WHOLE_ROWS && page.length > 0) {
      const whole =
        block.titleHeight +
        block.headHeight +
        block.rowHeights.reduce((sum, h) => sum + h, 0) +
        block.tailHeight;

      if (used + block.gapBefore + whole > budget) flush();
    }

    let cursor = 0;
    let first = true;

    while (cursor < total) {
      const gap = page.length > 0 && first ? block.gapBefore : 0;
      const chrome = (first ? block.titleHeight : 0) + block.headHeight;
      const room = budget - used - gap - chrome;

      /* كم صفّاً يسع؟ وآخرُ صفٍّ يجرّ ذيلَه معه */
      let count = 0;
      let stack = 0;

      while (cursor + count < total) {
        const height = block.rowHeights[cursor + count];
        const isLast = cursor + count === total - 1;

        if (stack + height + (isLast ? block.tailHeight : 0) > room) break;

        stack += height;
        count++;
      }

      /*
       * لا يسع شيء (أو يسع سطرٌ يتيم): تُطوى الورقة ويُعاد على التي
       * بعدها. وإن كانت الورقة فارغةً أصلاً فالمحتوى أكبر منها — يُوضع
       * كما هو ولا تدور الحلقة.
       */
      const orphan = first && count < MIN_FIRST_ROWS && total >= MIN_FIRST_ROWS;

      if ((count === 0 || orphan) && page.length > 0) {
        flush();
        continue;
      }

      if (count === 0) {
        count = 1;
        stack = block.rowHeights[cursor];
      }

      /*
       * أرملة: صفٌّ واحد يبقى وحده لما بعد.
       *
       * جدولٌ ينتهي بورقةٍ فيها سطرٌ واحد وسطرُ مجموعه يبدو خطأً في
       * الطباعة لا قصداً. فيُدفع معه صفٌّ ثانٍ من هذه الورقة — والورقة
       * تتّسع له لأنّه كان فيها أصلاً.
       */
      if (count > 1 && total - cursor - count === 1) {
        count--;
        stack -= block.rowHeights[cursor + count];
      }

      const to = cursor + count - 1;
      const withTail = to === total - 1;

      page.push({ kind: "table", index, from: cursor, to, withTitle: first, withTail });
      used += gap + chrome + stack + (withTail ? block.tailHeight : 0);

      cursor += count;
      first = false;

      /*
       * قطعةٌ لم تبلغ آخر الجدول ← الورقة امتلأت، وبقيّتُه على التي
       * بعدها. وبغير هذا الطيّ تعود الحلقة فتضع قطعةً ثانية من الجدول
       * نفسه في الورقة نفسها — برأسٍ ثانٍ يتكرّر بلا سبب، ويأكل من
       * المساحة ما لم يُحسب لأنّ ما تركته قاعدةُ الأرملة أعادت ملأه.
       */
      if (!withTail) flush();
    }
  }

  flush();

  return pages.length > 0 ? pages : [{ pieces: [], used: 0 }];
}

/**
 * القياس ثمّ التوزيع.
 *
 * يُعيد `pages = null` في الرسمة الأولى — إشارةُ المستدعي إلى أن يرسم
 * ورقةَ القياس الخفيّة بعلاماتها:
 *   `[data-flow-index]` على غلاف كلّ كتلة،
 *   `[data-flow-title]` و`[data-flow-head]` و`[data-flow-row]`
 *   و`[data-flow-tail]` داخل الجداول،
 *   و`[data-measure-page]` و`[data-measure-foot]` كما في `paged-sheet`.
 */
export interface LaidOutPage {
  pieces: FlowPiece[];
  /**
   * الفراغُ الذي يُدرَج قبل التذييل — بالمليمتر.
   *
   * التذييل (‏الترقيم والإمضاء) محلُّه أسفلُ الورقة لا حيث انتهى
   * الجدول. ولا يُدفع إليه بـ`flex` ولا بارتفاعٍ مفروض على الورقة:
   * الأوّل لا يعمل في الطباعة (‏لا ارتفاع للورقة هناك، فتأتي القيمة
   * من `@page`)، والثاني يخاطر بورقةٍ بيضاء زائدة إن فاض بكسرٍ واحد.
   *
   * وما دامت الميزانية معلومةً وما شُغل منها محسوباً، فالفرق بينهما
   * فراغٌ صريحٌ يُرسم — يتطابق فيه المعروض والمطبوع تماماً.
   */
  fillMm: number;
}

export function usePagedFlow(signature: string, blockCount: number) {
  const measureRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<{ signature: string; pages: LaidOutPage[] } | null>(null);
  const [tick, setTick] = useState(0);

  const pages = result && result.signature === signature ? result.pages : null;

  useLayoutEffect(() => {
    if (pages) return;

    const root = measureRef.current;
    const page = root?.querySelector<HTMLElement>("[data-measure-page]");
    const foot = page?.querySelector<HTMLElement>("[data-measure-foot]");
    const blocks = Array.from(page?.querySelectorAll<HTMLElement>("[data-flow-index]") ?? []);

    if (!page || !foot || blocks.length === 0) return;

    /* الشعار صورة: قياسُ الترويسة قبل وصولها يقرأ ارتفاعاً ناقصاً */
    const pending = Array.from(page.querySelectorAll("img")).filter((img) => !img.complete);

    if (pending.length > 0) {
      let alive = true;

      Promise.all(
        pending.map(
          (img) =>
            new Promise<void>((done) => {
              img.addEventListener("load", () => done(), { once: true });
              img.addEventListener("error", () => done(), { once: true });
            }),
        ),
      ).then(() => alive && setTick((t) => t + 1));

      return () => {
        alive = false;
      };
    }

    const box = page.getBoundingClientRect();
    const pxPerMm = box.width / SHEET_MM.width;
    const footBox = foot.getBoundingClientRect();

    /*
     * من أعلى أوّل كتلة إلى حافّة الحشوة السفلى، ناقصاً التذييل والفراغ
     * الذي فوقه. والتذييل يُقاس بأطول صورةٍ له (الإمضاء مع الترقيم)،
     * فما دونه يزيد الورقةَ سعةً ولا ينقصها.
     */
    const first = blocks[0].getBoundingClientRect();
    const gapAboveFoot = Math.max(
      0,
      footBox.top - blocks[blocks.length - 1].getBoundingClientRect().bottom,
    );

    const budget =
      box.bottom -
      (SHEET_MM.padding + SAFETY_MM) * pxPerMm -
      first.top -
      (footBox.height + gapAboveFoot);

    const measures: FlowMeasure[] = blocks.map((node, i) => {
      const rect = node.getBoundingClientRect();
      const gapBefore =
        i === 0 ? 0 : Math.max(0, rect.top - blocks[i - 1].getBoundingClientRect().bottom);

      const table = node.querySelector<HTMLElement>("[data-flow-table]");

      if (!table) return { kind: "keep", gapBefore, height: rect.height };

      const title = node.querySelector<HTMLElement>("[data-flow-title]");
      const head = table.querySelector<HTMLElement>("[data-flow-head]");
      const tail = table.querySelector<HTMLElement>("[data-flow-tail]");
      const rows = Array.from(table.querySelectorAll<HTMLElement>("[data-flow-row]"));

      return {
        kind: "table",
        gapBefore,
        /* من أعلى العنوان إلى أعلى الجدول — يشمل الفراغ بينهما */
        titleHeight: title
          ? table.getBoundingClientRect().top - title.getBoundingClientRect().top
          : 0,
        headHeight: head?.getBoundingClientRect().height ?? 0,
        rowHeights: rows.map((row) => row.getBoundingClientRect().height),
        tailHeight: tail?.getBoundingClientRect().height ?? 0,
      };
    });

    setResult({
      signature,
      pages: planFlow(measures, budget).map((page) => ({
        pieces: page.pieces,
        fillMm: Math.max(0, (budget - page.used) / pxPerMm),
      })),
    });
  }, [pages, signature, tick, blockCount]);

  return { measureRef, pages };
}
