import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  DatabaseBackup,
  FolderOpen,
  HardDriveDownload,
  Loader2,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { MotionDialog } from "../../motion/MotionDialog";
import { useAuthStore } from "../../core/stores/auth.store";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import {
  createBackup,
  deleteBackup,
  getMaintenance,
  humanBytes,
  listBackups,
  reopenFirstBoot,
  resetSystem,
  restoreBackup,
  restoreFromFile,
  type BackupFile,
  type KeepGroup,
  type MaintenanceOverview,
} from "./maintenance.api";

const ACCENT = "#7dd3fc";
const DANGER = "#fb7185";

/**
 * الصيانة — نسخةٌ تُؤخذ، ونسخةٌ تُعاد، ومحوٌ لا رجعة فيه.
 *
 * وثلاثتُها في شاشةٍ واحدة عن قصد: من جاء ليمحو يرى زرَّ النسخ قبله،
 * وقائمةَ النسخ الموجودة تحته. فلا يقع المحوُ إلّا وقد رأى صاحبُه ما
 * يُنقذه منه — أو رأى أنّه لا نسخةَ عنده فتراجَع.
 */
export default function MaintenancePage() {
  const exitTo = useScreenExit();
  const can = useAuthStore((s) => s.hasPermission);

  const [overview, setOverview] = useState<MaintenanceOverview | null>(null);
  const [backups, setBackups] = useState<BackupFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [restoring, setRestoring] = useState<BackupFile | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);

  const fileRef = useRef<HTMLInputElement | null>(null);

  const flash = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 4000);
  };

  const fail = (err: unknown, fallback: string) => {
    const data = (err as { response?: { data?: { message?: string } } }).response?.data;
    setError(data?.message ?? fallback);
  };

  const load = useCallback(async () => {
    setLoading(true);

    try {
      const [info, files] = await Promise.all([getMaintenance(), listBackups()]);
      setOverview(info);
      setBackups(files);
    } catch (err) {
      fail(err, "تعذّر قراءة حالة النظام");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRows = overview?.tables.reduce((sum, t) => sum + t.rows, 0) ?? 0;

  const backup = async () => {
    setBusy("backup");
    setError(null);

    try {
      const made = await createBackup();
      flash(`حُفظت النسخة: ${made.name} (${humanBytes(made.bytes)})`);
      await load();
    } catch (err) {
      fail(err, "تعذّر إنشاء النسخة");
    } finally {
      setBusy(null);
    }
  };

  const runRestore = async (from: BackupFile | File) => {
    setBusy("restore");
    setError(null);

    try {
      const result =
        from instanceof File
          ? await restoreFromFile(from)
          : await restoreBackup(from.name);

      const rows = Object.values(result.tables).reduce((a, b) => a + b, 0);
      flash(`استُعيدت ${rows} صفّاً و${result.files} ملفاً — أعِد تحميل الشاشات`);
      setRestoring(null);
      await load();
    } catch (err) {
      fail(err, "تعذّرت الاستعادة");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (file: BackupFile) => {
    setBusy(file.name);

    try {
      await deleteBackup(file.name);
      setBackups((list) => list.filter((f) => f.name !== file.name));
    } catch (err) {
      fail(err, "تعذّر حذف النسخة");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="النسخ الاحتياطي والصيانة" subtitle="نسخةٌ تُؤخذ · نسخةٌ تُعاد · إعادة تهيئة">
        <button
          onClick={() => exitTo(PATHS.settings)}
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          رجوع
        </button>
      </AppHeader>

      <div className="mx-auto max-w-275 space-y-5 p-6">
        {error && (
          <p className="flex items-start justify-between gap-3 rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
            <span className="flex items-start gap-2 leading-relaxed">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </span>
            <button onClick={() => setError(null)} aria-label="إغلاق">
              <X className="h-4 w-4" />
            </button>
          </p>
        )}

        {loading ? (
          <div className="grid place-items-center rounded-2xl border border-white/10 bg-white/[0.02] p-16 text-white/40">
            <Loader2 className="h-7 w-7 animate-spin" />
          </div>
        ) : (
          <>
            {/* ============ ما في النظام الآن ============ */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
              <h2 className="mb-4 text-base font-black">ما في النظام الآن</h2>

              <div className="grid gap-3 sm:grid-cols-3">
                <Stat label="صفوف البيانات" value={totalRows.toLocaleString("en")} hint={`${overview?.tables.length ?? 0} جدولاً`} />
                <Stat
                  label="الصور والوثائق"
                  value={String(overview?.uploads.files ?? 0)}
                  hint={humanBytes(overview?.uploads.bytes ?? 0)}
                />
                <Stat label="النسخ المحفوظة" value={String(backups.length)} hint={backups[0] ? `آخرها ${when(backups[0].createdAt)}` : "لا نسخة بعد"} />
              </div>

              {overview && (
                <p className="mt-4 flex items-start gap-2 rounded-xl border border-white/8 bg-black/25 px-4 py-2.5 text-[11px] leading-relaxed text-white/40">
                  <FolderOpen className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    تُحفظ النسخ في{" "}
                    <span className="font-mono text-white/70" dir="ltr">
                      {overview.backupsDir}
                    </span>
                    {" — "}
                    <span className="font-bold text-amber-300/80">
                      وانسخها إلى قرصٍ خارجيّ أو سحابة
                    </span>
                    : قرصٌ يتلف يأخذ القاعدةَ ونسخَها معاً.
                  </span>
                </p>
              )}
            </section>

            {/* ============ النسخ الاحتياطي ============ */}
            <section className="rounded-2xl border border-white/10 bg-white/[0.02]">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
                <div>
                  <h2 className="text-base font-black">النسخ الاحتياطي</h2>
                  <p className="text-[11px] text-white/40">
                    ملفٌّ واحد يحوي القاعدة كلَّها والصورَ والوثائق الممسوحة.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {can("maintenance.restore") && (
                    <>
                      <input
                        ref={fileRef}
                        type="file"
                        accept=".zip"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (file) runRestore(file);
                        }}
                      />
                      <button
                        onClick={() => fileRef.current?.click()}
                        disabled={busy !== null}
                        className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20 disabled:opacity-40"
                      >
                        <Upload className="h-4 w-4" />
                        استعادة من ملفّ
                      </button>
                    </>
                  )}

                  {can("maintenance.backup") && (
                    <button
                      onClick={backup}
                      disabled={busy !== null}
                      className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-40"
                      style={{ background: ACCENT }}
                    >
                      {busy === "backup" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <DatabaseBackup className="h-4 w-4" />
                      )}
                      خُذ نسخةً الآن
                    </button>
                  )}
                </div>
              </header>

              {backups.length === 0 ? (
                <div className="grid place-items-center p-12 text-center">
                  <HardDriveDownload className="mb-3 h-10 w-10 text-white/15" />
                  <p className="text-sm font-bold text-white/60">لا نسخةَ محفوظة بعد</p>
                  <p className="mt-1 text-[13px] text-white/35">
                    خُذ نسخةً قبل أيّ عملٍ كبير — وقبل إعادة التهيئة خاصّة.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-white/5">
                  {backups.map((file) => (
                    <li key={file.name} className="flex flex-wrap items-center gap-3 px-5 py-3">
                      <span
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                        style={{ background: `${ACCENT}1a`, color: ACCENT }}
                      >
                        <DatabaseBackup className="h-4.5 w-4.5" />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-mono text-[13px] font-bold" dir="ltr">
                          {file.name}
                        </span>
                        <span className="block text-[11px] text-white/40">
                          {when(file.createdAt)} · {humanBytes(file.bytes)}
                        </span>
                      </span>

                      {can("maintenance.restore") && (
                        <button
                          onClick={() => setRestoring(file)}
                          disabled={busy !== null}
                          className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-bold transition hover:bg-white/20 disabled:opacity-40"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          استعادة
                        </button>
                      )}

                      {can("maintenance.backup") && (
                        <button
                          onClick={() => remove(file)}
                          disabled={busy !== null}
                          title="حذف النسخة"
                          className="grid h-8 w-8 place-items-center rounded-lg text-white/35 transition hover:bg-rose-500/15 hover:text-rose-300 disabled:opacity-40"
                        >
                          {busy === file.name ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ============ إعادة التهيئة ============ */}
            {can("maintenance.reset") && overview && (
              <section
                className="rounded-2xl border p-5"
                style={{ borderColor: `${DANGER}3d`, background: `${DANGER}0a` }}
              >
                <h2 className="mb-1 flex items-center gap-2 text-base font-black" style={{ color: DANGER }}>
                  <AlertTriangle className="h-4.5 w-4.5" />
                  إعادة تهيئة البرنامج
                </h2>

                <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-white/55">
                  محوُ بيانات المؤسسة والبدءُ من جديد. حسابات المستخدمين وأدوارُها
                  وصلاحياتُها <span className="font-bold text-white/80">لا تُمحى أبداً</span> —
                  وما عداها تختاره أنت في النافذة. <span className="font-bold" style={{ color: DANGER }}>ولا رجعة</span>،
                  إلّا من نسخةٍ احتياطية.
                </p>

                <button
                  onClick={() => setResetOpen(true)}
                  disabled={busy !== null}
                  className="flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#2a0710] transition hover:brightness-110 disabled:opacity-40"
                  style={{ background: DANGER }}
                >
                  <AlertTriangle className="h-4 w-4" />
                  ابدأ إعادة التهيئة…
                </button>
              </section>
            )}

            {/* ============ إعادةُ فتح شاشات التهيئة ============ */}
            {/*
              **قسمٌ مستقلٌّ عن إعادة التهيئة فوقه — وهما يُخلطان دائماً.**

              ذاك يمحو **البيانات** ولا يمسّ شاشاتِ التركيب إطلاقاً (فحصتُ
              `maintenance.service`: لا ذكرَ لمفاتيح `system.first_boot.*`
              فيه). وهذا يفتح **الشاشات** ولا يمحو صفّاً واحداً.

              ووضعُهما متجاورين هو ما يمنع الخلط: يقرأ المستخدمُ الفرقَ
              مكتوباً قبل أن يضغط، بدل أن يضغط الأحمرَ ظنّاً أنّه يُعيد
              التركيب فيُضيّع بياناته ويبقى حيث هو.

              ولونُه ليس أحمر: هذا فعلٌ **لا يمحو شيئاً** — والتحذيرُ
              بلونٍ لا يستحقّه يُفقد اللونَ معناه حين يستحقّه.
            */}
            {can("maintenance.reset") && overview && (
              <section
                className="rounded-2xl border p-5"
                style={{ borderColor: `${ACCENT}33`, background: `${ACCENT}0a` }}
              >
                <h2 className="mb-1 flex items-center gap-2 text-base font-black" style={{ color: ACCENT }}>
                  <Sparkles className="h-4.5 w-4.5" />
                  إعادة فتح شاشات التهيئة الأولى
                </h2>

                <p className="mb-4 max-w-3xl text-[13px] leading-relaxed text-white/55">
                  تُعرض شاشاتُ التركيب الخمس عشرة من جديد عند الإقلاع التالي.
                  <span className="font-bold text-white/80"> ولا تُمحى بياناتٌ ولا حسابات</span> —
                  البرنامج يسألك عن اختياراتك فحسب، وما تُعيد كتابته يحلّ محلّ
                  ما كان. وهي ما تحتاجه إن كان النظام قد <span className="font-bold text-white/80">تبنّى</span>
                  {" "}التركيبَ تلقائياً ولم تمرّ بالشاشات أصلاً.
                </p>

                <button
                  onClick={() => setReopenOpen(true)}
                  disabled={busy !== null}
                  className="flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-black transition hover:brightness-125 disabled:opacity-40"
                  style={{ borderColor: `${ACCENT}55`, background: `${ACCENT}14`, color: ACCENT }}
                >
                  <Sparkles className="h-4 w-4" />
                  افتح شاشات التهيئة…
                </button>
              </section>
            )}
          </>
        )}
      </div>

      {restoring && (
        <ConfirmRestore
          file={restoring}
          busy={busy === "restore"}
          onClose={() => setRestoring(null)}
          onConfirm={() => runRestore(restoring)}
        />
      )}

      {reopenOpen && (
        <ReopenFirstBootDialog
          onClose={() => setReopenOpen(false)}
          onError={(message) => {
            setReopenOpen(false);
            setError(message);
          }}
        />
      )}

      {resetOpen && overview && (
        <ResetDialog
          overview={overview}
          backups={backups}
          onClose={() => setResetOpen(false)}
          onDone={async (message) => {
            setResetOpen(false);
            flash(message);
            await load();
          }}
          onError={(message) => setError(message)}
        />
      )}

      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed bottom-6 left-1/2 z-50 max-w-2xl -translate-x-1/2 rounded-xl border border-sky-400/30 bg-sky-500/15 px-5 py-2.5 text-center text-sm font-bold text-sky-100 backdrop-blur"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

// --------------------------------------------------

const when = (iso: string) =>
  new Date(iso).toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/8 bg-black/25 px-4 py-3">
      <p className="text-[11px] text-white/40">{label}</p>
      <p className="text-2xl font-black" dir="ltr" style={{ color: ACCENT }}>
        {value}
      </p>
      <p className="text-[11px] text-white/35">{hint}</p>
    </div>
  );
}

/**
 * الاستعادة تُستأذن لأنّها **تمحو الحاضر** قبل أن تُعيد الماضي.
 *
 * من ظنّها إضافةً إلى ما عنده يفقد كلَّ ما أُدخل بعد تاريخ النسخة.
 * فتُقال الجملةُ صريحةً بتاريخ النسخة فيها.
 */
function ConfirmRestore({
  file,
  busy,
  onClose,
  onConfirm,
}: {
  file: BackupFile;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <MotionDialog
      onClose={onClose}
      labelledBy="restore-title"
      className="w-full max-w-120 overflow-hidden rounded-2xl border border-white/12 bg-[#0a0f1a] text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <header className="flex items-center gap-3 px-6 py-4" style={{ background: `linear-gradient(120deg, ${ACCENT}22, transparent)` }}>
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${ACCENT}1f`, color: ACCENT }}>
          <RotateCcw className="h-5 w-5" />
        </span>
        <div className="flex-1">
          <h3 id="restore-title" className="text-base font-black leading-tight">
            استعادة نسخة
          </h3>
          <p className="font-mono text-[11px] text-white/45" dir="ltr">
            {file.name}
          </p>
        </div>
      </header>

      <div className="space-y-3 px-6 py-5 text-sm leading-relaxed text-white/70">
        <p>
          ستعود القاعدة إلى حالها يوم{" "}
          <span className="font-bold text-white">{when(file.createdAt)}</span>.
        </p>
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100">
          وكلُّ ما أُدخل بعد ذلك التاريخ <span className="font-black">يُمحى</span> — تسجيلاتٌ
          ودفعاتٌ وحضورٌ. خُذ نسخةً الآن أوّلاً إن كنت غير واثق.
        </p>
      </div>

      <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
        <button
          onClick={onConfirm}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#04121c] transition hover:brightness-110 disabled:opacity-40"
          style={{ background: ACCENT }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          استعِد الآن
        </button>
        <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20">
          إلغاء الأمر
        </button>
      </footer>
    </MotionDialog>
  );
}

/**
 * نافذةُ المحو — والأرقامُ فيها قبل الزرّ لا بعده.
 *
 * «هل أنت متأكّد؟» سؤالٌ لا يُجاب لأنّه لا يقول عمّاذا. فتُعرض
 * الأعدادُ الحقيقية: كم صفّاً يُمحى وكم يبقى، ومن أيّ جدول. ومعها
 * تحذيرٌ إن لم تكن ثمّة نسخةٌ محفوظة — وهو الحال الذي يُندَم عليه.
 */
/**
 * **إعادةُ فتح شاشات التهيئة — نافذةُ تأكيدٍ لا تُخيف، وتشرح ما ستقع.**
 *
 * والحرسُ كتابةُ الكلمة، وهي `RESET` بحروفها اللاتينية عمداً: تلك هي
 * الكلمةُ التي يشترطها مخطّطُ الخادم حرفياً (`z.literal("RESET")`). فما
 * يكتبه المستخدمُ هو **نفسُه** ما يُرسل — لا ترجمةَ بينهما تُخفي ما
 * يُصرَّح به.
 *
 * ## وإعادةُ التحميل جزءٌ من الفعل لا زينةٌ بعده
 *
 * بوّابةُ التهيئة تُسأل مرّةً واحدة عند تركيب `App`. فبلا إعادة تحميلٍ
 * يبقى المستخدمُ في شاشة الصيانة ولا يرى شيئاً، ويظنّ أنّ الزرَّ لم
 * يعمل — والحالُ أنّه عمل وسيظهر أثرُه غداً.
 *
 * ويُمحى معها `ajyal_booted` من `sessionStorage`: بغيره تبدأ الجلسةُ
 * التالية وهي تحسب أنّ الإقلاع قد جرى، فيُتخطّى تسلسلُ الشعار واختيارِ
 * المستخدم بعد انتهاء التهيئة. ومحوُه يجعل ما يلي التهيئةَ مطابقاً
 * لتركيبٍ جديدٍ تماماً.
 */
function ReopenFirstBootDialog({
  onClose,
  onError,
}: {
  onClose: () => void;
  onError: (message: string) => void;
}) {
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const ready = typed.trim().toUpperCase() === "RESET" && !busy;

  const run = async () => {
    if (!ready) return;

    setBusy(true);

    try {
      await reopenFirstBoot();

      /* الجلسةُ التالية تبدأ من أوّل التسلسل لا من منتصفه. */
      try {
        sessionStorage.removeItem("ajyal_booted");
      } catch {
        /* رفاهية — لا تُعطّل الفعل */
      }

      window.location.reload();
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } }).response?.data;
      setBusy(false);
      onError(data?.message ?? "تعذّر فتح شاشات التهيئة");
    }
  };

  return (
    <MotionDialog onClose={busy ? () => {} : onClose} labelledBy="reopen-title">
      <div className="flex w-[min(92vw,460px)] flex-col gap-5 p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl"
            style={{ background: `${ACCENT}1a`, color: ACCENT }}
          >
            <Sparkles className="h-5 w-5" />
          </span>

          <div className="flex flex-col gap-1">
            <h3 id="reopen-title" className="text-base font-black leading-tight">
              إعادة فتح شاشات التهيئة
            </h3>
            <p className="text-[13px] leading-relaxed text-white/55">
              يُعاد تشغيل البرنامج فوراً، وتبدأ شاشاتُ التركيب من أوّلها.
            </p>
          </div>
        </div>

        {/* ما يقع وما لا يقع — الفرقُ عن «إعادة التهيئة» يُقال هنا صراحةً */}
        <ul className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[12px] leading-relaxed">
          <li className="flex items-start gap-2 text-white/70">
            <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
            تُعرض الشاشاتُ الخمس عشرة من جديد
          </li>
          <li className="flex items-start gap-2 text-white/70">
            <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: ACCENT }} />
            حسابُك وكلمةُ مرورك كما هما — ولن يُنشأ حسابٌ ثانٍ باسمك
          </li>
          <li className="flex items-start gap-2 text-white/70">
            <X aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/35" />
            <span>
              <span className="font-bold text-white/85">لا تُمحى</span> بياناتٌ ولا طلبةٌ ولا
              أساتذةٌ ولا نسخٌ احتياطية
            </span>
          </li>
        </ul>

        <div className="flex flex-col gap-2">
          <label htmlFor="reopen-confirm" className="text-[12px] text-white/55">
            اكتب <span className="font-black" style={{ color: ACCENT }}>RESET</span> للتأكيد
          </label>
          <input
            id="reopen-confirm"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void run();
              }
            }}
            placeholder="RESET"
            dir="ltr"
            autoComplete="off"
            className="rounded-xl border bg-white/5 px-4 py-2.5 text-center text-sm font-black tracking-widest text-white outline-none transition placeholder:font-normal placeholder:tracking-normal placeholder:text-white/25"
            style={{
              borderColor: ready ? `${ACCENT}88` : "rgba(255,255,255,0.12)",
            }}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!ready}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black text-[#04202b] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-35"
            style={{ background: ACCENT }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "يُعاد التشغيل…" : "افتح وأعد التشغيل"}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-white/12 px-4 py-2.5 text-sm font-black text-white/60 transition hover:bg-white/8 disabled:opacity-40"
          >
            تراجع
          </button>
        </div>
      </div>
    </MotionDialog>
  );
}

function ResetDialog({
  overview,
  backups,
  onClose,
  onDone,
  onError,
}: {
  overview: MaintenanceOverview;
  backups: BackupFile[];
  onClose: () => void;
  onDone: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [keep, setKeep] = useState<KeepGroup[]>(["identity", "structure", "staff", "pricing"]);
  const [purgeFiles, setPurgeFiles] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);

  const keptTables = new Set(
    overview.groups.filter((g) => keep.includes(g.key)).flatMap((g) => g.tables.map((t) => t.toLowerCase())),
  );

  const wiped = overview.tables.filter((t) => !t.locked && !keptTables.has(t.name.toLowerCase()));
  const wipedRows = wiped.reduce((sum, t) => sum + t.rows, 0);
  const keptRows = overview.tables.reduce((sum, t) => sum + t.rows, 0) - wipedRows;

  const ready = typed.trim() === "إعادة التهيئة" && !busy;

  const submit = async () => {
    if (!ready) return;

    setBusy(true);

    try {
      const result = await resetSystem({ keep, purgeFiles });
      const rows = Object.values(result.deleted).reduce((a, b) => a + b, 0);

      await onDone(
        `مُحي ${rows} صفّاً` +
          (result.purgedFiles > 0 ? ` و${result.purgedFiles} ملفاً` : "") +
          " — أعِد تحميل الشاشات",
      );
    } catch (err) {
      const data = (err as { response?: { data?: { message?: string } } }).response?.data;
      onError(data?.message ?? "تعذّرت إعادة التهيئة");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <MotionDialog
      onClose={onClose}
      labelledBy="reset-title"
      className="w-full max-w-150 overflow-hidden rounded-2xl border text-white shadow-[0_24px_80px_rgba(0,0,0,0.6)]"
    >
      <div className="bg-[#0a0f1a]" style={{ border: `1px solid ${DANGER}33` }}>
        <header className="flex items-center gap-3 px-6 py-4" style={{ background: `linear-gradient(120deg, ${DANGER}26, transparent)` }}>
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{ background: `${DANGER}1f`, color: DANGER }}>
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <h3 id="reset-title" className="text-base font-black leading-tight">
              إعادة تهيئة البرنامج
            </h3>
            <p className="text-[11px] text-white/45">محوٌ لا رجعة فيه — اقرأ الأعداد قبل التأكيد</p>
          </div>
          <button onClick={onClose} aria-label="إغلاق" className="grid h-8 w-8 place-items-center rounded-lg text-white/50 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto px-6 py-5">
          {backups.length === 0 && (
            <p className="flex items-start gap-2 rounded-xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-[13px] font-bold leading-relaxed text-amber-100">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              لا نسخةَ احتياطية محفوظة. أغلِق هذه النافذة وخُذ نسخةً أوّلاً — ما يُمحى
              هنا لا يعود بغيرها.
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-bold text-white/55">ما يبقى بعد المحو</p>

            <label className="mb-2 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 opacity-60">
              <span className="grid h-5 w-5 place-items-center rounded" style={{ background: `${ACCENT}33`, color: ACCENT }}>
                <Check className="h-3.5 w-3.5" />
              </span>
              <span className="flex-1 text-sm font-bold">حسابات المستخدمين وأدوارُها وصلاحياتُها</span>
              <span className="text-[11px] text-white/40">لا تُمحى أبداً</span>
            </label>

            {overview.groups.map((group) => {
              const on = keep.includes(group.key);

              return (
                <label
                  key={group.key}
                  className="mb-2 flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-2.5 transition"
                  style={on ? { borderColor: `${ACCENT}55`, background: `${ACCENT}0f` } : { borderColor: "rgba(255,255,255,0.1)" }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setKeep((list) =>
                        on ? list.filter((k) => k !== group.key) : [...list, group.key],
                      )
                    }
                    className="h-4 w-4 accent-sky-400"
                  />
                  <span className="flex-1 text-sm font-bold">{group.label}</span>
                  <span className="text-[11px] text-white/40">{group.rows} صفّاً</span>
                </label>
              );
            })}

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/10 px-4 py-2.5">
              <input
                type="checkbox"
                checked={purgeFiles}
                onChange={() => setPurgeFiles((v) => !v)}
                className="h-4 w-4 accent-rose-400"
              />
              <span className="flex-1 text-sm font-bold">
                احذف الصور والوثائق التي لم يبقَ من يشير إليها
              </span>
              <span className="text-[11px] text-white/40">
                {overview.uploads.files} ملف · {humanBytes(overview.uploads.bytes)}
              </span>
            </label>
          </div>

          {/* الحصيلة — رقمان لا جملة */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border px-4 py-3" style={{ borderColor: `${DANGER}44`, background: `${DANGER}0f` }}>
              <p className="text-[11px] text-white/45">سيُمحى</p>
              <p className="text-2xl font-black" dir="ltr" style={{ color: DANGER }}>
                {wipedRows.toLocaleString("en")}
              </p>
              <p className="text-[11px] text-white/35">صفّاً من {wiped.length} جدولاً</p>
            </div>

            <div className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <p className="text-[11px] text-white/45">سيبقى</p>
              <p className="text-2xl font-black text-white/80" dir="ltr">
                {keptRows.toLocaleString("en")}
              </p>
              <p className="text-[11px] text-white/35">صفّاً</p>
            </div>
          </div>

          {wiped.filter((t) => t.rows > 0).length > 0 && (
            <details className="rounded-xl border border-white/10 bg-black/25 px-4 py-3">
              <summary className="cursor-pointer text-[12px] font-bold text-white/55">
                تفصيلُ ما سيُمحى ({wiped.filter((t) => t.rows > 0).length} جدولاً)
              </summary>
              <ul className="mt-2 grid gap-1 sm:grid-cols-2">
                {wiped
                  .filter((t) => t.rows > 0)
                  .sort((a, b) => b.rows - a.rows)
                  .map((t) => (
                    <li key={t.name} className="flex justify-between text-[11px] text-white/45">
                      <span className="font-mono" dir="ltr">{t.name}</span>
                      <span dir="ltr">{t.rows}</span>
                    </li>
                  ))}
              </ul>
            </details>
          )}

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-white/55">
              اكتب <span style={{ color: DANGER }}>إعادة التهيئة</span> للتأكيد
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="إعادة التهيئة"
              autoFocus
              className="w-full rounded-xl border bg-black/30 px-4 py-2.5 text-sm font-bold outline-none transition placeholder:font-normal placeholder:text-white/25"
              style={{ borderColor: typed.trim() === "إعادة التهيئة" ? `${DANGER}88` : "rgba(255,255,255,0.12)" }}
            />
          </label>
        </div>

        <footer className="flex items-center gap-3 border-t border-white/10 px-6 py-4">
          <button
            onClick={submit}
            disabled={!ready}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-black text-[#2a0710] transition hover:brightness-110 disabled:opacity-30"
            style={{ background: DANGER }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            امحُ نهائياً
          </button>
          <button onClick={onClose} className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-bold transition hover:bg-white/20">
            إلغاء الأمر
          </button>
        </footer>
      </div>
    </MotionDialog>
  );
}
