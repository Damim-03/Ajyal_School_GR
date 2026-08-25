import { ArrowDown, ArrowUp, Info, Minus } from "lucide-react";
import { useNavigate } from "react-router-dom";

import type { SummaryValue } from "../reports.api";
import { SEMANTIC, changeTone } from "../charts/palette";
import { formatByUnit } from "../charts/scale";

// ======================================================
// بطاقةُ المؤشّر — §5 §34 §70
//
// أربعُ مسؤوليات: الرقم، والمقارنة، والتعريف عند المرور، والتنقيب
// عند النقر.
//
// والرقمُ هو البطل: §76 يطلب «numbers واضحة جداً». فحجمُه أكبرُ
// بمرّتين ونصف من عنوانه، والباقي حوله لا فوقه.
// ======================================================

interface Props {
  metric: SummaryValue;
  /** حجمٌ أكبر لبطاقات الصفّ الأوّل في نظرة العموم */
  emphasis?: boolean;
}

export const MetricCard = ({ metric, emphasis = false }: Props) => {
  const navigate = useNavigate();

  const definition = metric.definition;
  const unit = definition?.unit ?? "count";
  const direction = definition?.direction ?? "neutral";

  const comparison = metric.comparison;

  /*
   * اتّجاهُ اللون يتبع المعنى لا الإشارة — §46.
   *
   * ارتفاعُ الدَّين أحمرُ وارتفاعُ التحصيل أخضر، وكلاهما «ارتفاع».
   * والاعتمادُ على الإشارة وحدها كان سيصبغ انخفاضَ الدَّين أحمرَ
   * وهو خبرٌ سارّ.
   */
  const tone = comparison
    ? changeTone(comparison.absolute, direction)
    : "neutral";

  const ChangeIcon =
    !comparison || comparison.absolute === 0
      ? Minus
      : comparison.absolute > 0
        ? ArrowUp
        : ArrowDown;

  const clickable = Boolean(definition?.drillTo);

  const open = () => {
    if (definition?.drillTo) navigate(definition.drillTo);
  };

  return (
    <article
      className={[
        "group relative rounded-lg border border-white/10 bg-white/[0.03] p-4",
        "transition-colors duration-150",
        clickable ? "cursor-pointer hover:border-white/25" : "",
      ].join(" ")}
      onClick={clickable ? open : undefined}
      onKeyDown={
        clickable
          ? (event) => {
              /* §61: ما يُنقر يُفتح بلوحة المفاتيح أيضاً */
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                open();
              }
            }
          : undefined
      }
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={
        clickable ? `${definition?.label}: افتح التقرير المفصّل` : undefined
      }
    >
      <header className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-xs font-medium text-white/50">
          {definition?.label ?? metric.key}
        </h3>

        {/*
          التعريفُ عند المرور — §70.
          يُرسل من الخادم مع الرقم فلا يُعاد كتابتُه هنا، وتصحيحُ
          تعريفٍ يظهر في كلّ شاشةٍ تعرضه بلا تعديل واجهة.
        */}
        {definition && (
          <span className="relative">
            <Info
              className="size-3.5 shrink-0 text-white/25 transition-colors group-hover:text-white/35"
              aria-hidden
            />
            <span
              role="tooltip"
              className="pointer-events-none absolute left-0 top-5 z-20 hidden w-64 rounded-md border border-white/10 bg-white/[0.03] p-3 text-right text-xs shadow-lg group-hover:block"
            >
              <span className="block text-white/75">
                {definition.description}
              </span>
              <span className="mt-2 block font-mono text-[10px] text-white/35">
                {definition.formula}
              </span>
              {definition.caveat && (
                <span className="mt-2 block border-t border-white/10 pt-2 text-[11px] text-amber-300">
                  {definition.caveat}
                </span>
              )}
            </span>
          </span>
        )}
      </header>

      <p
        className={[
          "font-semibold tabular-nums text-white",
          emphasis ? "text-3xl" : "text-2xl",
        ].join(" ")}
      >
        {formatByUnit(metric.value, unit)}
      </p>

      {/*
        §34: المطلقُ والنسبة معاً.
        والنسبةُ `null` حين كانت الفترةُ السابقة صفراً — فيُعرض
        المطلقُ وحده، لأنّ «+∞%» ليست رقماً يُعرض.
      */}
      {comparison && (
        <p className="mt-1.5 flex items-center gap-1 text-xs">
          <ChangeIcon
            className="size-3"
            style={{ color: SEMANTIC[tone] }}
            aria-hidden
          />
          <span className="tabular-nums" style={{ color: SEMANTIC[tone] }}>
            {comparison.percentage !== null
              ? `${comparison.percentage > 0 ? "+" : ""}${comparison.percentage}%`
              : formatByUnit(comparison.absolute, unit)}
          </span>
          <span className="text-white/35">
            {comparison.percentage !== null
              ? `(${formatByUnit(comparison.absolute, unit)})`
              : "عن فترةٍ بلا قيمة"}
          </span>
        </p>
      )}
    </article>
  );
};

/** §47: هيكلٌ بمقاس البطاقة لا دوّامة في وسط الصفحة */
export const MetricSkeleton = () => (
  <article className="rounded-lg border border-white/10 bg-white/[0.03] p-4">
    <div className="mb-3 h-3 w-20 animate-pulse rounded bg-white/12" />
    <div className="h-7 w-28 animate-pulse rounded bg-white/10" />
  </article>
);

/**
 * شبكةُ البطاقات.
 *
 * `order` يفرض ترتيباً مقصوداً بدل ترتيب المفاتيح: الاستجابةُ كائنٌ
 * وترتيبُ مفاتيحه ليس عقداً. وما لم يُذكر في `order` يُعرض بعده
 * بترتيبه الطبيعي، فإضافةُ مؤشّرٍ في الخادم لا تُخفيه عن الشاشة.
 */
export const MetricGrid = ({
  summary,
  order,
  emphasis,
}: {
  summary: Record<string, SummaryValue>;
  order?: string[];
  emphasis?: string[];
}) => {
  const keys = order
    ? [
        ...order.filter((key) => key in summary),
        ...Object.keys(summary).filter((key) => !order.includes(key)),
      ]
    : Object.keys(summary);

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
      {keys.map((key) => (
        <MetricCard
          key={key}
          metric={summary[key]}
          emphasis={emphasis?.includes(key)}
        />
      ))}
    </div>
  );
};
