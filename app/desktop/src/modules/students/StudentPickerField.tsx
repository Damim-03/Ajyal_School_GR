import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Loader2, Search, X } from "lucide-react";

import { Avatar } from "../../components/shared/Avatar";
import { listStudents, type Student, type StudentQuery } from "./student.api";

/**
 * حقلُ اختيار طالب — يُكتب فيه فتنزل القائمة.
 *
 * كانت قائمةً منسدلة تُملأ مسبقاً: تُجلب خمسون طالباً ويُبحث فيهم. وهي
 * تصلح لعشرة أفواج لا لمؤسسةٍ فيها مئات، ولا تُظهر من الطالب إلّا اسماً
 * في سطر — والاسمُ يتكرّر، فيُفتح حسابُ «محمد أمين» غيرِ المقصود ولا
 * يُكتشف إلّا بعد طباعة الورقة.
 *
 * فصار حقلاً يبحث من أوّل حرف، وتنزل تحته القائمة بما يفرّق بين
 * المتشابهين: **صورةُ الطالب واسمُه ولقبُه ورقمُ تسجيله**. والصورة
 * أسرعُ ما تُميّز — تُقرأ قبل أن يُقرأ السطر.
 *
 * وحقلان لا حقل: الاسمُ يُكتب حروفاً والرقمُ يُكتب خاناتٍ، ولكلٍّ
 * مطابقتُه على الخادم — فخلطُهما في حقلٍ واحد يجعل «2026» بحثاً عن اسم.
 */
