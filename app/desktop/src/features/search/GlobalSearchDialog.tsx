import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CircleAlert, GraduationCap, Loader2, ScanLine, Search, UserCog, X,
} from "lucide-react";

import { MotionDialog } from "../../motion/MotionDialog";
import { uiSound } from "../../lib/ui-sound";
import { moduleById } from "../home/modules";
import { listStudents, type Student } from "../../modules/students/student.api";
import { listTeachers, type TeacherRow } from "../../modules/teachers/teachers.api";
import { NOT_FOUND, resolveScan } from "../../modules/reports/scan-target";
import { PATHS } from "../../routes/paths";
import { searchDestinations } from "./match";
import type { Destination } from "./destinations";

/**
 * **البحثُ العامّ — حقلان: ما يُكتب، وما يُمسح.**
 *
 * حلَّ محلَّ زرّ «الإعدادات» في الشريط العلوي. والزرُّ كان يفعل ما تفعله
 * بلاطةُ الإعدادات في الصفّ تحته بالضبط — أي أنّه يشغل أثمنَ موضعٍ في
 * الشاشة بطريقٍ ثانٍ إلى وجهةٍ لها طريقُها.
 *
 * ## الحقلان
 *
 * **①  ما يُكتب.** يبحث في وجهات التطبيق كلِّها (‏`destinations.ts`،
 * وهي مشتقّةٌ من سجلّات النظام لا مكتوبةٌ بيد) وفي الطلبة والأساتذة عبر
 * الخادم. فتُفتح الشاشةُ أو يُفتح ملفُّ الشخص مباشرةً.
 *
 * **②  ما يُمسح.** حقلٌ ثانٍ يستقبل الباركود ويحلُّه إلى وجهته عبر
 * `resolveScan` — وهي الدالّةُ نفسُها التي يستعملها ماسحُ التقارير، لا
 * نسخةٌ منها. فورقةُ كشفٍ على الطاولة تُمسح فتُفتح شاشتُها بفترتها
 * وفلاترها.
 *
 * ## ولماذا حقلٌ ثانٍ لا نافذةٌ ثانية
 *
 * `BarcodeScanner` القائم يفتح `MotionDialog` خاصّاً به. وفتحُه من داخل
 * هذه النافذة يعني حبسَ تركيزٍ داخل حبسِ تركيز — و`Escape` عندها لا
 * يُعرف أيَّهما يُغلق. فالمسحُ هنا حقلٌ في النافذة نفسِها.
 *
 * ## والقارئ لوحةُ مفاتيح
 *
 * ولذلك يُنقل التركيزُ إلى حقل المسح فورَ فتحه: الماسحُ لا ينتظر، يُرسل
 * حروفَه إلى حيث وقع التركيز — فإن كان في حقل البحث ذهب الرمزُ إليه
 * وبُحث عنه شاشةً. وهو أيضاً سببُ الإرسال التلقائي عند `Enter`: كلُّ
 * قارئٍ يُذيّل مسحتَه به.
 */

/** ما يُعرض في القائمة — وجهةٌ ثابتة أو شخصٌ من الخادم. */
type Hit =
  | { kind: "destination"; key: string; item: Destination }
  | { kind: "student"; key: string; item: Student }
  | { kind: "teacher"; key: string; item: TeacherRow };

const MIN_QUERY = 2;
/** الخادمُ لا يُسأل مع كلّ حرف. */
const DEBOUNCE_MS = 260;

