/**
 * العربية — **القاموسُ المرجع**.
 *
 * منه يُشتقّ نوعُ القواميس الأخرى (`type Dict = typeof ar`)، فمفتاحٌ
 * يُضاف هنا ولا يُضاف في الإنجليزية أو الفرنسية يرفضه المصرِّف. وهذا
 * هو البديلُ عن ملفّات JSON المتفرّقة التي تفترق بصمتٍ عن بعضها حتى
 * يظهر مفتاحٌ خامٌ في الشاشة.
 *
 * والوصولُ بالنقطة لا بمسارٍ نصّيّ: `t.language.title` لا
 * `t("language.title")` — فالخطأُ المطبعيُّ يظهر عند الكتابة لا عند
 * العرض، ولا حاجةَ إلى تحليل مسارٍ زمنَ التشغيل.
 */

export const ar = {
  meta: { dir: "rtl" as "rtl" | "ltr", label: "العربية", locale: "ar-DZ" },

  common: {
    continue: "متابعة",
    back: "رجوع",
    retry: "إعادة المحاولة",
    notNow: "ليس الآن",
    saving: "جارٍ الحفظ…",
    step: "الخطوة",
    of: "من",
    optional: "اختياري",
    required: "مطلوب",
    detected: "متوفّر",
    notDetected: "غير متوفّر",
    yes: "نعم",
    no: "لا",
    enabled: "مُفعَّل",
    disabled: "مُعطَّل",
    eyebrow: "التهيئة الأولى",
    resuming: "متابعةُ التهيئة",
    welcomeBack: "أهلاً بعودتك",
  },

  booting: {
    title: "NexSchool",
    checking: "التحقّق من حالة النظام…",
    offline: "تعذّر الوصول إلى الخادم",
    offlineHint:
      "تأكّد من أنّ خادم NexSchool يعمل، ثمّ أعِد المحاولة.",
  },

  welcome: {
    title: "مرحباً",
    lead: "لنُهيّئ نظامك.",
    body: "بضعُ خطواتٍ قصيرة، ثمّ يصير NexSchool جاهزاً للعمل.",
    action: "لنبدأ",
  },

  language: {
    title: "اختر لغتك",
    description: "اللغةُ التي يتحدّث بها NexSchool.",
  },

  region: {
    title: "المنطقة والوقت",
    description: "يضبط بها NexSchool تواريخَه ومواقيتَه.",
    country: "الدولة",
    timezone: "المنطقة الزمنية",
    dateFormat: "شكل التاريخ",
    now: "الآن عندك",
    detected: "مأخوذٌ من نظام التشغيل — بدّله إن شئت",
  },

  network: {
    title: "الشبكة",
    description: "أين يعمل خادمُ NexSchool؟",
    local: "محلّي",
    localHint: "الخادمُ وقاعدةُ البيانات على هذا الجهاز.",
    server: "خادمٌ على الشبكة",
    serverHint: "جهازٌ آخرُ في المؤسسة يحمل الخادمَ والقاعدة.",
    host: "عنوان الخادم",
    port: "المنفذ",
    test: "فحص الاتصال",
    testing: "جارٍ الفحص…",
    database: "قاعدة البيانات",
    schema: "بنية القاعدة",
    auth: "خدمة المصادقة",
    reachable: "متّصل",
    unreachable: "لا يستجيب",
    failed: "تعذّر بلوغُ الخادم على هذا العنوان.",
    internetOptional:
      "الإنترنت غيرُ مطلوب — يعمل NexSchool داخل شبكة المؤسسة.",
    /* حالةُ الإنترنت — تُقاس ولا تُفترض */
    internet: "اتصال هذا الجهاز بالإنترنت",
    internetChecking: "جارٍ الفحص…",
    internetOnline: "متّصل",
    internetOffline: "بلا إنترنت",
    internetOnlineHint:
      "هذا الجهاز يبلغ الإنترنت. ولا يحتاجه NexSchool — يعمل داخل شبكتكم على أيّ حال.",
    internetOfflineHint:
      "هذا الجهاز لا يبلغ الإنترنت — ولا يضرّ. يعمل NexSchool كاملاً داخل شبكة المؤسسة.",
    internetRecheck: "أعد الفحص",
  },

  display: {
    title: "العرض",
    description: "اضبط NexSchool على شاشتك.",
    scale: "مقياس الواجهة",
    small: "صغير",
    default: "افتراضي",
    large: "كبير",
    density: "الكثافة",
    comfortable: "مريحة",
    compact: "مضغوطة",
    window: "النافذة",
    windowed: "نافذة",
    maximized: "مكبَّرة",
    fullscreen: "ملء الشاشة",
    preview: "معاينة",
    previewTitle: "الطلبة",
    previewRow: "فوجُ الثالثة — رياضيات",
    previewHint: "هكذا تبدو الشاشاتُ بهذا الاختيار.",
  },

  performance: {
    title: "الأداء",
    description: "كيف يتصرّف NexSchool في الخلفية؟",
    balanced: "متوازن",
    balancedHint: "الأنسبُ لأغلب الأجهزة.",
    performance: "أداء",
    performanceHint: "تحديثٌ أسرعُ للبيانات واستجابةٌ كاملة.",
    powerSaving: "توفير الطاقة",
    powerSavingHint: "نشاطٌ أقلُّ في الخلفية وحركةٌ أهدأ.",
    refresh: "تحديث البيانات",
    motion: "الحركة",
    minute: "كل دقيقة",
    fiveMinutes: "كل خمس دقائق",
    quarterHour: "كل ربع ساعة",
    full: "كاملة",
    calm: "هادئة",
    still: "ساكنة",
  },

  terms: {
    title: "شروط الاستعمال",
    description: "اقرأ ثمّ وافق للمتابعة.",
    agree: "أوافق على الشروط.",
    action: "أوافق وأتابع",
    version: "النسخة",
    tabs: { terms: "الشروط", privacy: "الخصوصية", license: "الرخصة" },
  },

  update: {
    title: "تحديث NexSchool",
    checking: "البحث عن تحديثات…",
    upToDate: "النظامُ محدَّث.",
    notConfigured: "التحديثُ التلقائيُّ غيرُ مُعدٍّ في هذا التركيب.",
    notConfiguredHint:
      "تُثبَّت التحديثاتُ يدوياً من المزوّد. لا يمنع هذا إتمامَ التهيئة.",
    appVersion: "نسخةُ التطبيق",
    serverVersion: "نسخةُ الخادم",
    mismatch: "نسخةُ التطبيق تختلف عن نسخة الخادم.",
    mismatchHint:
      "قد تعمل بعضُ الشاشاتِ خطأً. يُنصح بتوحيد النسختين قبل الاستعمال.",
    recheck: "إعادة الفحص",
    available: "يتوفّر تحديث",
    installing: "جارٍ التثبيت…",
    doNotClose: "لا تُغلق NexSchool.",
    restart: "يحتاج NexSchool إلى إعادة تشغيلٍ لإتمام التحديث.",
  },

  devices: {
    title: "الأجهزة",
    description: "لنتعرّف على ما هو موصولٌ بهذا الجهاز.",
    searching: "جارٍ البحث…",
    none: "لا أجهزةَ متوافقةٌ مكتشفة — وهذا ليس خطأً.",
    keyboard: "لوحة المفاتيح",
    pointer: "الفأرة",
    documentPrinter: "طابعةُ وثائق",
    receiptPrinter: "طابعةُ إيصالات",
    scanner: "الماسح الضوئي",
    barcode: "قارئُ الباركود",
    pressAnyKey: "اضغط أيّ مفتاحٍ للتأكيد",
    moveMouse: "حرّك الفأرة للتأكيد",
    testPrint: "طبعةُ اختبار",
    testScan: "امسح رمزاً للتجربة",
    scanned: "قُرئ:",
    verified: "مؤكَّد",
    rescan: "إعادة البحث",
    optionalNote:
      "الأجهزةُ الاختياريةُ تُضبط لاحقاً من الإعدادات — لا تؤخّر التهيئة.",
    browserNote:
      "اكتشافُ الطابعات والماسح يعمل في تطبيق سطح المكتب فقط.",
  },

  administrator: {
    title: "المدير",
    description: "أنشئ الحسابَ الرئيسيَّ لهذا التركيب.",
    firstName: "الاسم",
    lastName: "اللقب",
    username: "اسم الدخول",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    confirm: "تأكيد كلمة المرور",
    action: "إنشاء الحساب",
    rules: {
      length: "عشرةُ محارفَ فأكثر",
      upper: "حرفٌ كبير",
      lower: "حرفٌ صغير",
      digit: "رقم",
      symbol: "رمزٌ خاصّ",
      match: "الكلمتان متطابقتان",
    },
    usernameHint: "حروفٌ لاتينيةٌ وأرقامٌ و . _ - فقط",
    taken: "اسمُ الدخول محجوز — اختر غيرَه.",
    role: "الدور: مدير النظام — صلاحياتٌ كاملة",
  },

  institution: {
    title: "مؤسستك",
    description: "الاسمُ الذي يظهر في الترويسة وعلى كلّ مطبوعة.",
    name: "اسم المؤسسة",
    shortName: "الاسم المختصر",
    nameEn: "الاسم باللاتينية",
    phone: "الهاتف",
    email: "البريد الإلكتروني",
    address: "العنوان",
    logo: "الشعار",
    logoAction: "اختيار صورة",
    logoRemove: "إزالة",
    logoHint: "PNG أو JPG — يمكن إضافتُه لاحقاً.",
    later: "المواد والأساتذة والأفواج تأتي بعد التهيئة.",
  },

  academicYear: {
    title: "السنة الدراسية",
    description: "السنةُ الجاريةُ التي تُقيَّد عليها الحصصُ والحقوق.",
    name: "السنة",
    start: "البداية",
    end: "النهاية",
    sessions: "الحصص في الشهر",
    sessionsHint: "سقفُ كشف الحضور لكلّ مادة.",
    why: "تعتمد عليها الكشوفُ والفواتيرُ والتخليص — فلا يبدأ العملُ بدونها.",
  },

  privacy: {
    title: "الخصوصية",
    description: "ما الذي يخرج من هذا الجهاز؟ لا شيء.",
    noTelemetry: "لا إحصاءاتِ استعمال",
    noTelemetryHint:
      "لا يرسل NexSchool أيَّ بياناتٍ إلى خارج شبكة مؤسستك — لا اليوم ولا في الخلفية.",
    noCrash: "لا تقاريرَ أعطالٍ خارجية",
    noCrashHint: "لا تُرفع الأعطالُ إلى أيّ خادمٍ بعيد.",
    diagnostics: "سِجلُّ الأعطال المحلّي",
    diagnosticsHint:
      "يحفظ آخرَ الأخطاء في هذا الجهاز وحده، فيُقرأ عند حدوث عطبٍ يصعب وصفُه. يُحذف بضغطة.",
  },

  recovery: {
    title: "الاسترجاع",
    description: "رقمُ هاتفٍ لجهة اتصال المؤسسة.",
    phone: "رقم الهاتف",
    hint: "يُستعمل مرجعاً لجهة الاتصال — لا تُرسَل إليه رسائلُ من النظام.",
    optional: "اختياري — يمكن إضافتُه لاحقاً من الإعدادات.",
  },

  verification: {
    title: "أوشكنا.",
    running: "التحقّق من النظام…",
    okTitle: "كلُّ شيءٍ في موضعه.",
    failedTitle: "لا يمكن إتمامُ التهيئة.",
    failedLead: "ينقص ما يلي:",
    action: "إتمام التهيئة",
    fix: "معالجة",
    checks: {
      database: "الاتصال بقاعدة البيانات",
      schema: "بنيةُ قاعدة البيانات",
      language: "اللغة",
      region: "المنطقة والتوقيت",
      institution: "هويةُ المؤسسة",
      administrator: "حسابُ المدير",
      role: "الدور",
      permissions: "الصلاحيات",
      terms: "الموافقةُ على الشروط",
      academicYear: "السنةُ الدراسية",
      devices: "إعدادُ الأجهزة",
      appVersion: "نسخةُ التطبيق",
    },
  },

  ready: {
    title: "أنت جاهز.",
    lead: "مساحةُ عملك جاهزةٌ للاستعمال.",
    action: "ادخل إلى NexSchool",
  },

  errors: {
    generic: "تعذّر حفظُ إعداداتك.",
    network: "تعذّر بلوغُ الخادم.",
    outOfOrder: "تغيّرت حالةُ التهيئة — أُعيدت قراءتُها.",
    alreadyCompleted: "التهيئةُ مكتملةٌ بالفعل.",
    deviceMissing: "جهازٌ مطلوبٌ غيرُ متوفّر.",
    verificationFailed: "التحقّق النهائيُّ لم يمرّ.",
    tryAgain: "أعد المحاولة.",
  },

  onboarding: {
    title: "أهلاً بك في NexSchool",
    lead: "نظامُك جاهز. لنبنِ الآن مؤسستك.",
    progress: "تقدّمُ بناء المؤسسة",
    continueSetup: "متابعة الإعداد",
    explore: "استكشاف NexSchool",
    dismiss: "إخفاء هذه اللوحة",
    areas: {
      stages: "الأطوار",
      levels: "المستويات",
      subjects: "المواد",
      teachers: "الأساتذة",
      groups: "الأفواج",
      classrooms: "القاعات",
      schedules: "الجداول",
      fees: "حقوق الاشتراك",
      policies: "سياسات التخليص",
      students: "الطلبة",
    },
  },
};

export type Dict = typeof ar;
