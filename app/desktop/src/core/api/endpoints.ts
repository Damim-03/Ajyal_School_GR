export const endpoints = {
  // --------------------------------------------------
  // Auth
  // --------------------------------------------------
  auth: {
    login: "/auth/login",
    logout: "/auth/logout",
    refresh: "/auth/refresh",
    me: "/auth/me",
  },

  // --------------------------------------------------
  // Students
  // --------------------------------------------------
  students: {
    list: "/students",
    create: "/students",
    detail: (id: string) => `/students/${id}`,
    update: (id: string) => `/students/${id}`,
    delete: (id: string) => `/students/${id}`,
    enrollments: (id: string) => `/students/${id}/enrollments`,
  },

  // --------------------------------------------------
  // Teachers
  // --------------------------------------------------
  teachers: {
    list: "/teachers",
    create: "/teachers",
    detail: (id: string) => `/teachers/${id}`,
    update: (id: string) => `/teachers/${id}`,
    delete: (id: string) => `/teachers/${id}`,
  },

  // --------------------------------------------------
  // Teaching Assignments
  // --------------------------------------------------
  assignments: {
    list: "/teaching-assignments",
    create: "/teaching-assignments",
    detail: (id: string) => `/teaching-assignments/${id}`,
    update: (id: string) => `/teaching-assignments/${id}`,
    delete: (id: string) => `/teaching-assignments/${id}`,
  },

  // --------------------------------------------------
  // Enrollments
  // --------------------------------------------------
  enrollments: {
    list: "/enrollments",
    create: "/enrollments",
    detail: (id: string) => `/enrollments/${id}`,
    update: (id: string) => `/enrollments/${id}`,
    delete: (id: string) => `/enrollments/${id}`,
  },

  // --------------------------------------------------
  // Schedules
  // --------------------------------------------------
  schedules: {
    list: "/schedules",
    create: "/schedules",
    detail: (id: string) => `/schedules/${id}`,
    update: (id: string) => `/schedules/${id}`,
    delete: (id: string) => `/schedules/${id}`,
  },

  // --------------------------------------------------
  // Sessions
  // --------------------------------------------------
  sessions: {
    list: "/sessions",
    create: "/sessions",
    detail: (id: string) => `/sessions/${id}`,
    update: (id: string) => `/sessions/${id}`,
  },

  // --------------------------------------------------
  // Attendance
  // --------------------------------------------------
  attendance: {
    list: "/attendance",
    create: "/attendance",
    update: (id: string) => `/attendance/${id}`,
  },

  // --------------------------------------------------
  // Invoices
  // --------------------------------------------------
  invoices: {
    list: "/invoices",
    create: "/invoices",
    detail: (id: string) => `/invoices/${id}`,
    update: (id: string) => `/invoices/${id}`,
    cancel: (id: string) => `/invoices/${id}/cancel`,
  },

  // --------------------------------------------------
  // Payments
  // --------------------------------------------------
  payments: {
    list: "/payments",
    create: "/payments",
    detail: (id: string) => `/payments/${id}`,
  },

  // --------------------------------------------------
  // Receipts
  // --------------------------------------------------
  receipts: {
    detail: (id: string) => `/receipts/${id}`,
    print: (id: string) => `/receipts/${id}/print`,
  },

  // --------------------------------------------------
  // Settings
  // --------------------------------------------------
  settings: {
    academicYears: "/settings/academic-years",
    educationStages: "/settings/education-stages",
    levels: "/settings/levels",
    studyGroups: "/settings/study-groups",
    subjects: "/settings/subjects",
    classrooms: "/settings/classrooms",
    lessonSlots: "/settings/lesson-slots",
    tuitionFees: "/settings/tuition-fees",
  },

  // --------------------------------------------------
  // Users & Roles
  // --------------------------------------------------
  users: {
    list: "/users",
    create: "/users",
    detail: (id: string) => `/users/${id}`,
    update: (id: string) => `/users/${id}`,
    delete: (id: string) => `/users/${id}`,
  },

  roles: {
    list: "/roles",
    detail: (id: string) => `/roles/${id}`,
  },
};
