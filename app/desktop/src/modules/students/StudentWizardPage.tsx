import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, CheckCircle2, FolderCheck, UserPlus } from "lucide-react";

import { AppHeader } from "../../components/AppHeader";
import { Avatar } from "../../components/shared/Avatar";
import { MOTION } from "../../motion/system";
import { PATHS } from "../../routes/paths";
import { useScreenExit } from "../../lib/screen-transition";
import { StudentFields } from "./StudentFields";
import { DocumentsPanel } from "./DocumentsPanel";
import { createStudent, type Student, type StudentInput } from "./student.api";

const ACCENT = "#7dd3fc";

/**
 * تسجيل طالب جديد — خطوتان.
 *
 * الفصل ليس تجميلاً: رفع الوثائق **يحتاج معرّف الطالب** (المسار
 * ‏`/students/:id/documents`)، فلا سبيل لرفعها قبل حفظ المعلومات.
 * وعرضُ الخانتين معاً كان سيُظهر خانات رفعٍ لا تعمل.
 *
 * ولذلك الخطوة الأولى تنتهي بحفظٍ حقيقي: الطالب موجود قبل الخطوة
 * الثانية، فإن انصرف المستخدم بقي مسجَّلاً بملفٍّ ناقص — وهي حالة
 * صحيحة تعرضها شاشة «ملفات الطلبة» صراحةً.
 */
export default function StudentWizardPage() {
  const navigate = useNavigate();
  const exitToHome = useScreenExit();

  const [step, setStep] = useState<1 | 2>(1);
  const [created, setCreated] = useState<Student | null>(null);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (payload: StudentInput) => {
    setBusy(true);
    setError(null);

    try {
      const student = await createStudent(payload);
      setCreated(student);
      setStep(2);
    } catch (err: unknown) {
      const response = (err as {
        response?: { data?: { message?: string; errors?: { message: string }[] } };
      }).response;

      setError(
        response?.data?.errors?.[0]?.message ??
          response?.data?.message ??
          "تعذّر حفظ الطالب",
      );
    } finally {
      setBusy(false);
    }
  };

  const name = created ? `${created.firstName} ${created.lastName}` : "";

  return (
    <div className="min-h-screen bg-[#05070d] text-white">
      <AppHeader title="تسجيل طالب جديد" subtitle="المعلومات ثمّ الوثائق">
        <button
          onClick={() =>
            step === 2 ? navigate(PATHS.students) : exitToHome(PATHS.students)
          }
          className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-bold transition hover:bg-white/20"
        >
          <ArrowRight className="h-4 w-4" />
          {step === 2 ? "إنهاء" : "رجوع"}
        </button>
      </AppHeader>

      <div className="mx-auto max-w-225 p-6">
        {/* ================= مؤشّر الخطوات ================= */}
        <div className="mb-7 flex items-center gap-3">
          <StepDot n={1} label="المعلومات" active={step === 1} done={step > 1} />
          <div
            className="h-0.5 flex-1 rounded"
            style={{ background: step > 1 ? ACCENT : "rgba(255,255,255,0.1)" }}
          />
          <StepDot n={2} label="الوثائق" active={step === 2} done={complete} />
        </div>

        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
            className="rounded-2xl border border-white/10 bg-white/[0.02] p-6"
          >
            <StudentFields
              onSubmit={save}
              busy={busy}
              error={error}
              submitLabel="حفظ ومتابعة إلى الوثائق"
              submitIcon={<UserPlus className="h-4.5 w-4.5" />}
            />
          </motion.div>
        )}

        {step === 2 && created && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
            className="space-y-5"
          >
            <div className="flex items-center gap-4 rounded-2xl border border-emerald-400/25 bg-emerald-500/[0.07] p-5">
              <Avatar src={created.avatar} name={name} gender={created.gender} size={52} />
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm font-black text-emerald-200">
                  <CheckCircle2 className="h-4 w-4" />
                  سُجِّل الطالب
                </div>
                <div className="text-lg font-black">{name}</div>
                <div className="text-[11px] text-white/45">
                  ارفع الوثائق الآن، أو أنهِ وأكملها لاحقاً من «ملفات الطلبة».
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
              <DocumentsPanel
                studentId={created.id}
                onChange={(file) => setComplete(file.completeness.isComplete)}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => navigate(PATHS.studentsFiles)}
                className="flex items-center gap-2 rounded-xl px-5 py-3 font-black text-[#04121c] transition hover:brightness-110"
                style={{ background: ACCENT }}
              >
                <Check className="h-4.5 w-4.5" />
                إنهاء التسجيل
              </button>

              <button
                onClick={() => {
                  setCreated(null);
                  setComplete(false);
                  setStep(1);
                }}
                className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
              >
                <UserPlus className="h-4 w-4" />
                تسجيل طالب آخر
              </button>

              <button
                onClick={() => navigate(PATHS.studentsFiles)}
                className="ms-auto flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
              >
                <FolderCheck className="h-4 w-4" />
                ملفات الطلبة
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

function StepDot({
  n,
  label,
  active,
  done,
}: {
  n: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="grid h-9 w-9 place-items-center rounded-full text-sm font-black transition"
        style={
          done
            ? { background: "rgba(134,239,172,0.18)", color: "#86efac" }
            : active
              ? { background: ACCENT, color: "#04121c" }
              : { background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }
        }
      >
        {done ? <Check className="h-4 w-4" /> : n}
      </span>
      <span
        className="text-sm font-bold"
        style={{ color: active || done ? "#fff" : "rgba(255,255,255,0.4)" }}
      >
        {label}
      </span>
    </div>
  );
}