export function StudentPickerField({
  mode,
  value,
  onChange,
  onPick,
  accent,
  placeholder,
  scope,
  disabled = false,
}: {
  /** بأيّ شيءٍ يُبحث — وبه تُختار مطابقةُ الخادم */
  mode: "name" | "number";
  value: string;
  onChange: (text: string) => void;
  onPick: (student: Student) => void;
  accent: string;
  placeholder: string;
  /** ما يحصر البحث — السنة الدراسية مثلاً */
  scope?: Pick<StudentQuery, "academicYearId" | "isActive">;
  disabled?: boolean;
}) {
  const [rows, setRows] = useState<Student[]>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);

  const boxRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();

  const term = value.trim();

  /*
   * مهلةٌ بين الحرف والطلب.
   *
   * الكتابة أسرع من الشبكة، وطلبٌ لكلّ حرفٍ يُغرق الخادم بأجوبةٍ
   * يتجاوزها ما بعدها — وقد تصل متأخّرةً فتحلّ محلّ الأحدث.
   */
  const [query, setQuery] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(term), 250);

    return () => window.clearTimeout(timer);
  }, [term]);

  const scoped = useMemo(
    () => ({ academicYearId: scope?.academicYearId, isActive: scope?.isActive }),
    [scope?.academicYearId, scope?.isActive],
  );

  useEffect(() => {
    if (!query) {
      setRows([]);
      return;
    }

    let alive = true;
    setBusy(true);

    listStudents({
      limit: 8,
      ...(scoped.academicYearId ? { academicYearId: scoped.academicYearId } : {}),
      ...(scoped.isActive !== undefined ? { isActive: scoped.isActive } : {}),
      ...(mode === "number" ? { studentNumber: query } : { search: query }),
    })
      .then((res) => {
        if (!alive) return;
        setRows(res.students);
        setActive(0);
      })
      .catch(() => alive && setRows([]))
      .finally(() => alive && setBusy(false));

    return () => {
      alive = false;
    };
  }, [query, mode, scoped]);

  const showList = open && term.length > 0 && !disabled;

  /*
   * القائمة تُعلَّق على `body` لا داخل الحقل.
   *
   * لوحُ المرشِّحات يُطوى بحركةٍ على الارتفاع، فيحمل `overflow-hidden`
   * على طبقتين. وقائمةٌ مطلقةُ الموضع داخله تُقصّ عند حافّته: كانت
   * تظهر منها شريحةٌ واحدة تحت الحقل ثمّ تُقطع — وما يُقصّ لا يُنقر.
   *
   * فتُرسم في بوّابةٍ بموضعٍ ثابت (`fixed`) محسوبٍ من مستطيل الحقل،
   * ويُعاد الحساب مع كل تمريرٍ أو تغييرِ مقاس. وتنقلب إلى الأعلى إن
   * ضاق ما تحتها.
   */
  const [rect, setRect] = useState<DOMRect | null>(null);

  useLayoutEffect(() => {
    if (!showList) return;

    const place = () => setRect(boxRef.current?.getBoundingClientRect() ?? null);

    place();

    /* `true` للالتقاط: التمرير قد يقع في حاويةٍ داخلية لا في النافذة */
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);

    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [showList, rows.length]);

  /* النقرُ خارج الحقل وخارج القائمة يُغلقها — لا يُلغي ما كُتب */
  useEffect(() => {
    if (!open) return;

    const away = (event: MouseEvent) => {
      const target = event.target as Node;

      if (boxRef.current?.contains(target) || listRef.current?.contains(target)) {
        return;
      }

      setOpen(false);
    };

    document.addEventListener("mousedown", away);

    return () => document.removeEventListener("mousedown", away);
  }, [open]);

  const choose = (student: Student) => {
    onPick(student);
    setOpen(false);
  };

  const list = showList && rect && (
    <ul
      ref={listRef}
      id={listId}
      role="listbox"
      dir="rtl"
      style={{
        position: "fixed",
        left: rect.left,
        width: rect.width,
        ...(window.innerHeight - rect.bottom > 240
          ? { top: rect.bottom + 6 }
          : { bottom: window.innerHeight - rect.top + 6 }),
        maxHeight: 288,
        zIndex: 70,
      }}
      /*
       * `text-white` صراحةً — البوّابة على `body` لا داخل الشاشة.
       *
       * الشاشةُ تضع لونَ نصّها على غلافها، وما خرج منه ورث لونَ الصفحة
       * الرماديّ: خرجت الأسماء باهتةً على أرضٍ داكنة لا تكاد تُقرأ.
       * وكلُّ ما يُرسم في بوّابةٍ يلزمه أن يحمل لونَه معه.
       */
      className="overflow-y-auto rounded-xl border border-white/12 bg-[#0b111c] py-1 text-white shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
    >
      {rows.length === 0 ? (
        <li className="px-4 py-3 text-center text-xs text-white/35">
          {busy ? "يُبحث…" : "لا طالبَ بهذا الاسم أو الرقم"}
        </li>
      ) : (
        rows.map((student, index) => (
          <li key={student.id} role="option" aria-selected={index === active}>
            <button
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(student)}
              className="flex w-full items-center gap-3 px-3 py-2 text-start transition"
              style={{ background: index === active ? `${accent}1a` : "transparent" }}
            >
              <Avatar
                src={student.avatar}
                name={`${student.lastName} ${student.firstName}`}
                gender={student.gender}
                size={34}
              />

              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-white">
                  {student.lastName} {student.firstName}
                </span>
                <span className="block truncate text-[11px] text-white/50">
                  {student.level?.name ?? "بلا مستوى"}
                </span>
              </span>

              <span
                className="shrink-0 rounded-md px-2 py-1 font-mono text-[11px] font-bold"
                dir="ltr"
                style={{ background: `${accent}14`, color: accent }}
              >
                {student.studentNumber}
              </span>
            </button>
          </li>
        ))
      )}
    </ul>
  );

  return (
    <div ref={boxRef} className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-white/30"
        style={{ insetInlineStart: 12 }}
      />

      <input
        value={value}
        disabled={disabled}
        inputMode={mode === "number" ? "numeric" : "text"}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!showList || rows.length === 0) return;

          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((at) => (at + 1) % rows.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((at) => (at - 1 + rows.length) % rows.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            choose(rows[active]!);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-black/25 py-2.5 pe-9 ps-9 text-sm font-bold outline-none transition placeholder:font-normal placeholder:text-white/30 focus:border-white/30 disabled:opacity-40"
        dir={mode === "number" ? "ltr" : undefined}
        style={mode === "number" ? { textAlign: "start" } : undefined}
      />

      {busy ? (
        <Loader2
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/35"
          style={{ insetInlineEnd: 12 }}
        />
      ) : (
        value && (
          <button
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            aria-label="امسح"
            className="absolute top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-white/35 transition hover:bg-white/10 hover:text-white"
            style={{ insetInlineEnd: 8 }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )
      )}

      {list && createPortal(list, document.body)}
    </div>
  );
}
