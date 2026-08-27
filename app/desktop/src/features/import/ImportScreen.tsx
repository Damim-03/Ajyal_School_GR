import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  Play,
  Upload,
  XCircle,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { useLevels } from "../../core/api/reference.api";
import { usePermissions } from "../../core/hooks/use-permissions";
import { createStudent, listStudents } from "../../modules/students/student.api";
import { createTeacher, listAllTeachers } from "../../modules/teachers/teachers.api";

import { SHEET_NAMES, type SheetKind } from "./columns";
import { identityOf, type Identity } from "./duplicates";
import { buildPlan, type ImportPlan, type PlannedRow } from "./plan";
import { readWorkbook } from "./read-workbook";
import { runImport, type RowOutcome, type RunProgress } from "./run";
import { buildTemplate } from "./template";
import { saveFile, XLSX_FILTER } from "../../lib/save-file";

/**
 * **شاشةُ الاستيراد — مرحلتان لا واحدة، ولنوعٍ واحد.**
 *
 * تُقرأ الورقةُ كلُّها وتُفحص ولا يُكتب شيء، ثمّ يرى المستخدم حصيلةً
 * مصنَّفة ويقرّر.
 *
 * **والنوعُ يجيء من المحور لا من الملفّ**: الطلبةُ يُستوردون من
 * شاشتهم والأساتذةُ من شاشتهم. فمن ضغط الزرَّ في محور الطلبة لا يجوز
 * أن يكتب أساتذةً لأنّ ملفّاً حمل ورقةً ثانية.
 *
 * وجسدُ الشاشة واحدٌ لأنّ العملَ واحد — قراءةٌ ففحصٌ فقرارٌ فكتابة —
 * وما يفترق يُجمع في `PROFILE` أدناه.
 */

type Phase = "idle" | "reading" | "planned" | "running" | "done";

const STATUS_STYLE = {
  ready: "text-emerald-400",
  duplicate: "text-amber-400",
  blocked: "text-rose-400",
} as const;

const STATUS_LABEL = {
  ready: "جاهز",
  duplicate: "مشتبهٌ بتكراره",
  blocked: "مردود",
} as const;

/** فهرسُ الطلبة القائمين — يُجلب مرّةً ويُطابَق محلّياً، لا بحثاً لكلّ سطر */
const loadStudentIdentities = async (): Promise<Identity[]> => {
  const out: Identity[] = [];
  let page = 1;

  for (;;) {
    const { students, pagination } = await listStudents({ page, limit: 100 });

    for (const s of students) out.push(identityOf(s as never, "students"));

    if (page >= (pagination?.totalPages ?? 1) || students.length === 0) break;
    page++;
  }

  return out;
};

interface Profile {
  readonly title: string;
  readonly subtitle: string;
  readonly back: string;
  readonly permission: string;
  readonly needsLevels: boolean;
  readonly hint: string;
  readonly create: (payload: Record<string, unknown>) => Promise<unknown>;
  readonly loadExisting: () => Promise<Identity[]>;
}

const PROFILE: Readonly<Record<SheetKind, Profile>> = {
  students: {
    title: "استيراد الطلبة من Excel",
    subtitle: "يُفحص الملفّ كاملاً أوّلاً، ولا يُكتب شيء حتى تقرّر",
    back: PATHS.students,
    permission: "student.create",
    needsLevels: true,
    hint: "أنشئ الأطوارَ والمستويات في «البنية الدراسية» قبل الاستيراد — المستوى يُطابَق باسمه ولا يُنشأ من نفسه.",
    create: (payload) => createStudent(payload as never),
    loadExisting: loadStudentIdentities,
  },
  teachers: {
    title: "استيراد الأساتذة من Excel",
    subtitle: "يُفحص الملفّ كاملاً أوّلاً، ولا يُكتب شيء حتى تقرّر",
    back: PATHS.teachers,
    permission: "teacher.create",
    needsLevels: false,
    hint: "«تاريخ التوظيف» إلزاميٌّ ويجب أن يكون في الماضي، و«البريد الإلكتروني» فريدٌ في المؤسسة.",
    create: (payload) => createTeacher(payload as never),
    loadExisting: async () =>
      (await listAllTeachers()).map((t) => identityOf(t as never, "teachers")),
  },
};

