/**
 * الاستئنافُ بعد الانقطاع (§26/§27).
 *
 * **والحقيقةُ في الخادم لا هنا.** هذا الملفُّ لا يحفظ خطوةً ولا
 * يستعيدها — الخادمُ يفعل. وما فيه أمران لا يصلحان إلّا في الجهاز:
 *
 *   ① *مسوّدةُ نموذجٍ* لم تُرسَل بعد. المستخدمُ يكتب اسمَ مؤسسته
 *      وعنوانَها ثمّ ينقطع التيّار — والخادمُ لا يعلم بشيءٍ لم يصله.
 *      وإعادةُ الكتابة من الصفر عقوبةٌ على انقطاعٍ لا ذنبَ له فيه.
 *
 *   ② *معرفةُ أنّ هذه عودةٌ لا بداية* — فتقول الشاشةُ «أهلاً بعودتك»
 *      بدل أن تبدأ من حيث لا يذكر المستخدمُ أين وقف.
 *
 * **ولا كلمةَ مرورٍ في المسوّدات أبداً.** حقولُ المدير تُستثنى كلُّها
 * صراحةً أدناه، فلا تُكتب في `localStorage` بحالٍ (§38).
 */

const DRAFT_PREFIX = "nexschool_boot_draft:";
const VISITED_KEY = "nexschool_boot_visited";

/**
 * الخطواتُ التي لا تُحفظ مسوّداتُها.
 *
 * والمديرُ منها لأنّ نموذجَه يحمل كلمةَ مرور. ولا يُكتفى بحذف الحقل:
 * قائمةُ منعٍ على مستوى الخطوة أمتنُ من مرشِّحِ حقولٍ يُنسى فيه واحدٌ
 * حين يُضاف.
 */
const NEVER_DRAFTED = new Set(["ADMINISTRATOR"]);

export const saveDraft = (step: string, value: unknown) => {
  if (NEVER_DRAFTED.has(step)) return;

  try {
    localStorage.setItem(`${DRAFT_PREFIX}${step}`, JSON.stringify(value));
  } catch {
    /* تخزينٌ ممنوع — تضيع المسوّدةُ ولا يضيع شيءٌ آخر */
  }
};

export const readDraft = <T>(step: string): T | null => {
  if (NEVER_DRAFTED.has(step)) return null;

  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${step}`);

    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const clearDraft = (step: string) => {
  try {
    localStorage.removeItem(`${DRAFT_PREFIX}${step}`);
  } catch {
    /* لا شيء يُفعل */
  }
};

/**
 * تُنادى عند الإتمام: المسوّداتُ كلُّها تُمحى.
 *
 * وتركُها كان سيعني بقاءَ اسمِ المؤسسة وهاتفِها في تخزين المتصفّح
 * إلى الأبد بعد أن صارت في القاعدة — نسخةٌ ثانيةٌ لا يقرؤها أحد
 * ولا يعلم بها أحد.
 */
export const clearAllDrafts = () => {
  try {
    const keys: string[] = [];

    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(DRAFT_PREFIX)) keys.push(key);
    }

    for (const key of keys) localStorage.removeItem(key);
    localStorage.removeItem(VISITED_KEY);
  } catch {
    /* لا شيء يُفعل */
  }
};

/** هل مرّ هذا الجهازُ بالتهيئة من قبلُ في جلسةٍ سابقة؟ (§3) */
export const hasVisited = (): boolean => {
  try {
    return localStorage.getItem(VISITED_KEY) === "1";
  } catch {
    return false;
  }
};

export const markVisited = () => {
  try {
    localStorage.setItem(VISITED_KEY, "1");
  } catch {
    /* لا شيء يُفعل */
  }
};
