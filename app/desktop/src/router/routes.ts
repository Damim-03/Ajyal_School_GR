export const ROUTES = {
  // --------------------------------------------------
  // Auth
  // --------------------------------------------------
  login: "/login",
  unauthorized: "/403",

  // --------------------------------------------------
  // Dashboard
  // --------------------------------------------------
  dashboard: "/",

  // --------------------------------------------------
  // Students
  // --------------------------------------------------
  students: {
    root: "/students",
    detail: (id: string) => `/students/${id}`,
  },

  // --------------------------------------------------
  // Teachers
  // --------------------------------------------------
  teachers: {
    root: "/teachers",
    detail: (id: string) => `/teachers/${id}`,
  },

  // --------------------------------------------------
  // Enrollments
  // --------------------------------------------------
  enrollments: {
    root: "/enrollments",
  },

  // --------------------------------------------------
  // Schedules
  // --------------------------------------------------
  schedules: {
    root: "/schedules",
  },

  // --------------------------------------------------
  // Attendance
  // --------------------------------------------------
  attendance: {
    root: "/attendance",
  },

  // --------------------------------------------------
  // Invoices
  // --------------------------------------------------
  invoices: {
    root: "/invoices",
    detail: (id: string) => `/invoices/${id}`,
  },

  // --------------------------------------------------
  // Payments
  // --------------------------------------------------
  payments: {
    root: "/payments",
    detail: (id: string) => `/payments/${id}`,
  },

  // --------------------------------------------------
  // Settings
  // --------------------------------------------------
  settings: {
    root: "/settings",
    academicYears: "/settings/academic-years",
    stages: "/settings/education-stages",
    groups: "/settings/study-groups",
    subjects: "/settings/subjects",
    classrooms: "/settings/classrooms",
    lessonSlots: "/settings/lesson-slots",
    tuitionFees: "/settings/tuition-fees",
    users: "/settings/users",
  },
} as const;
