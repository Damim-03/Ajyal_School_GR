import type { ReportChart } from "../reports.api";
import { categoryColor, seriesColor } from "./palette";
import { compactNumber, formatByUnit } from "./scale";

// ======================================================
// بناءُ خيارات ECharts من عقد التقرير
//
// دالّةٌ نقيّة: تأخذ `ReportChart` وتُرجع كائنَ الخيارات. ولا تلمس
// DOM ولا React — فهي قابلةٌ للاختبار وحدها، وهو ما لم يكن ممكناً
// حين كان الرسمُ مكتوباً بـSVG داخل المكوّن.
//
// ------------------------------------------------------
// الاتّجاه — علّةٌ قيست ولم تُخمَّن
// ------------------------------------------------------
//
// ECharts لا يملك «وضعَ RTL» يُشغَّل، ويرسم كلَّ نصٍّ بـ
// `text-anchor: start` عند إحداثيٍّ يحسبه بنفسه.
//
// و«البداية» في SVG تتبع `direction` الموروثة. فحاويةٌ بـ`rtl` —
// وهو حالُ التطبيق كلِّه — تجعل البدايةَ يميناً، فينقلب صندوقُ
// النصّ إلى اليسار فوق ما جاوره. وهذا مقيس: وسمٌ عرضُه 76px عند
// `x=15` يمتدّ إلى `-61` فيغطّي مفتاحَ اللون الذي وضعته المكتبة في
// `0..10`.
//
// فالعلاجُ في الحاوية لا هنا: `direction: ltr` على عنصر الرسم
// (`ReportChartView`). والعربيةُ تبقى مقروءةً داخل النصّ نفسِه لأنّ
// خوارزمية bidi تعمل داخل السطر لا على صندوقه.
//
// وما في هذا الملفّ هو النصفُ الآخر: قلبُ محور الفئات
// (`inverse: true`) ليبدأ من اليمين، وفسحةٌ صريحة بين المفتاح
// ونصّه بدل الاعتماد على افتراض المكتبة.
// ======================================================

/** رقمُ المحور مختصراً؛ والتلميحُ يعرض الرقم كاملاً */
const axisFormatter = (unit: ReportChart["unit"]) => (value: number) =>
  unit === "percent" ? `${value}%` : compactNumber(value);

/**
 * فسحةُ ما بين المفتاح ونصِّه.
 *
 * المكتبةُ تترك خمسَ بكسلاتٍ افتراضاً، وهي تكفي للاتينيّ ولا تكفي
 * لحرفٍ عربيٍّ ينزل تحت السطر أو يمتدّ ذيلُه — «مسدَّدة» بذيل الدال
 * تلمس المربّعَ الملوّن. والعشرُ تفصل بلا أن تفكّ الارتباطَ بينهما.
 */
const LEGEND_TEXT_PAD: [number, number, number, number] = [0, 0, 0, 10];

/**
 * تلميحٌ غنيّ — §6 و§70.
 *
 * يُبنى بـHTML لا بنصّ: النصُّ لا يحمل نقطةَ لونٍ تربط السطرَ
 * بسلسلته، فيُقرأ رقمان بلا معرفة أيُّهما «المفوتر» وأيُّهما
 * «المحصَّل» في رسمٍ فيه ثلاث سلاسل.
 */
