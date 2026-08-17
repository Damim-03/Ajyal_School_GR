import { useCallback, useState } from "react";
import { Check, CheckCircle2, FolderCheck, UserPlus } from "lucide-react";

import { Avatar } from "../../components/shared/Avatar";
import { FormDialog } from "../../components/shared/FormDialog";
import { DocumentsPanel } from "./DocumentsPanel";
import { StudentFields } from "./StudentFields";
import { createStudent, type Student, type StudentInput } from "./student.api";

const ACCENT = "#7dd3fc";
const FORM_ID = "student-register-form";

/**
 * تسجيل طالب جديد — خطوتان في نافذةٍ واحدة.
 *
 * الفصل ليس تجميلاً: رفع الوثائق **يحتاج معرّف الطالب** (المسار
 * ‏`/students/:id/documents`)، فلا سبيل لرفعها قبل حفظ المعلومات.
 * وعرضُ الخانتين معاً كان سيُظهر خانات رفعٍ لا تعمل.
 *
 * ولذلك الخطوة الأولى تنتهي بحفظٍ حقيقي: الطالب موجود قبل الخطوة
 * الثانية، فإن انصرف المستخدم بقي مسجَّلاً بملفٍّ ناقص — وهي حالة
 * صحيحة تعرضها شاشة «ملفات الطلبة» صراحةً. ولهذا يختفي زرّ «إلغاء»
 * في الخطوة الثانية: لم يعد هناك ما يُلغى، والإبقاء عليه يوهم أنّ
 * الضغط عليه يمحو ما حُفظ.
 *
 * وكانت صفحةً كاملة بمسارٍ خاص، فصارت نافذةً مركزية كبقية النماذج —
 * ومسارُها باقٍ يعرضها فوق خلفية التطبيق، فلا ينكسر رابطٌ ولا بطاقة.
 */
export function StudentRegisterDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  /** يُنادى بعد إنشاء الطالب — لتُنعش القائمةُ خلف النافذة */
  onSaved?: (student: Student) => void;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [created, setCreated] = useState<Student | null>(null);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(false);

  /* مرجعٌ ثابت — دالّةٌ جديدة كل رسمة تُعيد تشغيل أثر التحقّق بلا داعٍ */
  const onValidityChange = useCallback((ok: boolean) => setValid(ok), []);

  const save = async (payload: StudentInput) => {
    setBusy(true);
    setError(null);

    try {
      const student = await createStudent(payload);
      setCreated(student);
      setStep(2);
      onSaved?.(student);
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

  /** يبدأ تسجيلاً جديداً في النافذة نفسها — الموظّف يسجّل دفعةً من الطلبة */
  const again = () => {
    setCreated(null);
    setComplete(false);
    setError(null);
    setStep(1);
  };

  return (
    <FormDialog
      icon={step === 1 ? UserPlus : FolderCheck}
      title="تسجيل طالب جديد"
      subtitle="المعلومات ثمّ الوثائق"
      tone={ACCENT}
      onClose={onClose}
      /* الخطوة الأولى تُرسل حقولَ الطالب، والثانية زرُّها إنهاءٌ لا حفظ */
      submitForm={step === 1 ? FORM_ID : undefined}
      onSubmit={step === 2 ? (e) => { e.preventDefault(); onClose(); } : undefined}
      busy={busy}
      submitDisabled={step === 1 && !valid}
      submitLabel={step === 1 ? "حفظ ومتابعة إلى الوثائق" : "إنهاء التسجيل"}
      submitIcon={
        step === 1 ? <UserPlus className="h-4.5 w-4.5" /> : <Check className="h-4.5 w-4.5" />
      }
      hideCancel={step === 2}
      error={error}
      footerExtra={
        step === 2 ? (
          <button
            type="button"
            onClick={again}
            className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
          >
            <UserPlus className="h-4 w-4" />
            تسجيل طالب آخر
          </button>
        ) : undefined
      }
      headerExtra={<Steps step={step} complete={complete} />}
    >
      {step === 1 && (
        <StudentFields
          onSubmit={save}
          busy={busy}
          error={error}
          formId={FORM_ID}
          onValidityChange={onValidityChange}
        />
      )}

      {step === 2 && created && (
        <div className="space-y-5">
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

          <DocumentsPanel
            studentId={created.id}
            onChange={(file) => setComplete(file.completeness.isComplete)}
          />
        </div>
      )}
    </FormDialog>
  );
}

/** مؤشّر الخطوتين — ثابتٌ تحت الترويسة لا يتمرّر مع الحقول */
function Steps({ step, complete }: { step: 1 | 2; complete: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Dot n={1} label="المعلومات" active={step === 1} done={step > 1} />
      <div
        className="h-0.5 flex-1 rounded"
        style={{ background: step > 1 ? ACCENT : "rgba(255,255,255,0.1)" }}
      />
      <Dot n={2} label="الوثائق" active={step === 2} done={complete} />
    </div>
  );
}

function Dot({
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
