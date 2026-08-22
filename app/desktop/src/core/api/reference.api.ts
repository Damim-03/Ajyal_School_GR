import { useQuery } from "@tanstack/react-query";
import { apiClient } from "./client";

/**
 * البيانات المرجعية للفلاتر والقوائم المنسدلة.
 *
 * تُجلب مرّة وتُخزَّن طويلاً: المواد والمستويات والأفواج تكاد لا تتغيّر
 * أثناء الجلسة، وإعادة جلبها مع كل فتح شاشة تأخير بلا فائدة.
 */

export interface Option {
  id: string;
  name: string;
  /** المعطَّل يبقى في القوائم ليُصفّى به القديم، ولا يُختار للجديد */
  isActive?: boolean;
}

const LONG = { staleTime: 10 * 60 * 1000 };

/**
 * جلبٌ يتابع الصفحات.
 *
 * سقف الخادم 100 صفاً للصفحة الواحدة. وطلبُ صفحةٍ واحدة كان يعني أنّ
 * الفوج رقم 101 لا يظهر في أي قائمة — لا رسالةَ ولا علامة، يبدو كأنّه
 * غير موجود فيُعاد إنشاؤه. فالقوائم المرجعية تُجلب كاملة أو لا تُجلب.
 */
const list = async <T extends Option>(path: string): Promise<T[]> => {
  const rows: T[] = [];
  let page = 1;

  for (;;) {
    const { data } = await apiClient.get(path, { params: { limit: 100, page } });
    rows.push(...(data.data as T[]));

    const pagination = data.pagination as { page: number; totalPages: number };
    if (!pagination || page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  return rows;
};

/** للاختيار لا للتصفية — المعطَّل لا يُسنَد إليه ولا يُسعَّر */
export const activeOnly = <T extends Option>(rows: T[] | undefined) =>
  (rows ?? []).filter((row) => row.isActive !== false);

export const useSubjects = () =>
  useQuery({ queryKey: ["ref", "subjects"], queryFn: () => list("/settings/subjects"), ...LONG });

/**
 * المستوى يحمل طورَه.
 *
 * الخادم يُرجعه أصلاً في `levelSelect`، والواجهة كانت تُهمله فتضطرّ
 * كلُّ شاشةٍ تحتاج الطور إلى طلبٍ ثانٍ لجدول الأطوار. وترتيبُ الخادم
 * `stage.sortOrder` ثمّ `level.sortOrder`، فالقائمة تصل مرتّبةً:
 * ابتدائي ثمّ متوسط ثمّ ثانوي، وداخل كلٍّ أولى فثانية فثالثة.
 */
export interface LevelOption extends Option {
  educationStage: { id: string; name: string; type: string };
}

export const useLevels = () =>
  useQuery({
    queryKey: ["ref", "levels"],
    queryFn: () => list<LevelOption>("/settings/levels"),
    ...LONG,
  });

/**
 * الأطوار المستخلَصة من المستويات — لا طلبَ ثانٍ لجدول الأطوار.
 *
 * وفائدةٌ فوق توفير الطلب: الطور الفارغ (أنشأته الإدارة ولم تضع تحته
 * مستوًى بعد) لا يظهر في القائمة. واختيارُه كان سيُفرغ قائمة المستويات
 * أمام الموظّف بلا سببٍ ظاهر.
 */
export const stagesOf = (levels: LevelOption[] | undefined) => {
  const seen = new Map<string, { id: string; name: string }>();

  for (const level of levels ?? []) {
    if (level.educationStage && !seen.has(level.educationStage.id)) {
      seen.set(level.educationStage.id, {
        id: level.educationStage.id,
        name: level.educationStage.name,
      });
    }
  }

  return [...seen.values()];
};

/**
 * الفوج لا يُعرَّف باسمه وحده.
 *
 * `@@unique([levelId, name])` — الاسم فريد داخل المستوى فقط، فـ«فوج 1»
 * موجودٌ في أولى متوسط وفي ثانية متوسط وفي ثالثة. وقائمةٌ تعرض الاسم
 * مجرّداً تضع سطرين متطابقين أمام من يُسند أستاذاً، والخطأ بينهما صامت:
 * لا يظهر إلا في جدولٍ أسبوعي أو كشف حضورٍ لفوجٍ غير المقصود.
 */
export interface GroupOption extends Option {
  level: { id: string; name: string; educationStage: { id: string; name: string } };
}

export const useStudyGroups = () =>
  useQuery({
    queryKey: ["ref", "study-groups"],
    queryFn: () => list<GroupOption>("/settings/study-groups"),
    ...LONG,
  });

/** «ثانوي · ثالثة ثانوي · فوج 1» — ما يكفي للتمييز في قائمة منسدلة */
export const groupLabel = (group: GroupOption) =>
  group.level
    ? `${group.level.educationStage.name} · ${group.level.name} · ${group.name}`
    : group.name;

/**
 * السنة الدراسية تحمل سياستها.
 *
 * `sessionsPerMonth` سقفُ حصص الشهر لكل مادة — مخزَّن على السنة لا في
 * إعدادٍ عامّ، فتغييرُه لسنةٍ جديدة لا يعيد كتابة كشوف ما مضى.
 */
export interface AcademicYear extends Option {
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  isActive: boolean;
  sessionsPerMonth: number;
}

export const useAcademicYears = () =>
  useQuery({
    queryKey: ["ref", "academic-years"],
    queryFn: async (): Promise<AcademicYear[]> => {
      const { data } = await apiClient.get("/settings/academic-years", {
        params: { limit: 100 },
      });
      return data.data as AcademicYear[];
    },
    ...LONG,
  });

export const setSessionsPerMonth = async (id: string, sessionsPerMonth: number) => {
  const { data } = await apiClient.patch(`/settings/academic-years/${id}`, {
    sessionsPerMonth,
  });
  return data.data.academicYear as AcademicYear;
};

export const useClassrooms = () =>
  useQuery({ queryKey: ["ref", "classrooms"], queryFn: () => list("/settings/classrooms"), ...LONG });

/**
 * حصص التوقيت — مقيَّدة بالسنة الدراسية، ومملوكةٌ لأستاذ أو عامّة.
 *
 * عدد الحصص سياسةُ سنةٍ بعينها منذ أن رُبط `LessonSlot` بـ`AcademicYear`،
 * فجلبها بلا سنة يخلط ثماني حصصِ سنةٍ بعشرِ سنةٍ أخرى في جدول واحد.
 *
 * و`teacher` صاحبُ الفترة — وفارغُه فترةٌ عامّة للمؤسسة. في مركز الدعم
 * لا جدولَ موحَّد: تُدرَّس العلوم من 08:00 إلى 10:00 وتُدرَّس الفيزياء
 * في الوقت نفسه، كلٌّ عند أستاذها.
 */
export interface LessonSlot {
  id: string;
  name: string;
  order: number;
  startTime: string;
  endTime: string;
  isActive: boolean;
  academicYearId: string;
  teacherId: string | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
}

/**
 * إنشاء فترةٍ لأستاذ.
 *
 * تستدعيه شبكةُ الجدول حين يُضاف درسٌ إلى مجالٍ زمني لا فترةَ للأستاذ
 * فيه: المجال قائمٌ عند زملائه، وفترتُه هو تفصيلٌ داخليّ لا يُطلب من
 * المستخدم أن يُنشئه في شاشةٍ أخرى ثم يعود.
 */
export const createLessonSlot = async (body: {
  academicYearId: string;
  teacherId?: string;
  name: string;
  startTime: string;
  endTime: string;
}) => {
  const { data } = await apiClient.post("/settings/lesson-slots", body);
  return data.data.lessonSlot as LessonSlot;
};

/**
 * الترتيب بالوقت لا بـ `order`.
 *
 * `order` رقمٌ داخل أوقات صاحب الفترة، فـ«الأولى» عند أستاذَين رقمٌ
 * واحد لوقتين مختلفين. والفرزُ به يُقحم فترة الثامنة بين فترتَي
 * العاشرة والثانية عشرة. أمّا الوقت فصادقٌ عند الجميع — والمتساويان
 * فيه يتجاوران، وهو المطلوب: الحصص المتوازية سطرٌ تحت سطر.
 */
const byTime = (a: LessonSlot, b: LessonSlot) =>
  a.startTime.localeCompare(b.startTime) ||
  a.endTime.localeCompare(b.endTime) ||
  a.order - b.order;

export const useLessonSlots = (academicYearId: string | undefined) =>
  useQuery({
    queryKey: ["ref", "lesson-slots", academicYearId],
    enabled: Boolean(academicYearId),
    queryFn: async (): Promise<LessonSlot[]> => {
      /* بالصفحات: صارت الفترات فترةَ كلِّ أستاذٍ على حدة، فعددُها
         يتضاعف بعدد الأساتذة ويتجاوز المئة بسهولة — وفترةٌ غائبة عن
         الشبكة تعني جدولاً ناقصاً بلا علامة. */
      const rows: LessonSlot[] = [];
      let page = 1;

      for (;;) {
        const { data } = await apiClient.get("/settings/lesson-slots", {
          params: { academicYearId, limit: 100, page },
        });

        rows.push(...(data.data as LessonSlot[]));

        const pagination = data.pagination as { page: number; totalPages: number };
        if (!pagination || page >= pagination.totalPages || pagination.totalPages === 0) break;
        page++;
      }

      return rows.sort(byTime);
    },
    ...LONG,
  });

// --------------------------------------------------
// الإسناد التدريسي
//
// أستاذ + مادة + فوج + سنة. تقرؤه شاشتان على الأقل — الجدول الأسبوعي
// وكشوف الحضور — وكلتاهما تشتقّ منه قوائم التصفية نفسها، فمحلّه هنا
// لا في إحداهما.
// --------------------------------------------------

export interface Assignment {
  id: string;
  isActive: boolean;
  teacher: { id: string; firstName: string; lastName: string; isActive: boolean };
  subject: {
    id: string;
    name: string;
    code: string | null;
    /** لونُ المادة وصورتُها — تُعرضان في مربّعات شاشة إسناد الطلبة */
    color: string | null;
    imagePath: string | null;
  };
  studyGroup: {
    id: string;
    name: string;
    type: string;
    level: {
      id: string;
      name: string;
      educationStage: { id: string; name: string };
    };
  };
  academicYear: { id: string; name: string; isCurrent: boolean };
}

/**
 * كل إسنادات السنة — بصفحاتها.
 *
 * الحدّ الأقصى للصفحة 100 على الخادم، ومركزٌ متوسّط يتجاوزها. فالجلب
 * يتابع حتى آخر صفحة: قائمة تصفية ناقصة أسوأ من انتظار طلبٍ ثانٍ،
 * لأنّ الأستاذ الغائب عنها يبدو غير موجود.
 */
export const listAssignments = async (academicYearId: string) => {
  const rows: Assignment[] = [];
  let page = 1;

  for (;;) {
    const { data } = await apiClient.get("/teaching-assignments", {
      params: { academicYearId, limit: 100, page },
    });

    rows.push(...(data.data as Assignment[]));

    const pagination = data.pagination as { page: number; totalPages: number };
    if (page >= pagination.totalPages || pagination.totalPages === 0) break;
    page++;
  }

  return rows;
};

export const useAssignments = (academicYearId: string | undefined) =>
  useQuery({
    queryKey: ["ref", "assignments", academicYearId],
    enabled: Boolean(academicYearId),
    queryFn: () => listAssignments(academicYearId!),
    ...LONG,
  });

/**
 * حقّ الاشتراك الساري اليوم لهذا (مادة + فوج) — أو `null`.
 *
 * الإسنادُ بلا سعرٍ يمرّ صامتاً، ولا يظهر العطب إلا عند توليد الفاتورة:
 * الخادم يرفض بـ«No active tuition fee» بعد أن يكون الطالب سُجّل ودَرَس.
 * فالسؤال يُطرح هنا — قبل الإسناد — لا هناك.
 */
export const findActiveFee = async (subjectId: string, studyGroupId: string) => {
  const { data } = await apiClient.get("/settings/tuition-fees", {
    params: {
      subjectId,
      studyGroupId,
      isActive: "true",
      effectiveOn: new Date().toISOString().slice(0, 10),
      limit: 1,
    },
  });

  const fees = data.data as { id: string; amount: string | number }[];
  return fees.length > 0 ? Number(fees[0].amount) : null;
};

/** «اللقب الاسم» — الترتيب المعتمد في الكشوف والقوائم */
export const fullName = (p: { firstName: string; lastName: string }) =>
  `${p.lastName} ${p.firstName}`.trim();
