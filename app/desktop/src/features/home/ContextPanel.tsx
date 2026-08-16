import { useEffect, useRef } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { MOTION } from "../../motion/system";
import { expansion as ex } from "../../motion/spatial";
import { materialStyle } from "../../motion/materials";
import { useModuleStats } from "./home.stats";
import type { Module } from "./modules";

/**
 * منطقة السياق — **امتداد البطل، لا شاشة أخرى**.
 *
 * ما تحلّه: كان الطريق من البلاطة إلى القسم ثلاث خطوات — تصفّح، معاينة،
 * دخول. أي أنّ المستخدم لا يستطيع أن **يستكشف** وجهةً قبل أن يلتزم بها؛
 * إمّا أن يقرأ سطرين ويدخل، أو يبقى خارجاً. وهذا سلوك مُطلِق تطبيقات، لا
 * سلوك بيئة تشغيل.
 *
 * هذه الطبقة تُدخل المرحلة الناقصة: الرئيسية **تمتدّ إلى أسفل** فتكشف ما
 * داخل القسم — أرقامه ونشاطه وفروعه — والبطل باقٍ فوقها مرساةً، والبلاطة
 * ما زالت مركَّزة. لا انتقال، ولا نافذة، ولا طبقة فوق المشهد.
 *
 * ثلاث قواعد تحكم التنفيذ:
 *
 * ① **تنمو من البطل**: منشأ تحوّلها عند حافّته، وارتفاعها يُستوفى من صفر
 *    (‏`height: auto` في motion) فتدفع ما تحتها بدل أن تُرسم فوقه. لو
 *    ظهرت بشفافية فوق مكانٍ محجوز لكانت لوحةً ظهرت، لا بطلاً انفتح.
 *
 * ② **التركيز ينتقل إليها**: التنقّل يصير رأسياً بين عناصرها. المستخدم لا
 *    يُطلَب منه أن ينقل تركيزه بنفسه.
 *
 * ③ **لا رقم مختلَق**: الأقسام التي لا خادم لها تعرض ما هو صحيح — فروعها
 *    وحالتها — ولا تعرض أرقاماً.
 */

const TONE: Record<string, string> = {
  ok: "rgba(134,239,172,0.9)",
  warn: "rgba(252,211,77,0.9)",
  idle: "rgba(255,255,255,0.45)",
};

/**
 * طبقة داخل التوسّع.
 * لكلٍّ **مدّتها** لا تأخيرها فقط: لو تساوت المدد لتزامنت النهايات مهما
 * تفاوتت البدايات، فيُقرأ الاستقرار دفعةً واحدة — وهو ما يفضح أنّ مصدر
 * الحركة واحد.
 */
function Layer({
  delay, duration, y = 8, children, className,
}: {
  delay: number; duration: number; y?: number; children: React.ReactNode; className?: string;
}) {
  const still = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={still ? { opacity: 0 } : { opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration, delay: still ? 0 : delay, ease: MOTION.easing.enter }}
    >
      {children}
    </motion.div>
  );
}