export function ImportScreen({ kind }: { kind: SheetKind }) {
  const profile = PROFILE[kind];

  const { can } = usePermissions();
  const exitToHome = useScreenExit();
  const levels = useLevels();

  const [phase, setPhase] = useState<Phase>("idle");
  const [fileName, setFileName] = useState("");
  const [fatal, setFatal] = useState<string | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [outcomes, setOutcomes] = useState<RowOutcome[]>([]);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const input = useRef<HTMLInputElement>(null);
  const abort = useRef<AbortController | null>(null);

  const selected = useMemo(
    () =>
      (plan?.rows ?? []).filter(
        (r) => r.status === "ready" || (includeDuplicates && r.status === "duplicate"),
      ),
    [plan, includeDuplicates],
  );

  const back = (
    <button
      onClick={() => exitToHome(profile.back)}
      className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
    >
      <ArrowRight className="h-4 w-4" />
      رجوع
    </button>
  );

  // --------------------------------------------------

  const onPick = async (file: File) => {
    setPhase("reading");
    setFatal(null);
    setOutcomes([]);
    setPlan(null);
    setFileName(file.name);

    const result = await readWorkbook(file, kind);

    if (!result.sheet) {
      setFatal(result.fatal ?? "تعذّرت قراءة الملفّ");
      setPhase("idle");
      return;
    }

    setPlan(buildPlan(result.sheet, levels.data ?? [], await profile.loadExisting()));
    setPhase("planned");
  };

  const start = async () => {
    abort.current = new AbortController();
    setPhase("running");

    setOutcomes(
      await runImport(selected, profile.create, setProgress, abort.current.signal),
    );

    setPhase("done");
  };

  const downloadTemplate = async () => {
    setSaving(true);
    setNotice(null);
    setFatal(null);

    try {
      const done = await saveFile(await buildTemplate(kind), {
        suggestedName: `نموذج-${SHEET_NAMES[kind]}.xlsx`,
        ...XLSX_FILTER,
      });

      /* الإلغاءُ قصدٌ لا فشل — فلا رسالةَ له */
      if (done === "saved") setNotice("حُفظ النموذج. افتحه واملأه ثمّ عُد لاستيراده.");
    } catch (error) {
      setFatal(`تعذّر حفظ النموذج — ${(error as Error).message}`);
    } finally {
      setSaving(false);
    }
  };

  // --------------------------------------------------

  if (!can(profile.permission)) {
    return (
      <div className="min-h-screen bg-[#05070d] text-white">
        <AppHeader title={profile.title}>{back}</AppHeader>
        <p className="mx-auto mt-16 max-w-md text-center text-white/60">
          لا تملك صلاحيةً لهذا الإجراء — راجع مدير النظام.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#05070d] pb-24 text-white">
      <AppHeader title={profile.title} subtitle={profile.subtitle}>
        {back}
      </AppHeader>

      <div className="mx-auto mt-8 flex max-w-5xl flex-col gap-6 px-5">
        {/* ---------- الاختيار ---------- */}
        <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-bold transition hover:bg-white/5 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              نزّل نموذج {SHEET_NAMES[kind]}
            </button>

            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={phase === "reading" || phase === "running"}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-300 px-4 py-2.5 text-sm font-black text-slate-900 transition hover:bg-sky-200 disabled:opacity-50"
            >
              {phase === "reading" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              اختر ملفّاً
            </button>

            {fileName && (
              <span className="inline-flex items-center gap-2 text-sm text-white/60">
                <FileSpreadsheet className="size-4" />
                {fileName}
              </span>
            )}

            <input
              ref={input}
              type="file"
              accept=".xlsx"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPick(file);
                e.target.value = "";
              }}
            />
          </div>

          <p className="mt-4 text-sm leading-7 text-white/50">
            النموذجُ يجيء بأعمدة الهواتف والتواريخ مصيَّغةً نصّاً سلفاً — وهو ما
            يمنع سقوطَ الصفر البادئ من <span dir="ltr">0550…</span>. {profile.hint}
          </p>

          {fatal && (
            <p className="mt-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
              {fatal}
            </p>
          )}

          {notice && (
            <p className="mt-4 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
              {notice}
            </p>
          )}
        </section>

        {/* ---------- الحصيلة ---------- */}
        {phase === "planned" && plan && (
          <>
            <PlanSection plan={plan} />

            <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <label className="inline-flex items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={includeDuplicates}
                  onChange={(e) => setIncludeDuplicates(e.target.checked)}
                  className="size-4 accent-amber-400"
                />
                أدخِل المشتبَه بتكرارها أيضاً
              </label>

              <button
                type="button"
                onClick={() => void start()}
                disabled={selected.length === 0}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-400 px-5 py-2.5 text-sm font-black text-slate-900 transition hover:bg-emerald-300 disabled:opacity-40"
              >
                <Play className="size-4" />
                ابدأ إدخال {selected.length} سجلّاً
              </button>
            </section>
          </>
        )}

        {/* ---------- التقدّم ---------- */}
        {phase === "running" && progress && (
          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
            <div className="flex items-center justify-between text-sm">
              <span className="tabular-nums">
                {progress.done} من {progress.total}
              </span>
              <button
                type="button"
                onClick={() => abort.current?.abort()}
                className="font-bold text-rose-300 transition hover:text-rose-200"
              >
                أوقِف
              </button>
            </div>

            <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full bg-emerald-400 transition-[width] duration-300"
                style={{
                  width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%`,
                }}
              />
            </div>

            {progress.waiting > 0 && (
              <p className="mt-3 text-sm text-amber-300">
                بلغنا حدَّ الطلبات في الخادم — الاستئناف بعد {progress.waiting} ثانية.
                لا تُغلق الشاشة.
              </p>
            )}
          </section>
        )}

        {/* ---------- التقرير ---------- */}
        {phase === "done" && <Report outcomes={outcomes} />}
      </div>
    </div>
  );
}

// ======================================================

function PlanSection({ plan }: { plan: ImportPlan }) {
  const { counts } = plan;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02]">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-white/10 px-6 py-4">
        <h2 className="text-base font-black">{SHEET_NAMES[plan.kind]}</h2>

        <span className="text-sm text-emerald-400">{counts.ready} جاهز</span>
        {counts.duplicate > 0 && (
          <span className="text-sm text-amber-400">
            {counts.duplicate} مشتبهٌ بتكراره
          </span>
        )}
        {counts.blocked > 0 && (
          <span className="text-sm text-rose-400">{counts.blocked} مردود</span>
        )}
        {counts.warned > 0 && (
          <span className="text-sm text-amber-300">{counts.warned} بتنبيه</span>
        )}
      </div>

      {plan.unknownHeaders.length > 0 && (
        <p className="border-b border-white/10 px-6 py-3 text-sm text-white/50">
          أعمدةٌ تُتجاهَل: {plan.unknownHeaders.join(" · ")}
        </p>
      )}

      <div className="max-h-96 overflow-auto">
        <table className="w-full text-sm">
          <tbody>
            {plan.rows.map((row) => (
              <RowLine key={row.rowNumber} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function RowLine({ row }: { row: PlannedRow }) {
  const Icon =
    row.status === "ready" ? CheckCircle2 : row.status === "duplicate" ? Copy : XCircle;

  return (
    <tr className="border-b border-white/5 last:border-0">
      <td className="w-14 px-4 py-2.5 tabular-nums text-white/40">{row.rowNumber}</td>

      <td className="px-2 py-2.5">
        <span className={`inline-flex items-center gap-2 ${STATUS_STYLE[row.status]}`}>
          <Icon className="size-4 shrink-0" />
          {STATUS_LABEL[row.status]}
        </span>
      </td>

      <td className="px-2 py-2.5 font-bold">{row.label}</td>

      <td className="px-4 py-2.5 text-white/55">
        {row.duplicate && <span>يطابق {row.duplicate.against}</span>}
        {row.problems.map((p) => (
          <div key={p} className="text-rose-300/90">
            {p}
          </div>
        ))}
        {row.warnings.map((w) => (
          <div key={w} className="flex items-center gap-1.5 text-amber-300/90">
            <AlertTriangle className="size-3.5 shrink-0" />
            {w}
          </div>
        ))}
      </td>
    </tr>
  );
}

function Report({ outcomes }: { outcomes: readonly RowOutcome[] }) {
  const failed = outcomes.filter((o) => !o.ok);
  const created = outcomes.length - failed.length;

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <h2 className="text-base font-black">انتهى الاستيراد</h2>

      <p className="mt-2 text-sm text-white/70">
        أُدخل <strong className="text-emerald-400">{created}</strong> سجلّاً
        {failed.length > 0 && (
          <>
            ، وسقط <strong className="text-rose-400">{failed.length}</strong>
          </>
        )}
        .
      </p>

      {failed.length > 0 && (
        <>
          <p className="mt-4 text-sm text-white/50">
            صحّح هذه الأسطر في الملفّ ثمّ أعِد استيراده — ما دخل لن يتكرّر، فكشفُ
            التكرار يعرفه.
          </p>

          <ul className="mt-3 flex flex-col gap-1.5 text-sm">
            {failed.map((f) => (
              <li key={f.rowNumber} className="text-white/70">
                <span className="tabular-nums text-white/40">السطر {f.rowNumber}</span>
                {" · "}
                {f.label} — <span className="text-rose-300">{f.error}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
