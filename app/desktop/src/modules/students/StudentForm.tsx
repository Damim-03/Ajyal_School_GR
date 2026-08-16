import { useState } from "react";
import { motion } from "motion/react";
import { Save, X } from "lucide-react";

import { Avatar } from "../../components/shared/Avatar";
import { MOTION } from "../../motion/system";
import { StudentFields } from "./StudentFields";
import {
  createStudent,
  updateStudent,
  type Student,
  type StudentInput,
} from "./student.api";

const ACCENT = "#7dd3fc";

/**
 * لوحة تحرير الطالب — للتعديل السريع من القائمة.
 *
 * التسجيل الكامل له معالجه (StudentWizardPage) لأنّه ينتهي برفع
 * الوثائق. وهذه اللوحة تحرّر المعلومات وحدها **دون مغادرة الجدول**:
 * بعد الحفظ يعود المستخدم إلى صفٍّ في مكانه لا إلى شاشةٍ فقد موضعه فيها.
 *
 * ⚠️ بلا AnimatePresence عمداً — انظر التعليق في StudentsPage.
 */
export function StudentForm({
  student,
  onClose,
  onSaved,
}: {
  student: Student | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const editing = !!student;

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (payload: StudentInput) => {
    setBusy(true);
    setError(null);

    try {
      if (editing) await updateStudent(student!.id, payload);
      else await createStudent(payload);

      onSaved();
    } catch (err: unknown) {
      const response = (err as {
        response?: { data?: { message?: string; errors?: { message: string }[] } };
      }).response;

      setError(
        response?.data?.errors?.[0]?.message ??
          response?.data?.message ??
          "تعذّر الحفظ",
      );
    } finally {
      setBusy(false);
    }
  };

  const name = student
    ? `${student.firstName} ${student.lastName}`
    : "طالب جديد";

  return (
    <div className="fixed inset-0 z-40">
      <div
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />

      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: MOTION.duration.normal, ease: MOTION.easing.enter }}
        className="absolute inset-y-0 start-0 z-50 flex w-full max-w-137 flex-col border-e border-white/10 bg-[#0a0f1a]"
      >
        <header className="flex items-center gap-3 border-b border-white/10 px-6 py-5">
          <Avatar src={student?.avatar} name={name} gender={student?.gender} size={44} ring={ACCENT} />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-black">
              {editing ? "تعديل طالب" : "طالب جديد"}
            </h2>
            <p className="truncate text-xs text-white/50">{name}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StudentFields
            student={student}
            onSubmit={save}
            busy={busy}
            error={error}
            submitLabel={editing ? "حفظ التعديل" : "إضافة الطالب"}
            submitIcon={<Save className="h-4.5 w-4.5" />}
            footerExtra={
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl bg-white/10 px-5 py-3 text-sm font-bold transition hover:bg-white/20"
              >
                إلغاء
              </button>
            }
          />
        </div>
      </motion.div>
    </div>
  );
}