const tooltipHtml = (
  title: string,
  rows: { color: string; label: string; value: number | null }[],
  unit: ReportChart["unit"],
) => {
  const body = rows
    .map(
      (row) =>
        /*
         * `nowrap` على الطرفين، و`margin-inline-start:auto` يدفع
         * الرقمَ إلى الطرف المقابل.
         *
         * و`space-between` وحده كان يكفي لو ثبت عرضُ الصندوق —
         * وصندوقُ التلميح يقيسه ECharts من محتواه، فيضيق فيلتفّ
         * الاسمُ على الرقم. والمنعُ من اللفّ يجعل الصندوقَ يتّسع
         * للنصّ بدل أن يطويه فوق نفسه.
         */
        `<div style="display:flex;align-items:center;gap:18px;margin-top:5px;white-space:nowrap">
           <span style="display:flex;align-items:center;gap:7px;color:rgba(255,255,255,.7)">
             <span style="width:9px;height:9px;border-radius:2px;background:${row.color};flex:none"></span>
             ${row.label}
           </span>
           <span style="margin-inline-start:auto;font-weight:700;font-variant-numeric:tabular-nums">${formatByUnit(row.value, unit)}</span>
         </div>`,
    )
    .join("");

  return `<div style="direction:rtl;text-align:right">
            <div style="font-weight:700;white-space:nowrap">${title}</div>
            ${body}
          </div>`;
};

interface Params {
  chart: ReportChart;
  /** ارتفاعُ الرقعة — يحدّد كثافةَ الوسوم */
  compact?: boolean;
  /**
   * وضعُ الورقة: حبرٌ داكن على أبيض، وبلا حركة، ووسومٌ ظاهرة.
   *
   * والفرقُ ليس لوناً فقط: الورقةُ لا تُحوَّم عليها. فكلُّ ما تشرحه
   * الشاشةُ بالتلميح يجب أن يكون مكتوباً على الورقة نفسِها — وإلّا
   * خرجت حلقةٌ ملوّنة لا يُعرف ما تمثّله قطاعاتُها.
   */
  print?: boolean;
}

