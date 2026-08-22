/**
 * طبقتا «المادة» و«الفوج» — بناءُ بياناتِهما من الإسنادات التدريسية.
 *
 * شاشتان تعرضان الشيء نفسه بترتيبٍ واحد: الإسنادُ يبدأ من المادة ثمّ
 * الفوج ثمّ طلبتُه، والنقلُ كذلك — إلّا أنّ آخره «انقل» لا «أسنِد».
 * فما بينهما مشترَكٌ يُكتب مرّة: التجميعُ هنا، والمرشِّحات في
 * `assignment-filters`، والمربّعات في `layers`.
 *
 * ولو نُسخ لتخلّفت إحداهما عن إصلاحٍ وقع في أختها — كصورةِ المادة:
 * أُضيفت في الإسناد، ولولا هذا الملفّ لبقي النقلُ بأيقونةٍ رمادية.
 */

import type { Assignment } from "./enrollments.api";

/** مادّةٌ مُجمَّعةٌ من إسناداتها — بوجهها وأفواجها وأساتذتها */
export interface SubjectCardData {
  id: string;
  name: string;
  image: string | null;
  color: string | null;
  groups: Assignment[];
  teachers: Set<string>;
}

/** يجمع الإسنادات في موادَّ مرتَّبةً أبجدياً */
export const buildSubjectCards = (assignments: Assignment[]): SubjectCardData[] => {
  const map = new Map<string, SubjectCardData>();

  for (const a of assignments) {
    const at =
      map.get(a.subject.id) ??
      {
        id: a.subject.id,
        name: a.subject.name,
        image: a.subject.imagePath,
        color: a.subject.color,
        groups: [],
        teachers: new Set<string>(),
      };

    at.groups.push(a);
    at.teachers.add(a.teacher.id);
    map.set(a.subject.id, at);
  }

  return [...map.values()].sort((x, y) => x.name.localeCompare(y.name, "ar"));
};