export function GlobalSearchDialog({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();

  const [query, setQuery] = useState("");

  /**
   * **نتيجةُ الخادم تحمل معها الاستعلامَ الذي وُلدت منه.**
   *
   * ولا عَلَمَ `seeking` مستقلّاً ولا تفريغَ للنتائج عند كلّ حرف: كلاهما
   * كان `setState` داخل جسم أثر — أي عرضٌ ثانٍ يتلو الأوّل بلا سبب،
   * وحالتان يجب أن تبقيا متّسقتين يدوياً. وأخطرُ ما في ذلك أنّ نتيجةَ
   * استعلامٍ سابق قد تصل بعد أن تبدّل ما في الحقل، فتُعرض تحت كلماتٍ
   * لا تخصّها.
   *
   * وباقترانها باستعلامها يُشتقّ الأمران أدناه بمقارنةٍ واحدة: ما لا
   * يطابق الحقلَ الجاري لا يُعرض، وعدمُ المطابقة **هو** معنى «يبحث».
   */
  const [result, setResult] = useState<{ term: string; hits: Hit[]; failed?: boolean }>({
    term: "",
    hits: [],
  });

  /** الحقلُ الثاني — لا يُعرض حتى يُطلب، فلا يزاحم الأوّل. */
  const [scanning, setScanning] = useState(false);
  const [code, setCode] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [active, setActive] = useState(0);

  const searchRef = useRef<HTMLInputElement>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  /** أقصرُ من ذلك لا يُسأل عنه الخادم — كلُّ الأسماء تطابقه. */
  const ready = term.length >= MIN_QUERY;

  /*
   * التركيزُ على حقل البحث لا على زرّ الإغلاق.
   *
   * `MotionDialog` يضع التركيزَ على أوّل عنصرٍ قابلٍ له حبساً للتنقّل،
   * وأوّلُه زرُّ الإغلاق. وتأثيرُه يسبق هذا في شجرة React فيغلبه ما
   * يُكتب هنا.
   */
  useEffect(() => {
    searchRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (scanning) codeRef.current?.focus({ preventScroll: true });
  }, [scanning]);

  /** الوجهاتُ محلّية — تُحسب في اللحظة نفسِها بلا انتظار. */
  const destinations = useMemo<Hit[]>(
    () =>
      searchDestinations(query).map((d) => ({
        kind: "destination" as const,
        key: d.id,
        item: d,
      })),
    [query],
  );

  /* والأشخاصُ من الخادم — بمهلةٍ وبإلغاءٍ لما فات. */
  useEffect(() => {
    if (!ready) return;

    let alive = true;

    const timer = window.setTimeout(async () => {
      /*
       * الطلبةُ والأساتذةُ معاً لا بالتتابع: نداءان مستقلّان لا يعتمد
       * أحدهما على الآخر، وتتابعُهما يضاعف الانتظار بلا سبب.
       */
      const [students, teachers] = await Promise.all([
        listStudents({ search: term, limit: 5 }).catch(() => null),
        listTeachers({ search: term, limit: 5 }).catch(() => null),
      ]);

      /*
       * والكتابةُ تقع ولو خابا معاً: `term` هو ما يُنهي حالةَ «يبحث»،
       * فلو تُرك بلا كتابةٍ عند الفشل لبقيت الدوّامةُ تدور إلى الأبد على
       * انقطاعٍ في الشبكة.
       */
      if (!alive) return;

      setResult({
        term,
        /*
         * سقوطُ الطرفين معاً ليس «لا نتيجة».
         *
         * كان الفشلُ يُقرأ فراغاً، فيظنّ الموظّفُ أنّ الطالبَ غيرُ
         * مسجَّل وهو مسجَّل. والشاشاتُ تُخبر بما جرى لا بما يشبهه.
         */
        failed: students === null && teachers === null,
        hits: [
          ...(students?.students ?? []).map((s) => ({
            kind: "student" as const,
            key: `student:${s.id}`,
            item: s,
          })),
          ...(teachers?.teachers ?? []).map((t) => ({
            kind: "teacher" as const,
            key: `teacher:${t.id}`,
            item: t,
          })),
        ],
      });
    }, DEBOUNCE_MS);

    return () => {
      alive = false;
      window.clearTimeout(timer);
    };
  }, [term, ready]);

  /** نتيجةُ **هذا** الاستعلام وحده — وما عداها لم يصل بعد. */
  const settled = ready && result.term === term;
  const seeking = ready && !settled;

  /*
   * الدمجُ داخل `useMemo` لا خارجه.
   *
   * `[...] : []` تُنشئ مصفوفةً جديدة في كلّ عرض، فتصير تبعيةً تتغيّر
   * دائماً ويسقط الحفظُ من أصله. والقراءةُ من `result` مباشرةً تُبقي
   * التبعياتِ ثلاثَ قيمٍ مستقرّة.
   */
  const hits = useMemo(
    () => (settled ? [...destinations, ...result.hits] : destinations),
    [destinations, settled, result.hits],
  );

  /**
   * الاختيارُ مكبوحٌ عند القراءة لا مُصفَّرٌ في أثر.
   *
   * تصفيرُه كان `setState` داخل أثرٍ يتبع الاستعلام — عرضٌ ثانٍ في كلّ
   * ضغطة مفتاح. وهو أيضاً غيرُ كافٍ: النتائجُ تنقص بعد وصول ردّ الخادم
   * فيصير المؤشّرُ خارج القائمة قبل أن يفرغ الأثر.
   *
   * والكبحُ عند القراءة يعالج الأمرين، والتصفيرُ يقع حيث يقع سببُه —
   * في يد المستخدم وهو يكتب.
   */
  const activeIndex = Math.min(active, Math.max(0, hits.length - 1));

  const go = useCallback(
    (to: string) => {
      uiSound("confirm");
      onClose();
      navigate(to);
    },
    [navigate, onClose],
  );

  const open = useCallback(
    (hit: Hit) => {
      if (hit.kind === "destination") return go(hit.item.to);
      if (hit.kind === "student") return go(PATHS.studentDetail(hit.item.id));

      return go(PATHS.teacherDetail(hit.item.id));
    },
    [go],
  );

  /** المسح: يُحلّ الرمزُ ثمّ يُفتح ما يدلّ عليه. */
  const submitCode = async () => {
    const raw = code.trim();
    if (!raw || scanBusy) return;

    setScanBusy(true);
    setScanError(null);

    try {
      const target = await resolveScan(raw);

      if (!target) {
        /*
         * فشلٌ: الرسالة، ثمّ الحقل **فارغٌ** جاهزٌ لمسحةٍ ثانية.
         *
         * ولا يُكتفى بتحديد ما فيه: القارئ قد يُرسل حرفاً زائداً أو
         * يُقاطَع، فيلتصق الجديدُ بالقديم ويخرج رمزٌ لا وجود له —
         * والمستخدم يرى فشلاً ثانياً ولا يعرف أنّ الحقل هو السبب.
         */
        uiSound("error");
        setScanError(NOT_FOUND);
        setCode("");
        codeRef.current?.focus({ preventScroll: true });
        return;
      }

      go(target.to);
    } finally {
      setScanBusy(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!hits.length) return;

      uiSound("focus");
      /* يُبنى على المكبوح لا على المخزَّن: هو ما يراه المستخدم. */
      const next = activeIndex + (e.key === "ArrowDown" ? 1 : -1);
      setActive(Math.min(hits.length - 1, Math.max(0, next)));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const hit = hits[activeIndex];
      if (hit) open(hit);
    }
  };

  return (
    <MotionDialog onClose={onClose} labelledBy="global-search-title">
      <div className="flex w-[min(92vw,640px)] flex-col">
        {/* ===== الترويسة ===== */}
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <Search aria-hidden className="h-5 w-5 shrink-0 text-white/45" />
          <h2 id="global-search-title" className="flex-1 text-sm font-black text-white/85">
            البحث في التطبيق
          </h2>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق"
            className="rounded-lg p-1.5 text-white/45 transition hover:bg-white/10 hover:text-white/80"
          >
            <X aria-hidden className="h-4 w-4" />
          </button>
        </div>

        {/* ===== ① حقلُ البحث ===== */}
        <div className="px-5 pt-4">
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              /* استعلامٌ جديد ⇒ المؤشّرُ إلى أعلى القائمة. */
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="اكتب اسم شاشة، أو طالب، أو أستاذ…"
            className="w-full rounded-xl border border-white/12 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-white/30 focus:border-white/35"
          />
        </div>

        {/* ===== ② حقلُ المسح ===== */}
        <div className="px-5 pt-3">
          {!scanning ? (
            <button
              type="button"
              onClick={() => {
                uiSound("openLayer");
                setScanning(true);
              }}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/12 bg-white/[0.03] py-2.5 text-xs font-black text-white/60 transition hover:border-white/25 hover:text-white/90"
            >
              <ScanLine aria-hidden className="h-4 w-4" />
              مسح كود بار
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <ScanLine aria-hidden className="h-4 w-4 shrink-0 text-emerald-300/80" />
                <input
                  ref={codeRef}
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setScanError(null);
                  }}
                  onKeyDown={(e) => {
                    /*
                      لا تصل هذه المفاتيحُ إلى قائمة النتائج: القارئ يُذيّل
                      مسحتَه بـEnter، ولو مرّ لفُتحت أوّلُ نتيجةٍ في القائمة
                      بدل الرمز الممسوح.
                    */
                    e.stopPropagation();
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void submitCode();
                    }
                  }}
                  placeholder="امسح الباركود، أو اكتب الرمز…"
                  className="w-full rounded-xl border border-emerald-300/25 bg-emerald-300/[0.06] px-4 py-2.5 text-sm tabular-nums text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300/50"
                />
                {scanBusy && <Loader2 aria-hidden className="h-4 w-4 shrink-0 animate-spin text-white/50" />}
              </div>

              {scanError && (
                <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-rose-300/85">
                  <CircleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                  {scanError}
                </p>
              )}

              <p className="text-[11px] text-white/35">
                وجّه القارئ إلى الباركود المطبوع — تُفتح شاشتُه مباشرةً.
              </p>
            </div>
          )}
        </div>

        {/* ===== النتائج ===== */}
        <div className="mt-3 max-h-[46vh] overflow-y-auto px-3 pb-3">
          {query.trim().length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-white/35">
              كلُّ شاشات النظام وطلبتُه وأساتذتُه — اكتب حرفين فأكثر.
            </p>
          ) : hits.length === 0 && !seeking ? (
            <p className="px-2 py-6 text-center text-xs text-white/35">
              {settled && result.failed
                ? "تعذّر البحث — الخادم لم يستجب لهذا الطلب."
                : "لا نتيجة لهذا البحث."}
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {hits.map((hit, i) => (
                <ResultRow
                  key={hit.key}
                  hit={hit}
                  active={i === activeIndex}
                  onPick={() => open(hit)}
                  onHover={() => setActive(i)}
                />
              ))}
            </ul>
          )}

          {seeking && (
            <p className="flex items-center justify-center gap-2 py-2 text-[11px] text-white/35">
              <Loader2 aria-hidden className="h-3 w-3 animate-spin" />
              يبحث في الطلبة والأساتذة…
            </p>
          )}
        </div>
      </div>
    </MotionDialog>
  );
}