export const buildOption = ({
  chart,
  compact = false,
  print = false,
}: Params) => {
  const horizontal = chart.kind === "horizontalBar";
  const stacked = chart.kind === "stackedBar";
  const isDonut = chart.kind === "donut";

  const ink = print ? "#1f2937" : "rgba(255,255,255,0.75)";
  const faintInk = print ? "#6b7280" : "rgba(255,255,255,0.45)";

  // --------------------------------------------------
  // الحلقة
  // --------------------------------------------------

  if (isDonut) {
    const values = chart.series[0]?.data ?? [];
    const total = values.reduce<number>((sum, v) => sum + (v ?? 0), 0);

    /*
     * وسمُ القطاع خارجَه بخطٍّ يصله به — §46.
     *
     * والحلقةُ بلا هذا لا تُقرأ إلّا بالتحويم، والورقةُ لا تُحوَّم
     * عليها. والوسمُ سطران: الاسمُ ثمّ القيمةُ ونسبتُها — فيُعرف ما
     * يمثّله القطاع وكم هو، بلا رجوعٍ إلى الوسيلة.
     *
     * و`{d}` نسبةٌ تحسبها المكتبة. وحسابُها بيدٍ كان مصدرَ العطب في
     * النسخة الأولى: قسمةٌ على مجموعٍ محسوبٍ في موضعٍ آخر تُنتج
     * زوايا لا تُغلق الدائرة، فيخرج هلالٌ لا حلقة.
     */
    const sliceLabel = (params: { name: string; value: number }) => {
      const share = total > 0 ? Math.round((params.value / total) * 1000) / 10 : 0;

      return `${params.name}\n${formatByUnit(params.value, chart.unit, true)} · ${share}%`;
    };

    return {
      animation: !print,
      backgroundColor: "transparent",

      tooltip: print
        ? { show: false }
        : {
            trigger: "item",
            formatter: (params: {
              name: string;
              value: number;
              percent: number;
              color: string;
            }) =>
              tooltipHtml(
                params.name,
                [
                  {
                    color: params.color,
                    label: `${params.percent}%`,
                    value: params.value,
                  },
                ],
                chart.unit,
              ),
          },

      legend: {
        /*
         * الوسيلةُ أسفلَ الحلقة أفقياً لا إلى جانبها عمودياً.
         *
         * والجانبُ كان يزاحم: عمودٌ من الأسماء يسرقُ ثلثَ العرض ثمّ
         * تخرج منه وسومُ القطاعات إليه فتتقاطعان. والأسفلُ يترك
         * الجانبين للوسوم وخطوطِها.
         *
         * ومفاتيحُها تُنقر لإطفاء القطاعات — §6.
         */
        type: "scroll",
        orient: "horizontal",
        bottom: 0,
        left: "center",
        itemWidth: 11,
        itemHeight: 11,
        itemGap: 18,
        textStyle: { color: ink, fontSize: 11, padding: LEGEND_TEXT_PAD },
        formatter: (name: string) => {
          const index = chart.categories.indexOf(name);

          return `${name} — ${formatByUnit(values[index] ?? 0, chart.unit, true)}`;
        },
      },

      series: [
        {
          type: "pie",
          /* الحلقةُ لا القرص: الفراغُ الأوسط يريح العين من كتلةٍ صمّاء */
          radius: ["42%", "60%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,

          itemStyle: {
            borderColor: print ? "#ffffff" : "#05070d",
            borderWidth: 2,
            borderRadius: 3,
          },

          label: {
            show: true,
            position: "outside",
            color: ink,
            fontSize: print ? 10 : 11,
            lineHeight: print ? 14 : 15,
            formatter: sliceLabel,
          },

          labelLine: {
            show: true,
            length: 12,
            length2: 14,
            smooth: false,
            lineStyle: { color: faintInk, width: 1 },
          },

          /*
           * `hideOverlap` يُسقط الوسمَ المتعارض ولا يزحزحه.
           *
           * والزحزحةُ كانت تدفع وسمَ قطاعٍ ضئيلٍ فوق وسمِ جاره فيُقرأ
           * الاسمُ لأحدهما والرقمُ للآخر — وهو أسوأُ من غيابه. ومَن
           * سقط وسمُه تبقى قيمتُه في الوسيلة أسفلَ الرسم.
           */
          labelLayout: { hideOverlap: true },

          emphasis: {
            label: { fontWeight: 700, fontSize: print ? 10 : 12 },
            itemStyle: { shadowBlur: 12, shadowColor: "rgba(0,0,0,.35)" },
          },

          data: chart.categories.map((name, index) => ({
            name,
            value: values[index] ?? 0,
            itemStyle: { color: categoryColor(name, index) },
          })),
        },
      ],
    };
  }

  // --------------------------------------------------
  // الديكارتية
  // --------------------------------------------------

  const multi = chart.series.length > 1;

  const categoryAxis = {
    type: "category" as const,
    data: chart.categories,
    /*
     * `inverse` على محور الفئات: أوّلُ فئةٍ يميناً كالنصّ العربي.
     *
     * وفي الأعمدة الأفقية العكسُ: محورُ الفئات رأسيّ، وترتيبُه من
     * الأعلى إلى الأسفل صحيحٌ بلا قلب — وقلبُه يضع الأكبرَ أسفلَ
     * القائمة وهو خلافُ ما تتوقّعه العين في ترتيبٍ تنازلي.
     */
    inverse: !horizontal,
    axisLine: { lineStyle: { color: print ? "#cbd5e1" : undefined } },
    axisLabel: {
      color: print ? ink : undefined,
      fontSize: print ? 10 : 11,
      interval: compact ? "auto" : 0,
      rotate: !horizontal && chart.categories.length > 8 ? 30 : 0,
      formatter: (value: string) =>
        value.length > 14 ? `${value.slice(0, 13)}…` : value,
    },
  };

  const valueAxis = {
    type: "value" as const,
    axisLabel: {
      color: print ? faintInk : undefined,
      fontSize: print ? 10 : 11,
      formatter: axisFormatter(chart.unit),
    },
    splitLine: { lineStyle: { color: print ? "#e5e7eb" : undefined } },
  };

  return {
    animation: !print,
    backgroundColor: "transparent",

    grid: {
      top: multi ? 34 : 16,
      right: horizontal ? 24 : 12,
      bottom: horizontal ? 24 : 34,
      /* متّسعٌ لوسوم الفئات الأفقية — أسماءُ المواد تطول */
      left: horizontal ? 96 : 52,
      containLabel: false,
    },

    tooltip: print
      ? { show: false }
      : {
          trigger: "axis",
          axisPointer: { type: chart.kind === "line" ? "line" : "shadow" },
          formatter: (
            params: {
              axisValue: string;
              seriesName: string;
              value: number;
              color: string;
            }[],
          ) =>
            tooltipHtml(
              params[0]?.axisValue ?? "",
              params.map((point) => ({
                color: point.color,
                label: point.seriesName,
                value: point.value ?? null,
              })),
              chart.unit,
            ),
        },

    /*
     * الوسيلةُ تظهر متى تعدّدت السلاسل — §6.
     *
     * ومفاتيحُها قابلةٌ للنقر في ECharts أصلاً: نقرةٌ تُطفئ السلسلةَ
     * فيُرى الباقي وحده. وهذا ما يجعل رسمَ «المفوتر والمحصَّل
     * والمتبقّي» يُقرأ: تُطفأ سلسلتان فيُدرس منحنى واحد.
     *
     * و`itemGap` واسعٌ عمداً: ثلاثةُ مفاتيحَ متلاصقة تُقرأ سطراً
     * واحداً متّصلاً فلا يُعرف أينَ ينتهي مفتاحٌ ويبدأ الذي يليه.
     */
    legend: multi
      ? {
          type: "scroll",
          top: 0,
          right: 0,
          itemWidth: 11,
          itemHeight: 11,
          itemGap: 22,
          textStyle: { color: ink, fontSize: 11, padding: LEGEND_TEXT_PAD },
          data: chart.series.map((series) => series.label),
        }
      : { show: false },

    xAxis: horizontal ? valueAxis : categoryAxis,
    yAxis: horizontal ? categoryAxis : valueAxis,

    series: chart.series.map((series, index) => {
      const color = seriesColor(series.key, index);
      const isLine = chart.kind === "line" || chart.kind === "area";

      return {
        name: series.label,
        type: isLine ? ("line" as const) : ("bar" as const),
        stack: stacked ? "total" : undefined,
        data: series.data,
        itemStyle: {
          color,
          borderRadius: horizontal ? [0, 3, 3, 0] : [3, 3, 0, 0],
        },
        lineStyle: isLine ? { color, width: 2 } : undefined,
        symbol: "circle",
        symbolSize: 5,
        smooth: false,

        /*
         * على الورق: القيمةُ مكتوبةٌ فوق النقطة.
         *
         * والشاشةُ تُحوَّم عليها فيكفيها التلميح، والورقةُ لا. لكنّ
         * الكتابةَ لا تصلح لكلّ رسم: عشرون عموداً بأرقامها تصير
         * سياجاً لا يُقرأ — فتُكتب حيث تتّسع الرقعةُ وحدها،
         * و`hideOverlap` يُسقط ما تبقّى متعارضاً.
         */
        label:
          print && chart.categories.length <= 8 && !stacked
            ? {
                show: true,
                position: horizontal ? "right" : "top",
                color: ink,
                fontSize: 9,
                formatter: (params: { value: number | null }) =>
                  params.value === null || params.value === undefined
                    ? ""
                    : formatByUnit(params.value, chart.unit, true),
              }
            : { show: false },
        labelLayout: { hideOverlap: true },

        /*
         * `connectNulls: false` — الفجوةُ تقطع الخطّ.
         *
         * `null` تعني «لا قيمة» لا «صفر»، ووصلُ ما قبلها بما بعدها
         * يرسم انحداراً لم يقع. وهذا افتراضُ ECharts أصلاً، ويُكتب
         * صراحةً لأنّه قرارٌ يُراجَع لا سهوٌ يُترك.
         */
        connectNulls: false,
        areaStyle:
          chart.kind === "area" ? { opacity: print ? 0.1 : 0.14, color } : undefined,
        barMaxWidth: stacked ? 34 : 22,
        emphasis: { focus: "series" as const },
      };
    }),
  };
};
