/**
 * الانتقال إلى كشفٍ بعينه — بمسحةِ باركود أو برابطٍ من شاشةٍ أخرى.
 *
 * الشاشات الثلاث تُبنى على سلسلةِ اختيارٍ متتابعة: سنة ← إسنادات ←
 * مرشِّحات ← كشوف الإسناد ← كشف. وكلُّ حلقةٍ تُحمَّل من الخادم بعد التي
 * قبلها، فلا يمكن ضبطُها كلَّها في نداءٍ واحد: ضبطُ المرشِّحات قبل وصول
 * الإسنادات يُسقطها لأنّ `setFilter` يُسقط ما لا إسنادَ له، وضبطُ
 * الكشف قبل وصول كشوفِ الإسناد يُلغى عند أوّل تحميل.
 *
 * فالانتقال يقع على ثلاث دفعاتٍ منتظرة: السنة أوّلاً، ثمّ المرشِّحات حين
 * تصل إسنادات تلك السنة، ثمّ الكشف حين تصل كشوف ذلك الإسناد — ثمّ
 * يُستهلَك الهدف فلا يفرض نفسه على اختيارٍ لاحق.
 *
 * وهو نفسُ ما كانت تفعله شاشةُ الحقوق للقادم من رابط `?y=&a=&s=`،
 * فاستُخرج ليخدم الثلاث ولا يُكتب ثلاثاً.
 */

import { useCallback, useEffect, useRef, useState } from "react";

import type { Assignment, Sheet, SheetFilters } from "../attendance.api";

/** ما يلزم الانتقالَ من حالة الشاشة */
interface Wiring {
  assignments: Assignment[];
  sheets: { id: string }[];
  setYearId: (id: string) => void;
  setFilters: (filters: SheetFilters) => void;
  setSheetId: (id: string) => void;
}

export function useSheetJump({
  assignments,
  sheets,
  setYearId,
  setFilters,
  setSheetId,
}: Wiring) {
  const [target, setTarget] = useState<Sheet | null>(null);

  /**
   * ما طُبِّق فعلاً — في مرجعٍ لا في حالة.
   *
   * الدفعة الثالثة يجب أن تقع **مرّةً واحدة**: لو أُعيدت كلّما تبدّلت
   * قائمةُ الكشوف (‏كشفٌ جديد يُنشأ مثلاً) لأعادت اختيارَ الكشف الممسوح
   * فوق ما اختاره المستخدم بعده. والمرجع يمنع التكرار بلا رسمةٍ زائدة.
   */
  const applied = useRef<string | null>(null);

  const jumpTo = useCallback((sheet: Sheet) => {
    /* مسحٌ جديد — ولو لنفس الكشف: يُعاد فتحُه */
    applied.current = null;
    setTarget(sheet);
  }, []);

  /* 1) السنة — وبها تُجلب إسناداتُها */
  useEffect(() => {
    if (target) setYearId(target.academicYearId);
  }, [target, setYearId]);

  /* 2) المرشِّحات — حين يصل إسنادُ الكشف ضمن إسنادات السنة */
  useEffect(() => {
    if (!target) return;

    const assignment = assignments.find((a) => a.id === target.teachingAssignmentId);
    if (!assignment) return;

    setFilters({
      stageId: assignment.studyGroup.level.educationStage.id,
      levelId: assignment.studyGroup.level.id,
      subjectId: assignment.subject.id,
      teacherId: assignment.teacher.id,
      groupId: assignment.studyGroup.id,
    });
  }, [target, assignments, setFilters]);

  /* 3) الكشف — حين تصل كشوف الإسناد */
  useEffect(() => {
    if (!target || applied.current === target.id) return;
    if (!sheets.some((s) => s.id === target.id)) return;

    applied.current = target.id;
    setSheetId(target.id);
  }, [target, sheets, setSheetId]);

  return {
    /** يبدأ الانتقال — والشاشة تتبعه دفعةً بعد دفعة */
    jumpTo,
    /**
     * ما يزال في الطريق — أي أنّ كشوف الإسناد لم تصل بعد.
     *
     * مشتقٌّ من الحالة لا من المرجع: ما إن تصل القائمة يقع الاختيار في
     * الرسمة نفسها، فلا يبقى للدوّار ما ينتظره.
     */
    jumping: target !== null && !sheets.some((s) => s.id === target.id),
  };
}
