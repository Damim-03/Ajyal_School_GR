/**
 * البحث عن طالبٍ داخل كشفٍ مفتوح.
 *
 * الفوج قد يبلغ الأربعين، والكشف يُفتح غالباً لأجل طالبٍ واحد: أبٌ يسأل
 * عن حقوق ابنه، أو خانةُ حضورٍ تُصحَّح. وكان المستخدم يمرّر عمودَ الأسماء
 * بعينه — وهو أبطأ ما في الشاشة وأكثرُه خطأً حين تتشابه الألقاب.
 *
 * والتصفية **عرضٌ لا حذف**: المجاميع والمطبوع يبقيان على الكشف كلِّه،
 * ولذلك يُعرض العدّاد «ظاهر ٣ من ٤٠» فلا يُظنّ أنّ الكشف نقص.
 */

import { Search, X } from "lucide-react";

import { uiSound } from "../../lib/ui-sound";

export function SearchBox({
  value,
  onChange,
  placeholder = "ابحث عن طالب…",
  shown,
  total,
  accent,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** عدد الصفوف الظاهرة بعد التصفية */
  shown?: number;
  /** عدد صفوف الكشف كلِّه */
  total?: number;
  accent: string;
  className?: string;
}) {
  const active = value.trim().length > 0;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="relative min-w-0 flex-1 sm:max-w-72">
        <Search className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-white/30" style={{ insetInlineStart: 12 }} />

        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            /* Escape يُفرغ الحقل — أسرع من تحديد النصّ ومسحه */
            if (e.key === "Escape" && active) {
              e.stopPropagation();
              onChange("");
            }
          }}
          placeholder={placeholder}
          className="w-full rounded-xl border bg-black/30 py-2 pe-9 ps-10 text-xs font-bold outline-none transition placeholder:font-normal placeholder:text-white/30 focus:border-white/35"
          style={{ borderColor: active ? `${accent}55` : "rgba(255,255,255,0.1)" }}
        />

        {active && (
          <button
            onClick={() => {
              uiSound("back");
              onChange("");
            }}
            aria-label="إفراغ البحث"
            title="إفراغ البحث"
            className="absolute top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-white/35 transition hover:bg-white/10 hover:text-white"
            style={{ insetInlineEnd: 10 }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {active && shown !== undefined && total !== undefined && (
        <span className="shrink-0 text-[11px] text-white/40">
          ظاهر <span className="font-black" style={{ color: shown === 0 ? "#fda4af" : accent }}>{shown}</span> من {total}
        </span>
      )}
    </div>
  );
}