export function ContextPanel({
  mod, onLaunch, onCollapse, onExitTop,
}: {
  mod: Module;
  onLaunch: (to: string) => void;
  onCollapse: () => void;
  /**
   * السهم العلوي من أوّل فرع — يخرج إلى بوّابة القسم فوق السياق.
   *
   * الحلقة الرأسية كانت **مقطوعة من أعلاها**: التركيز ينتقل إلى الفروع
   * عند الانفتاح، ثم لا سبيل بالأسهم للعودة إلى «ابدأ الآن» — وهو
   * الإجراء الأساسي للشاشة كلّها. كان الوصول إليه بـEscape (فيطوي السياق)
   * أو بـTab وحده. أي أنّ المستخدم يرى الزرّ ولا يبلغه بالطريق الذي
   * أوصله إلى ما تحته.
   */
  onExitTop?: () => void;
}) {
  const { loading, stats, activity, status } = useModuleStats(mod.id);
  const still = useReducedMotion();
  const rootRef = useRef<HTMLDivElement | null>(null);

  /*
   * انتقال التركيز (مرحلة ④): بمجرّد أن ينفتح السياق يصير هو ما يتصفّحه
   * المستخدم. لا يُطلب منه أن ينقل تركيزه بنفسه — وهذا نصّ المواصفة.
   *
   * التأجيل إطاراً واحداً مقصود: العناصر تُركَّب مع بداية استيفاء الارتفاع،
   * وتركيزُ عنصرٍ قبل أن يأخذ موضعه النهائي يجعل المتصفّح يمرّر إليه ثم
   * يمرّر ثانيةً حين يستقرّ.
   */
  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      const root = rootRef.current;
      if (!root) return;
      const first = [...root.querySelectorAll<HTMLElement>("[data-ctx-focus]")]
        .find((el) => !el.hasAttribute("disabled"));
      /*
       * الاحتياط ليس تجميلاً: قسمٌ كلّ فروعه «قريباً» لا يملك عنصراً واحداً
       * قابلاً للتركيز، و`focus()` على زرٍّ معطَّل لا يفعل شيئاً — فيسقط
       * التركيز إلى `body`، فلا تعمل الأسهم ولا Esc داخل السياق ويبقى
       * المستخدم عالقاً بلا مخرج ظاهر. قِستُه فعلاً على «بوابة المنتجات».
       */
      /*
       * `preventScroll` جوهري لا تفصيلي.
       *
       * `focus()` المجرّد يُطلق تمرير المتصفّح الافتراضي إلى العنصر — وهو
       * **فوري وغير قابل للتخفيف**. فتقع قفزةٌ حادّة في منتصف انفتاح
       * الصفحة: المشهد يمتدّ بنعومة ثم يُقتطع فجأةً إلى موضع آخر. مهما دقّ
       * ما تحته من حركة، تلك القفزة وحدها تُفسد اللحظة.
       *
       * نمنع تمرير المتصفّح، ونتولّى النزول بأنفسنا ضمن الإيقاع أدناه.
       */
      (first ?? root).focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(id);
  }, [mod.id]);

  /*
   * النزول إلى ما انفتح — **عند الحاجة فقط، وبقدرها**.
   *
   * ثلاث قواعد تعلّمتُها بالقياس بعد أن أخطأتُ في الأولى:
   *
   * ① لا نزول إن اتّسع المشهد أصلاً. على شاشة عمل حقيقية (‏900px فأعلى)
   *    يظهر البطل والسياق معاً، فالتمرير حينئذ عبثٌ يزيح ما هو مرئي.
   *
   * ② لا نتجاوز ما يُبقي **العنوان** ظاهراً. كان الهدف نسبةً من ارتفاع
   *    العمود، فعلى شاشة قصيرة (‏286px مرئية) دفع العنوان والزرّ خارج
   *    الحاوية تماماً — والمواصفة تمنع تنحية البطل. وقياسي الأول لم يكشفه
   *    لأنّ `getBoundingClientRect` لا يعرف القصّ: العنصر كان «في مكانه»
   *    وغير مرئي.
   *
   * ③ ننزل بقدر ما يقع تحت الحافّة لا أكثر.
   */
  useEffect(() => {
    if (still) return;
    let stop: (() => void) | null = null;
    const t = window.setTimeout(() => {
      const root = rootRef.current;
      const col = root?.closest<HTMLElement>(".overflow-y-auto");
      if (!root || !col) return;

      const colBox = col.getBoundingClientRect();
      const rootBox = root.getBoundingClientRect();

      /* ① ما الذي يقع تحت الحافّة؟ */
      const below = rootBox.bottom - colBox.bottom;
      if (below <= 8) return;

      /*
       * ② أقصى نزول يُبقي العنوان ظاهراً **كاملاً**.
       *
       * الحدّ هو المسافة إلى **قمّته** لا إلى قاعدته: النزول بمقدار قاعدته
       * يُخرجه تماماً من الحاوية — وهو ما فعلتُه أوّلاً فبقي منه 4px من 34.
       * بمقدار قمّته يستقرّ ملاصقاً لأعلى المشهد، ظاهراً بكامله.
       */
      const title = col.querySelector("h1");
      const allowed = title
        ? Math.max(0, title.getBoundingClientRect().top - colBox.top)
        : Infinity;

      const target = Math.min(
        col.scrollTop + Math.min(below + 12, allowed),
        col.scrollHeight - col.clientHeight,
      );
      if (Math.abs(target - col.scrollTop) < 8) return;

      const controls = animate(col.scrollTop, target, {
        duration: MOTION.duration.slow,
        ease: MOTION.easing.enter,
        onUpdate: (v) => { col.scrollTop = v; },
      });
      stop = () => controls.stop();
    }, ex.open.duration * 1000);
    return () => { window.clearTimeout(t); stop?.(); };
  }, [mod.id, still]);

  /*
   * التنقّل صار رأسياً. والأفقي يطوي ويعود إلى تصفّح الأقسام بدل أن
   * يُهمَل: مستخدمٌ ضغط سهماً أفقياً يريد قسماً آخر، وابتلاعُ الضغطة
   * يجعله يظنّ الواجهة معطّلة.
   */
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); onCollapse(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
    e.preventDefault();
    e.stopPropagation();
    const items = [...(rootRef.current?.querySelectorAll<HTMLElement>("[data-ctx-focus]") ?? [])]
      .filter((el) => !el.hasAttribute("disabled"));
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    /*
     * أعلى القائمة ليس حائطاً — البوّابة فوقها.
     * كان `Math.max(0, next)` يكبح السهم عند أوّل فرع فلا يحدث شيء، وهي
     * أسوأ استجابة ممكنة: المستخدم يضغط ويظنّ الواجهة معطّلة.
     */
    if (e.key === "ArrowUp" && at <= 0 && onExitTop) {
      onExitTop();
      return;
    }
    const next = e.key === "ArrowDown" ? at + 1 : at - 1;
    const target = items[Math.min(items.length - 1, Math.max(0, next))];
    if (!target) return;
    /*
      نفس مبدأ الفتح: نمنع تمرير المتصفّح الفوري ثم نُمرّر بأنفسنا بنعومة.
      و`block: "nearest"` يعني ألّا يتحرّك المشهد أصلاً ما دام العنصر مرئياً
      — فالتنقّل بين فرعين متجاورين لا يزحزح شيئاً.
    */
    target.focus({ preventScroll: true });
    target.scrollIntoView({ behavior: still ? "auto" : "smooth", block: "nearest" });
  };

  const quick = mod.actions;

  return (
    <motion.div
      ref={rootRef}
      onKeyDown={onKeyDown}
      /* يستقبل التركيز حين لا يوجد فرعٌ نشط — كي لا تُفقَد لوحة المفاتيح. */
      tabIndex={-1}
      className="overflow-hidden outline-none"
      /*
       * الارتفاع يُستوفى من صفر: الرئيسية **تمتدّ**، فيدفع السياقُ ما تحته
       * بدل أن يُرسم فوقه. هذا وحده ما يفصل «البطل انفتح» عن «لوحة ظهرت».
       */
      initial={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
      animate={still ? { opacity: 1 } : { height: "auto", opacity: 1 }}
      exit={still ? { opacity: 0 } : { height: 0, opacity: 0 }}
      transition={{ duration: ex.open.duration, delay: ex.open.delay, ease: MOTION.easing.enter }}
      style={{ transformOrigin: "100% 0%" }}
    >
      {/*
        **امتداد صفحة لا صندوق.**

        كان هنا `rounded-2xl border p-5` وخلفية خاصّة — أي بطاقةٌ تُرسم فوق
        الصفحة. ومهما نعُم انفتاحها تبقى تُقرأ «مكوّناً ظهر»، وهو بالضبط ما
        ترفضه المواصفة. الآن لا حدّ ولا استدارة ولا خلفية: خيطٌ أفقي واحد
        يتلاشى عند طرفيه — كفاصل فقرة في مستند، لا كإطار لصندوق. الفضاء
        نفسه هو ما اتّسع.
      */}
      {/*
        المتنفَّس السفلي يعيش هنا لا في العمود الحاوي.

        كان حشواً يُضاف إلى الحاوية لحظة الفتح (‏pb-8 ← pb-16)، أي مسافةً
        تظهر دفعةً واحدة. وهو الآن داخل الجسم الذي يُستوفى ارتفاعه من صفر،
        فينمو معه بدل أن يُقحَم عليه — والحافّة السفلى تصير جزءاً ممّا
        انفتح لا أثراً لتبدّل حاوية.
      */}
      <div className="pt-5 pb-10">
        <div
          className="mb-5 h-px w-full"
          style={{ background: `linear-gradient(to left, transparent, ${mod.accent}4d 18%, ${mod.accent}26 62%, transparent)` }}
        />
        {/* ① الحالة — الحكم السريع قبل أي رقم */}
        {status && (
          <Layer delay={ex.status.delay} duration={ex.status.duration} y={ex.status.y} className="mb-4">
            <div className="flex items-center gap-2 text-[12px] font-bold" style={{ color: TONE[status.tone] }}>
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "currentColor" }} />
              {status.text}
            </div>
          </Layer>
        )}

        {/* ② الأرقام */}
        <Layer delay={ex.stats.delay} duration={ex.stats.duration} y={ex.stats.y}>
          <div className="flex flex-wrap items-start gap-x-9 gap-y-4">
            {loading
              ? [0, 1, 2].map((i) => (
                  <div key={i} className="min-w-[96px]">
                    <div className="h-[24px] w-16 rounded bg-white/10" />
                    <div className="mt-1.5 h-[11px] w-20 rounded bg-white/[0.06]" />
                  </div>
                ))
              : stats
                ? stats.map((s) => (
                    <div key={s.label} className="min-w-[96px]">
                      <div className="text-[21px] font-black leading-none tabular-nums" style={{ color: mod.accent }}>
                        {s.value}
                      </div>
                      <div className="mt-1 text-[11px] font-bold text-white/60">{s.label}</div>
                      {s.hint && <div className="text-[10px] text-white/35">{s.hint}</div>}
                    </div>
                  ))
                : <div className="text-[12px] text-white/40">لا توجد بيانات لهذا القسم بعد</div>}
          </div>
        </Layer>

        {/* ③ النشاط الأخير */}
        {activity.length > 0 && (
          <Layer delay={ex.activity.delay} duration={ex.activity.duration} y={ex.activity.y} className="mt-5">
            <div className="mb-2 text-[11px] font-bold text-white/40">النشاط الأخير</div>
            <ul className="flex flex-col gap-1.5">
              {activity.map((a) => (
                <li key={a.id} className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-1.5 text-[12px] last:border-0">
                  <span className="font-bold text-white/75">{a.title}</span>
                  <span className="text-white/40">{a.meta}</span>
                </li>
              ))}
            </ul>
          </Layer>
        )}

        {/*
          ⑥⑦ الفروع — **مجموعاتٍ لا دفعةً واحدة**.

          كانت تصل كلّها بتأخير واحد، فتُقرأ صفّاً وُضع دفعةً — وهذا معيار
          رفض صريح. الآن تُكشف صفوفاً من بطاقتين: بين المجموعة والأخرى
          70ms، وداخل المجموعة 45ms. فيهبط النظر صفّاً صفّاً بدل أن يواجه
          الكتلة كاملةً.
        */}
        <div className="mt-5">
          <Layer delay={ex.group.delay} duration={ex.group.duration} y={ex.group.y}>
            <div className="mb-2 text-[11px] font-bold text-white/40">فروع القسم</div>
          </Layer>
          <div className="flex flex-wrap gap-2.5">
            {quick.length === 0 && (
              <Layer delay={ex.group.delay} duration={ex.group.duration} y={ex.group.y}>
                <span className="text-[12px] text-white/40">لا توجد فروع في هذا القسم بعد</span>
              </Layer>
            )}
            {quick.map((a, n) => {
              const group = Math.floor(n / ex.groupSize);
              const within = n % ex.groupSize;
              return (
                <motion.button
                  key={a.label}
                  data-ctx-focus
                  disabled={a.soon || !a.to}
                  onClick={() => a.to && onLaunch(a.to)}
                  className="flex min-w-[190px] flex-1 items-center gap-3 rounded-xl p-3 text-right outline-none transition hover:brightness-110 focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ ...materialStyle("glass"), ["--tw-ring-color" as string]: mod.accent }}
                  /*
                    محورٌ واحد لا ثلاثة.
                    كانت كل بطاقة تتحرّك بأربع خصائص معاً (شفافية وإزاحتان
                    وانكماش) — ثلاث بطاقات في اللحظة التي يُعاد فيها توازن
                    البطل ويرتفع الصفّ وتتّسع البيئة. ستّ حركات متزامنة على
                    ثلاثة مستويات، فلا يبقى قائدٌ بصريّ واحد.
                    الإزاحة الرأسية وحدها تكفي، وهي **باتجاه انفتاح الصفحة
                    نفسه**: تتبع البطاقاتُ الجسمَ الذي وُلدت منه بدل أن
                    تُعلن وصولها بحركةٍ خاصّة.
                  */
                  initial={still ? { opacity: 0 } : { opacity: 0, y: ex.group.y }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: ex.group.duration + within * 0.02,
                    delay: still ? 0 : ex.group.delay + group * ex.group.between + within * ex.group.within,
                    ease: MOTION.easing.enter,
                  }}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg" style={{ background: `${mod.accent}22` }}>
                    <a.icon aria-hidden className="h-5 w-5" style={{ color: mod.accent }} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-bold">{a.label}</span>
                    <span className="block truncate text-[11px] text-white/50">{a.hint}</span>
                  </span>
                  {a.soon && <span className="ms-auto text-[10px] font-bold text-white/45">قريباً</span>}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* ⑤ الثانوي — كيف يخرج منها */}
        <Layer delay={ex.secondary.delay} duration={ex.secondary.duration} y={ex.secondary.y} className="mt-4">
          <div className="text-[11px] text-white/30">
            ↑ ↓ للتنقّل داخل القسم · Esc للعودة إلى التصفّح · «ابدأ الآن» للدخول
          </div>
        </Layer>
      </div>
    </motion.div>
  );
}
