import { useCallback, useState } from "react";
import { Save, UserPen } from "lucide-react";

import { FormDialog } from "../../components/shared/FormDialog";
import { StudentFields } from "./StudentFields";
import { updateStudent, type Student, type StudentInput } from "./student.api";

const ACCENT = "#7dd3fc";

/**
 * نافذة تحرير الطالب — للتعديل السريع من القائمة ومن ملفّه.
 *
 * **تعديلٌ لا إنشاء**: التسجيل يمرّ بخطوتين لأنّه ينتهي برفع الوثائق،
 * وله `StudentRegisterDialog`. وكان هذا المكوّن يحمل الفرعين معاً، فبقي
 * فرعُ الإنشاء فيه بعد أن صار التسجيل بخطوتين — طريقٌ ثانٍ يُنشئ طالباً
 * بلا وثائق ولا خطوة ثانية، ويفترق سلوكُه عن الطريق المقصود بلا أن يظهر.
 *
 * والتعديل يجري **دون مغادرة الجدول**: بعد الحفظ يعود المستخدم إلى صفٍّ
 * في مكانه لا إلى شاشةٍ فقد موضعه فيها.
 *
 * وكانت درجاً ينزلق من الجانب بعرض 34rem، فتصطفّ فيه أحد عشر حقلاً
 * عموداً واحداً يتجاوز ارتفاع الشاشة — يُحفظ الطالب وحقلٌ لم يُرَ.
 * صارت نافذةً في الوسط بعمودين كبقية نماذج النظام.
 *
 * ⚠️ بلا AnimatePresence عمداً — انظر التعليق في StudentsPage.
 */
export function StudentForm({
  student,
  onClose,
  onSaved,
}: {
  student: Student;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [valid, setValid] = useState(false);

  /* مرجعٌ ثابت — دالّةٌ جديدة كل رسمة تُعيد تشغيل أثر التحقّق بلا داعٍ */
  const onValidityChange = useCallback((ok: boolean) => setValid(ok), []);

  const save = async (payload: StudentInput) => {
    setBusy(true);
    setError(null);

    try {
      await updateStudent(student.id, payload);
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

  return (
    <FormDialog
      icon={UserPen}
      title="تعديل طالب"
      subtitle={`${student.firstName} ${student.lastName}`}
      tone={ACCENT}
      onClose={onClose}
      /* الحقول مكوّنٌ مشترك يحمل `<form>` الخاصّ به — فالزرّ يُشير إليه */
      submitForm={FORM_ID}
      busy={busy}
      submitDisabled={!valid}
      submitLabel="حفظ التعديل"
      submitIcon={<Save className="h-4.5 w-4.5" />}
      error={error}
    >
      <StudentFields
        student={student}
        onSubmit={save}
        busy={busy}
        error={error}
        formId={FORM_ID}
        onValidityChange={onValidityChange}
      />
    </FormDialog>
  );
}

const FORM_ID = "student-form";
