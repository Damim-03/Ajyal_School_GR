/**
 * مربّعاتُ الطبقتين الأوليين — تُعرض في الإسناد والنقل بلا فرق.
 *
 * كلُّ ما يختلف بين الشاشتين لونُ اللمسة، فيُمرَّر `accent`. وما
 * وراءه واحد: مادةٌ بصورتها، ثمّ أفواجُها بأعدادها، ثمّ مسارُ عودةٍ
 * يُبقي ما قبل الطبقة ظاهراً فلا يضيع من دخل في عمق.
 */

import { motion } from "motion/react";
import { BookOpen, Users } from "lucide-react";

import { assetUrl } from "../../lib/asset-url";
import { MOTION } from "../../motion/system";
import { fullName, type Assignment } from "./enrollments.api";
import type { SubjectCardData } from "./subject-groups";

// --------------------------------------------------
// الطبقة الأولى — المواد
// --------------------------------------------------

export function SubjectCards({
  subjects,
  accent,
  emptyHint,
  onOpen,
}: {
  subjects: SubjectCardData[];
  accent: string;
  /** ما يُقال حين لا مادّةَ تطابق — يختلف بين الشاشتين */
  emptyHint: string;
  onOpen: (id: string) => void;
}) {
  if (subjects.length === 0) {
    return <Empty icon={BookOpen} title="لا مادّةَ تطابق المرشِّحات" hint={emptyHint} />;
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {subjects.map((subject, i) => (
        <motion.button
          key={subject.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, delay: 0.03 * i }}
          whileHover={{ y: -4 }}
          onClick={() => onOpen(subject.id)}
          className="group flex flex-col items-stretch overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] text-right transition hover:border-white/25"
        >
          {/*
            وجهُ المادة — صورتُها إن رُفعت، وإلّا أيقونةٌ بلونها.

            الصورةُ تُعرف قبل الاسم: العينُ تلتقط مِجهرَ العلوم أو
            حروفَ اللغة في لمحة، والاسمُ يُقرأ بعدها تأكيداً. ومن لا
            صورةَ له لا يُترك فارغاً — لونُه يميّزه في الشبكة.
          */}
          <span
            className="grid h-28 place-items-center overflow-hidden transition group-hover:brightness-110"
            style={{ background: `${subject.color || accent}1f` }}
          >
            {assetUrl(subject.image) ? (
              <img src={assetUrl(subject.image)} alt="" className="h-full w-full object-cover" />
            ) : (
              <BookOpen className="h-8 w-8" style={{ color: subject.color || accent }} />
            )}
          </span>

          <span className="p-5">
            <h3 className="mb-1 text-lg font-black">{subject.name}</h3>

            <p className="text-[13px] text-white/45">
              {subject.groups.length} {subject.groups.length === 1 ? "فوج" : "أفواج"} ·{" "}
              {subject.teachers.size} {subject.teachers.size === 1 ? "أستاذ" : "أساتذة"}
            </p>
          </span>
        </motion.button>
      ))}
    </div>
  );
}

// --------------------------------------------------
// الطبقة الثانية — أفواج المادة
// --------------------------------------------------

export function GroupCards({
  groups,
  counts,
  accent,
  onOpen,
}: {
  groups: Assignment[];
  counts: Record<string, number>;
  accent: string;
  onOpen: (assignment: Assignment) => void;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {groups.map((a, i) => (
        <motion.button
          key={a.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: MOTION.duration.normal, delay: 0.03 * i }}
          whileHover={{ y: -4 }}
          onClick={() => onOpen(a)}
          className="group flex flex-col items-start rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-right transition hover:border-white/25"
        >
          <span
            className="mb-4 grid h-12 w-12 place-items-center rounded-2xl transition group-hover:scale-105"
            style={{ background: `${accent}1f` }}
          >
            <Users className="h-6 w-6" style={{ color: accent }} />
          </span>

          <h3 className="mb-1 text-lg font-black">{a.studyGroup.name}</h3>

          <p className="text-[13px] text-white/45">
            {a.studyGroup.level.name} · {fullName(a.teacher)}
          </p>

          <span
            className="mt-3 rounded-full px-3 py-1 text-[11px] font-bold"
            style={{ background: `${accent}1a`, color: accent }}
          >
            {counts[a.id] ?? 0} طالباً
          </span>
        </motion.button>
      ))}
    </div>
  );
}

// --------------------------------------------------
// قطعٌ صغيرة
// --------------------------------------------------

export function Crumb({
  label,
  accent,
  active = false,
  onClick,
}: {
  label: string;
  accent: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={active}
      className="rounded-lg px-3 py-1.5 text-sm font-bold transition disabled:cursor-default"
      style={
        active ? { background: `${accent}1f`, color: accent } : { color: "rgba(255,255,255,0.5)" }
      }
    >
      {label}
    </button>
  );
}

export function Empty({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Users;
  title: string;
  hint: string;
}) {
  return (
    <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-center">
      <Icon className="mb-3 h-10 w-10 text-white/15" />
      <p className="text-sm font-bold text-white/60">{title}</p>
      <p className="mt-1 max-w-100 text-[13px] text-white/35">{hint}</p>
    </div>
  );
}