function ResultRow({
  hit,
  active,
  onPick,
  onHover,
}: {
  hit: Hit;
  active: boolean;
  onPick: () => void;
  onHover: () => void;
}) {
  const accent =
    hit.kind === "destination" ? moduleById(hit.item.moduleId)?.accent : undefined;

  const title =
    hit.kind === "destination"
      ? hit.item.title
      : `${hit.item.firstName} ${hit.item.lastName}`.trim();

  const detail =
    hit.kind === "destination"
      ? hit.item.detail
      : hit.kind === "student"
        ? `طالب · ${hit.item.studentNumber}`
        : hit.item.specialization ?? "أستاذ";

  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        onPointerEnter={onHover}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-start transition ${
          active ? "bg-white/10" : "hover:bg-white/[0.06]"
        }`}
      >
        <span
          aria-hidden
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{
            background: accent ? `${accent}1f` : "rgba(255,255,255,0.07)",
            color: accent ?? "rgba(255,255,255,0.6)",
          }}
        >
          {hit.kind === "student" ? (
            <GraduationCap className="h-4 w-4" />
          ) : hit.kind === "teacher" ? (
            <UserCog className="h-4 w-4" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </span>

        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-bold text-white/90">{title}</span>
          {detail && <span className="truncate text-[11px] text-white/40">{detail}</span>}
        </span>
      </button>
    </li>
  );
}
