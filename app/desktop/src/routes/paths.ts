/**
 * مسارات التطبيق — مصدر واحد للعناوين.
 *
 * `moduleOf` في features/home/modules.ts يشتقّ هويّة القسم من المسار
 * بمطابقة أطول بادئة، لذلك يجب أن تكون شاشات القسم تحت جذره:
 * ‏`/students/:id` تحت `/students` فتبقى البيئة والترويسة بلون الطلبة.
 */
export const PATHS = {
  login: "/login",
  home: "/",

  /**
   * ما بعد التهيئة الأولى — لوحةُ «ابنِ مؤسستك» (§30/§65).
   *
   * ومسارٌ لا نافذةٌ فوق الرئيسية: يُدخَل إليه مرّةً بعد أوّل دخول،
   * ويبقى مفتوحاً لمن أراد أن يرى ما بقي من الهيكل. ولا يعترض أحداً:
   * زرُّ «استكشاف NexSchool» يذهب إلى الرئيسية ولا يعود.
   */
  welcome: "/welcome",

  /* محور القسم — ثلاث بطاقات */
  students: "/students",
  studentsList: "/students/list",
  studentsFiles: "/students/files",
  studentNew: "/students/new",
  studentDetailPattern: "/students/:id",
  studentDetail: (id: string) => `/students/${id}`,

  /* محور الأساتذة — القائمة والملف والإسناد */
  teachers: "/teachers",
  teachersList: "/teachers/list",
  teacherDetailPattern: "/teachers/:id",
  teacherDetail: (id: string) => `/teachers/${id}`,

  /* محور إسناد الطلبة — ثلاث شاشات تحت جذرٍ واحد */
  enrollments: "/enrollments",
  enrollmentsAssign: "/enrollments/assign",
  enrollmentsTransfer: "/enrollments/transfer",
  enrollmentsBrowse: "/enrollments/browse",

  assignments: "/assignments",

  /* الجداول — شبكةٌ أسبوعية واحدة، و`schedules` عنوانٌ يُحوَّل إليها */
  schedules: "/schedules",
  schedulesWeekly: "/schedules/weekly",

  /* محور الكشوف — الحضور اليومي وما يشتقّ من الحصص والحقوق */
  attendance: "/attendance",
  attendanceDaily: "/attendance/daily",
  attendanceMonthlyFees: "/attendance/monthly-fees",
  attendanceExpected: "/attendance/expected",
  /** كشف حساب الطالب — سنتُه كاملةً: حضورٌ وحقٌّ وإيصال */
  attendanceStudentAccount: "/attendance/student-account",
  /** كشف حساب الأستاذ — ما استحقّه وما قبضه على امتداد السنة */
  attendanceTeacherAccount: "/attendance/teacher-account",
  /** أرشيف تخليص الأساتذة — ما دُفع ولمن وبأيّ ورقة */
  settlementArchive: "/attendance/archive",

  /*
   * المالية.
   *
   * حقوق الاشتراك وسياسات التخليص كانتا في الإعدادات، ومحلُّهما هنا:
   * الإعدادات تصف **البنية الدراسية** (أطوار ومستويات وأفواج ومواد)،
   * وهذه تصف **المال**. وخلطُهما كان يجعل المحاسب يبحث عن السعر بين
   * القاعات وأوقات الحصص.
   */
  finance: "/finance",
  invoices: "/finance/invoices",
  payments: "/finance/payments",
  receipts: "/finance/receipts",
  financeFees: "/finance/tuition-fees",
  financePolicies: "/finance/settlement-policies",
  financeSettlements: "/finance/settlements",

  reports: "/reports",

  /*
   * البنية الدراسية — قسمٌ قائم بذاته لا ركنٌ في الإعدادات.
   *
   * الأطوار والمستويات والأفواج والمواد ليست «إعدادات» تُضبط مرّةً
   * ثم تُنسى: هي هيكلُ المؤسسة نفسه، يُبنى في مطلع كل سنة ويُعدَّل
   * كلّما فُتح فوجٌ أو أُضيفت مادة. ودفنُها تحت الإعدادات كان يجعل
   * عملاً موسمياً متكرّراً يبدو ضبطاً تقنياً.
   */
  academic: "/academic",
  academicYears: "/academic/years",
  academicStages: "/academic/education-stages",
  academicLevels: "/academic/levels",
  academicGroups: "/academic/study-groups",
  academicSubjects: "/academic/subjects",
  academicClassrooms: "/academic/classrooms",
  academicSlots: "/academic/lesson-slots",

  /* الإعدادات — ما يخصّ المؤسسة والحسابات لا البنية */
  settings: "/settings",
  settingsSchool: "/settings/school",
  settingsPrint: "/settings/print-test",
  /** النسخ الاحتياطي والاستعادة وإعادة التهيئة */
  settingsMaintenance: "/settings/maintenance",
  settingsUsers: "/settings/users",
  settingsRoles: "/settings/roles",

  users: "/users",
  roles: "/users/roles",
} as const;
