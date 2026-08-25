import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import type { ReportChart } from "../reports.api";
import { buildOption } from "./buildOption";
import { AJYAL_DARK, echarts } from "./echarts-setup";

// ======================================================
// عارضُ الرسم — نقطةُ الدخول الوحيدة
//
// كلُّ رسمٍ في التطبيق يمرّ من هنا، فتغييرُ طريقة الرسم تعديلُ
// ملفّين: هذا و`buildOption`. والبقيّةُ تُمرِّر `ReportChart` ولا
// تعرف كيف يُرسم.
//
// وقد استُبدلت الطريقةُ فعلاً: كانت SVG مكتوبةً بيدٍ فصارت
// ECharts — ولم يتغيّر سطرٌ واحد في أيّ شاشة. وهذا ما كان الفصلُ
// خلف العقد يشتريه.
// ======================================================

interface Props {
  chart: ReportChart;
  height?: number;
}

export const ReportChartView = ({ chart, height = 280 }: Props) => {
  const navigate = useNavigate();
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!host.current || chart.isEmpty) return;

    const created = echarts.init(host.current, AJYAL_DARK, {
      renderer: "svg",
    });

    instance.current = created;

    /*
     * إعادةُ القياس عند تغيّر الحاوية.
     *
     * و`ResizeObserver` لا حدثُ النافذة: الرسمُ داخل شبكةٍ تتغيّر
     * أعمدتُها عند فتح المرشّحات المتقدّمة أو ظهور شريط الشرائح —
     * والنافذةُ لم تتغيّر، فلا يُطلق حدثُها ويبقى الرسمُ بمقاسٍ
     * قديم داخل صندوقٍ جديد.
     */
    const element = host.current;
    const observer = new ResizeObserver(() => created.resize());

    observer.observe(element);

    return () => {
      observer.disconnect();
      created.dispose();
      instance.current = null;
    };
  }, [chart.isEmpty]);

  useEffect(() => {
    const created = instance.current;

    if (!created || chart.isEmpty) return;

    /*
     * `notMerge: true` عند تبديل البيانات.
     *
     * والدمجُ الافتراضي يُبقي سلاسلَ الرسم السابق حين يقلّ عددُها:
     * تقريرٌ بثلاث سلاسل يُفلتر فيصير سلسلتين، وتبقى الثالثةُ
     * مرسومةً ببياناتها القديمة.
     */
    created.setOption(buildOption({ chart }), { notMerge: true });

    if (!chart.drill) return;

    /*
     * التنقيب — §40.
     *
     * النقرُ على عمودٍ أو قطاعٍ يفتح التقريرَ الوجهةَ بالفلتر
     * مطبَّقاً. والمعرّفُ من `categoryIds` لا من الوسم المعروض:
     * الوسمُ اسمٌ قد يتكرّر، والمعرّفُ لا.
     */
    const onClick = (params: unknown) => {
      const index = (params as { dataIndex?: number })?.dataIndex;

      if (index === undefined || !chart.drill) return;

      const id = chart.drill.categoryIds[index];

      if (!id) return;

      navigate(
        `${chart.drill.to}?${chart.drill.param}=${encodeURIComponent(id)}`,
      );
    };

    created.on("click", onClick);

    return () => {
      created.off("click", onClick);
    };
  }, [chart, navigate]);

  /*
   * §48: الفراغُ حالةٌ تُشرح لا رسمٌ فارغ.
   *
   * والرسالةُ تقول ما الذي لم يوجد، لا «لا بيانات» مجرّدةً — عبارةٌ
   * تترك المستخدمَ يسأل: أخطأتُ في الفلتر أم النظامُ معطوب؟
   */
  if (chart.isEmpty) {
    return (
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <h3 className="mb-1 text-sm font-black text-white">{chart.title}</h3>
        <div
          className="flex flex-col items-center justify-center gap-1 text-center"
          style={{ height }}
        >
          <p className="text-sm text-white/45">
            لا بيانات في هذه الفترة لرسم «{chart.title}».
          </p>
          <p className="text-xs text-white/25">
            جرّب توسيع المدى أو إزالة بعض الفلاتر.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <header className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-black text-white">{chart.title}</h3>

        {chart.series.length > 1 && (
          <span className="text-[11px] text-white/30">
            اضغط مفتاح السلسلة لإخفائها
          </span>
        )}
      </header>

      <div ref={host} style={{ height, width: "100%" }} />

      {chart.drill && (
        <p className="mt-1.5 text-[11px] text-white/25">
          اضغط على أيّ جزء لفتح التقرير المفصّل بالفلتر مطبَّقاً
        </p>
      )}
    </section>
  );
};

/**
 * هيكلُ تحميلٍ بمقاس الرسم — §47.
 *
 * §47 يمنع «spinner واحد في منتصف الصفحة» ويطلب هيكلاً لكلّ قسم.
 * والمقاسُ مطابقٌ للرسم عمداً: هيكلٌ أقصرُ يجعل الصفحةَ تقفز حين
 * تصل البيانات، وهي قفزةٌ تُفقد القارئَ موضعَه.
 */
export const ChartSkeleton = ({ height = 280 }: { height?: number }) => (
  <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
    <div className="mb-3 h-4 w-40 animate-pulse rounded bg-white/10" />
    <div className="animate-pulse rounded-xl bg-white/5" style={{ height }} />
  </section>
);
