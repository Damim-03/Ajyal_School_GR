import { motion, useReducedMotion } from "motion/react";
import { Maximize2, Power, Search } from "lucide-react";

import { Avatar } from "../../../components/shared/Avatar";
import { toggleFullscreen } from "../../../lib/app-window";
import type { User } from "../../../core/types";
import { NotificationBell } from "./NotificationBell";
import { QuickAction } from "./QuickAction";
import { ease, geometry, palette, reduced, tab } from "./topbar.tokens";

/**
 * الشريطُ العلوي للرئيسية.
 *
 * أُخرج من `HomePage` إلى ملفٍّ خاصّ: صار له أربعُ مناطقَ وسلوكٌ
 * (لوحةُ إشعارات، وإبرازٌ يتبع الانتباه، ومؤشّرٌ للتبويب النشط)، وبقاؤه
 * تسعين سطراً في وسط ملفٍّ من ألفٍ وخمسمئة كان سيجعل كلَّ تعديلٍ فيه
 * يقرأ ما لا يخصّه.
 *
 * **والترتيبُ منطقيٌّ لا بصريّ.** المستندُ عربيّ، فأوّلُ أبناء الصفّ
 * يقع في اليمين. فالهويّةُ أوّلاً (يميناً) والساعةُ آخراً (يساراً) —
 * كما في المخطّط تماماً، وبلا `direction` معكوسٍ يدوياً ولا `order`.
 *
 * والمناطقُ الأربع من المخطّط:
 *
 *   [الملف 120px] [الأقسام 300px] ——مرن—— [إجراءات] [الوقت 200px]
 */
export function HomeTopBar({
  user,
  schoolName,
  shortName,
  shortSuffix,
  brandColor,
  time,
  date,
  onSearch,
  onLogout,
}: {
  user: User | null;
  schoolName: string;
  shortName: string;
  shortSuffix: string;
  brandColor: string;
  time: string;
  date: string;
  /**
   * البحثُ العامّ — حلَّ محلَّ «الإعدادات» في هذا الموضع.
   *
   * والزرُّ القديم كان يفعل ما تفعله بلاطةُ الإعدادات في الصفّ تحته
   * بالضبط: يُركّز عليها. أي أنّه يشغل أثمنَ موضعٍ في الشاشة بطريقٍ
   * ثانٍ إلى وجهةٍ لها طريقُها الظاهر — والبحثُ لا طريقَ له غير هذا.
   */
  onSearch: () => void;
  onLogout: () => void;
}) {
  const still = useReducedMotion();

  return (
    <div
      className="flex items-center gap-4 px-9"
      style={{ height: geometry.height }}
    >
      {/* ===== ① الملفّ الشخصي — أقصى اليمين ===== */}
      {user && (
        <div className="relative shrink-0">
          <Avatar src={user.avatar} name={user.username} gender={user.gender} size={geometry.avatar} />
          {/*
            نقطةُ الاتّصال — خضراءُ ثابتة.

            لا تُنبض ولا تُحرَّك: هي حالةٌ قائمة لا حدثٌ وقع، وحركةٌ
            لانهائيةٌ في ركنٍ من الشاشة تسحب الانتباه إلى ما لا يطلبه.
            والحلقةُ الداكنة حولها تفصلها عن الصورة أيّاً كان لونُها.
          */}
          <span
            aria-hidden
            className="absolute bottom-0 h-3 w-3 rounded-full"
            style={{
              insetInlineEnd: 0,
              background: "#4ade80",
              boxShadow: `0 0 0 2.5px ${palette.abyss}`,
            }}
          />
        </div>
      )}

      {/* اسمُ المؤسسة — يسقط دون `lg` كما كان، فلا يزاحم الصفَّ على الشاشات الضيّقة */}
      <span className="hidden shrink-0 text-[12px] font-light text-white/45 lg:inline">
        {schoolName}
      </span>

      {/* ===== ② الهويّة والأقسام ===== */}
      <div className="flex shrink-0 items-baseline gap-1">
        <span className="text-2xl font-black">{shortName}</span>
        <span className="text-2xl font-black" style={{ color: brandColor }}>
          {shortSuffix}
        </span>
      </div>

      {/*
        التبويبان.

        «الأقسام» **نصٌّ لا زرّ** — وهو ما هو عليه اليوم، ولم يُغيَّر:
        لا صفحةَ خلفه بعد. ورسمُه قابلاً للنقر مع تكبيرٍ عند التمرير
        (كما يقترح المخطّط) كان سيَعِد بشيءٍ لا يقع.
      */}
      <nav className="ms-2 flex shrink-0 items-end gap-5" aria-label="أقسام الواجهة">
        <span className="relative text-lg font-bold text-white">
          الرئيسية
          {/*
            المؤشّرُ السفلي — علامةُ «أنت هنا».
            و`layoutId` مُعدٌّ سلفاً: إن صار «الأقسام» تبويباً حقيقياً
            انزلق المؤشّرُ بينهما بلا سطرٍ إضافي.
          */}
          <motion.span
            layoutId="topbar-tab-indicator"
            aria-hidden
            className="absolute -bottom-1.5 inset-x-0 rounded-full"
            style={{ height: tab.indicatorHeight, background: palette.accent }}
            transition={still ? reduced.transition : { duration: tab.duration, ease }}
          />
        </span>
        <span className="text-lg font-light text-white/35">الأقسام</span>
      </nav>

      {/* المساحةُ المرنة — تدفع الإجراءات والساعة إلى الطرف الآخر */}
      <div className="min-w-8 flex-1" />

      {/* ===== ③ إجراءاتٌ سريعة ===== */}
      <div className="flex shrink-0 items-center" style={{ gap: geometry.gap }}>
        <NotificationBell />

        <QuickAction label="ملء الشاشة" onClick={() => void toggleFullscreen()}>
          <Maximize2 aria-hidden strokeWidth={1.8} className="h-full w-full" />
        </QuickAction>

        <QuickAction label="بحث (Ctrl+K)" onClick={onSearch}>
          <Search aria-hidden strokeWidth={1.8} className="h-full w-full" />
        </QuickAction>

        {/*
          الخروجُ آخرُ الصفّ ولونُه مختلف.

          الموضعُ والحرارةُ كلاهما تحذير: الأطرافُ أبعدُ ما يُنقر خطأً،
          واللونُ يُميّزه قبل أن يُقرأ اسمُه. ويبقى دافئاً خافتاً لا
          أحمرَ صريحاً — فهو فعلٌ عاديّ في يومٍ عاديّ، لا خطر.
        */}
        <QuickAction label="تسجيل الخروج" onClick={onLogout} tone="rgba(232,143,154,0.85)">
          <Power aria-hidden strokeWidth={1.8} className="h-full w-full" />
        </QuickAction>
      </div>

      {/* ===== ④ الوقت والتاريخ — أقصى اليسار ===== */}
      <div className="ms-3 shrink-0 text-right leading-tight">
        <div className="text-xl font-black tabular-nums">{time}</div>
        <div className="text-[11px] font-light text-white/50">{date}</div>
      </div>
    </div>
  );
}
