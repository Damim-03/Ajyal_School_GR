import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { LabelLayout } from "echarts/features";
import { SVGRenderer } from "echarts/renderers";

// ======================================================
// تهيئةُ ECharts — استيرادٌ مجزّأ لا كامل
//
// `import * as echarts from "echarts"` يجلب المكتبةَ كلَّها: كلَّ
// نوعِ رسمٍ فيها وكلَّ مكوّنٍ — نحو ميغابايتٍ لا يُستعمل عُشرُه.
// والاستيرادُ المجزّأ يأخذ الأنواعَ الثلاثة التي نرسمها والمكوّنات
// الأربعة التي نستعملها.
//
// ------------------------------------------------------
// SVG لا Canvas
// ------------------------------------------------------
//
// وثلاثةُ أسباب:
//
//   1. **الطباعة.** القماشُ يُنقّط بدقّة الشاشة، فيخرج على الورق
//      مشوّشاً. والمتّجهُ يخرج حادّاً على أيّ دقّة — وهو نفسُ سبب
//      اختيار SVG في `Barcode` بالمشروع.
//   2. **`html-to-image`** المستعمَل في المشروع يلتقط DOM، والقماشُ
//      فيه صورةٌ واحدة لا عناصر.
//   3. **التباين والتكبير**: نصوصُ المتّجه تبقى مقروءةً عند تكبير
//      الشاشة، ونصوصُ القماش تتشقّق.
// ======================================================

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  LabelLayout,
  SVGRenderer,
]);

/**
 * سمةُ التطبيق الداكنة.
 *
 * تُسجَّل مرّةً باسمٍ، فتُطبَّق على كلّ رسمٍ بلا تكرار الألوان في كلّ
 * موضع. وتغييرُ لونٍ فيها يمسّ الرسومَ كلَّها.
 */
export const AJYAL_DARK = "ajyal-dark";

echarts.registerTheme(AJYAL_DARK, {
  backgroundColor: "transparent",

  textStyle: {
    fontFamily:
      'var(--font-sans), "Segoe UI", "Tahoma", "Arial", sans-serif',
  },

  title: {
    textStyle: { color: "#ffffff" },
    subtextStyle: { color: "rgba(255,255,255,0.45)" },
  },

  /*
   * ألوانُ السلاسل الافتراضية.
   *
   * ستٌّ لا اثنتا عشرة — §45 يمنع «ألواناً كثيرة». ومَن احتاج أكثر
   * فمشكلتُه في عدد الفئات لا في القائمة.
   */
  color: ["#86efac", "#a5b4fc", "#fbbf24", "#f9a8d4", "#67e8f9", "#c4b5fd"],

  categoryAxis: {
    axisLine: { lineStyle: { color: "rgba(255,255,255,0.18)" } },
    axisTick: { show: false },
    axisLabel: { color: "rgba(255,255,255,0.55)", fontSize: 11 },
    splitLine: { show: false },
  },

  valueAxis: {
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: { color: "rgba(255,255,255,0.45)", fontSize: 11 },
    splitLine: { lineStyle: { color: "rgba(255,255,255,0.07)" } },
  },

  legend: {
    textStyle: { color: "rgba(255,255,255,0.65)", fontSize: 11 },
    /* الوسيلةُ الباهتة = سلسلةٌ مُطفأة بالنقر */
    inactiveColor: "rgba(255,255,255,0.22)",
  },

  tooltip: {
    backgroundColor: "rgba(10,15,26,0.96)",
    borderColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    textStyle: { color: "#ffffff", fontSize: 12 },
    axisPointer: {
      lineStyle: { color: "rgba(255,255,255,0.2)" },
      crossStyle: { color: "rgba(255,255,255,0.2)" },
    },
  },
});

export { echarts };
