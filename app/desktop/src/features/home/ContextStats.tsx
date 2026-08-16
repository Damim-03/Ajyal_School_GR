import { AnimatePresence, motion } from "motion/react";
import { MOTION } from "../../motion/system";
import { choreography as chor } from "../../motion/spatial";
import { useModuleStats } from "./home.stats";

/**
 * حالة القسم وأرقامه ونشاطه — **ثلاث طبقات كشف لا كتلة واحدة**.
 *
 * كانت الثلاثة تصل بتأخير واحد، أي أنّ «921 منتجاً منتهي الصلاحية» يبلغ
 * العين في اللحظة نفسها التي تبلغها فيها أرقامٌ لا تستدعي تصرّفاً. الآن
 * الحالة تسبق (‏④) لأنها الحكم السريع، ثم الأرقام (‏⑤)، ثم النشاط (‏⑥) —
 * وهو تفصيلٌ لمن أراد أن يتابع.
 *
 * ملكية الانتقال: منطقة البطل لم تعد تُعيد تركيب هذه الشجرة (زال
 * `key={"d" + focused}` عنها في الفصل الرابع)، فصار `AnimatePresence` هنا
 * هو المالك الفعلي لانتقال «قسم ← قسم» **و**لانتقال «هيكل ← بيانات» عند
 * وصول الشبكة. ولذلك مفاتيحه تحمل معرّف القسم وحالة التحميل معاً.
 *
 * لا رقم مختلَق: الأقسام بلا خادم تُظهر سطراً صريحاً بدل أرقام وهمية.
 * وارتفاع الحاوية محجوز كي لا يقفز ما تحته بين قسم وآخر.
 */
const TONE: Record<string, string> = {
  ok: "rgba(134,239,172,0.9)",
  warn: "rgba(252,211,77,0.9)",
  idle: "rgba(255,255,255,0.45)",
};

export function ContextStats({
  moduleId, accent, statusOnly = false,
}: {
  moduleId: string;
  accent: string;
  /**
   * يقتصر على سطر الحالة.
   *
   * المرحلة الثانية (المعاينة) يجب أن تبقى هادئة: هويّة ووصف وزرّ. الأرقام
   * والنشاط انتقلا إلى منطقة السياق التي تنفتح عند التأكيد — فلا يُثقَل
   * التصفّح بتفصيلٍ لم يطلبه أحد بعد. وسطر الحالة وحده يبقى لأنّه ليس
   * تفصيلاً: هو الإجابة عن «هل هنا ما يستدعيني الآن؟».
   */
  statusOnly?: boolean;
}) {
  const { loading, stats, activity, status } = useModuleStats(moduleId);

  return (
    <div className={statusOnly ? "mt-3 min-h-[18px]" : "mt-4 min-h-[54px]"}>
      {/*
        حالة القسم — مشتقّة من البيانات لا مكتوبة يدوياً: «3 فواتير اليوم»
        أو «5 منتجات تحتاج تموين». تسبق الأرقام لأنها الحكم السريع.
      */}
      {status && (
        <AnimatePresence mode="wait">
          <motion.div
            key={`${moduleId}:${status.text}`}
            className="mb-2.5 flex items-center gap-2 text-[11px] font-bold"
            style={{ color: TONE[status.tone] }}
            initial={{ opacity: 0, y: chor.status.y }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: MOTION.duration.instant } }}
            transition={{ duration: chor.status.duration, delay: chor.status.delay, ease: MOTION.easing.enter }}
          >
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
            {status.text}
          </motion.div>
        </AnimatePresence>
      )}

      {statusOnly ? null : (
      <>
      <AnimatePresence mode="wait">
        <motion.div
          key={`${moduleId}:${loading ? "l" : stats ? "d" : "n"}`}
          className="flex flex-wrap items-start gap-x-8 gap-y-3"
          initial={{ opacity: 0, y: chor.stats.y }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4, transition: { duration: MOTION.duration.instant } }}
          transition={{ duration: chor.stats.duration, delay: chor.stats.delay, ease: MOTION.easing.enter }}
        >
          {loading ? (
            /* هيكل بنفس الأبعاد — لا وميض ولا قفزة تخطيط أثناء الجلب */
            [0, 1, 2].map((i) => (
              <div key={i} className="min-w-[92px]">
                <div className="h-[22px] w-16 rounded bg-white/10" />
                <div className="mt-1.5 h-[11px] w-20 rounded bg-white/[0.06]" />
              </div>
            ))
          ) : stats ? (
            stats.map((s, i) => (
              <motion.div
                key={s.label}
                className="min-w-[92px]"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: chor.stats.duration,
                  delay: chor.stats.delay + i * MOTION.stagger.tight,
                  ease: MOTION.easing.enter,
                }}
              >
                <div className="text-[19px] font-black leading-none tabular-nums" style={{ color: accent }}>
                  {s.value}
                </div>
                <div className="mt-1 text-[11px] font-bold text-white/60">{s.label}</div>
                {s.hint && <div className="text-[10px] text-white/35">{s.hint}</div>}
              </motion.div>
            ))
          ) : (
            <div className="text-[12px] text-white/40">لا توجد بيانات لهذا القسم بعد</div>
          )}
        </motion.div>
      </AnimatePresence>

      {/*
        النشاط الأخير — آخر الفواتير مرتّبةً زمنياً، أو المنتجات الأدنى
        مخزوناً. كلاهما مشتقّ من البيانات القائمة بلا نقطة نهاية جديدة.
        يأتي بعد الأرقام: الرقم حكم سريع، والنشاط تفصيله.
      */}
      <AnimatePresence mode="wait">
        {activity.length > 0 && (
          <motion.ul
            key={`${moduleId}:act`}
            className="mt-3 flex flex-wrap gap-x-6 gap-y-1"
            initial={{ opacity: 0, y: chor.activity.y }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, transition: { duration: MOTION.duration.instant } }}
            transition={{
              duration: chor.activity.duration,
              delay: chor.activity.delay,
              ease: MOTION.easing.enter,
            }}
          >
            {activity.map((a, i) => (
              <motion.li
                key={a.id}
                className="flex items-baseline gap-2 text-[11px]"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: chor.activity.duration,
                  delay: chor.activity.delay + i * MOTION.stagger.tight,
                  ease: MOTION.easing.enter,
                }}
              >
                <span className="font-bold text-white/70">{a.title}</span>
                <span className="text-white/35">{a.meta}</span>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
      </>
      )}
    </div>
  );
}
