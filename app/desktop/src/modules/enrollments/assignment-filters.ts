/**
 * مرشِّحات الإسنادات — حالةٌ واحدةٌ تخدم شاشتَي الإسناد والنقل.
 *
 * وفيها قاعدةٌ لا تُرى في التوقيع: **تغييرُ مرشِّحٍ يُسقط ما تعارض
 * معه فقط**. فمن اختار الأستاذَ ثمّ بدّل المادة يبقى أستاذُه إن كان
 * يدرّسها ويسقط إن لم يكن — بدل تصفيرِ ما بعده كلِّه، وهو ما يُجبر
 * المستخدم على إعادة اختيارٍ لم يتغيّر.
 */

import { useCallback, useMemo, useState } from "react";

import { deriveOptions, type SheetFilters } from "../attendance/attendance.api";
import type { Assignment } from "./enrollments.api";

export const EMPTY_FILTERS: SheetFilters = {
  stageId: "",
  levelId: "",
  subjectId: "",
  teacherId: "",
  groupId: "",
};

const matches = (a: Assignment, f: SheetFilters) =>
  (!f.stageId || a.studyGroup.level.educationStage.id === f.stageId) &&
  (!f.levelId || a.studyGroup.level.id === f.levelId) &&
  (!f.subjectId || a.subject.id === f.subjectId) &&
  (!f.teacherId || a.teacher.id === f.teacherId) &&
  (!f.groupId || a.studyGroup.id === f.groupId);

export function useAssignmentFilters(assignments: Assignment[]) {
  const [filters, setFilters] = useState<SheetFilters>(EMPTY_FILTERS);

  const options = useMemo(
    () => deriveOptions(assignments, filters),
    [assignments, filters],
  );

  const visible = useMemo(
    () => assignments.filter((a) => matches(a, filters)),
    [assignments, filters],
  );

  /*
   * الدالّتان ثابتتان بـ`useCallback` — لا تجميلاً بل لأنّ الشاشات
   * تضعهما في تبعيّات `useEffect`. ولو تجدّدتا في كلّ رسمة لأعادت
   * كلُّ رسمةٍ جلبَ الإسنادات، أو لاضطُرّت الشاشة إلى إسكات القاعدة
   * بتعليق — وإسكاتُها يُخفي التبعيّة التالية التي تُنسى حقّاً.
   */
  const setFilter = useCallback((key: keyof SheetFilters, value: string) => {
    setFilters((prev) => {
      let next = { ...prev, [key]: value };
      const others = (Object.keys(EMPTY_FILTERS) as (keyof SheetFilters)[]).filter(
        (k) => k !== key,
      );

      while (!assignments.some((a) => matches(a, next))) {
        const drop = [...others].reverse().find((k) => next[k]);
        if (!drop) break;
        next = { ...next, [drop]: "" };
      }

      return next;
    });
  }, [assignments]);

  const reset = useCallback(() => setFilters(EMPTY_FILTERS), []);

  return { filters, setFilter, reset, options, visible };
}
