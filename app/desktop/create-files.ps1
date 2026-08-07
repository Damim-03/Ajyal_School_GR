# ============================================================
# Ajyal School — Frontend Files Generator
# PowerShell Script
# ============================================================
# الاستخدام — شغّله داخل مجلد desktop:
#   cd desktop
#   .\create-files.ps1
# ============================================================

$files = @(

  # ----------------------------------------------------------
  # Core — API
  # ----------------------------------------------------------
  "src/core/api/client.ts"
  "src/core/api/endpoints.ts"

  # ----------------------------------------------------------
  # Core — Config
  # ----------------------------------------------------------
  "src/core/config/app.config.ts"

  # ----------------------------------------------------------
  # Core — Hooks
  # ----------------------------------------------------------
  "src/core/hooks/use-auth.ts"
  "src/core/hooks/use-permissions.ts"

  # ----------------------------------------------------------
  # Core — Stores
  # ----------------------------------------------------------
  "src/core/stores/auth.store.ts"

  # ----------------------------------------------------------
  # Core — Types
  # ----------------------------------------------------------
  "src/core/types/index.ts"

  # ----------------------------------------------------------
  # Core — Utils
  # ----------------------------------------------------------
  "src/core/utils/cn.ts"
  "src/core/utils/format.ts"

  # ----------------------------------------------------------
  # Components — Layout
  # ----------------------------------------------------------
  "src/components/layout/app-layout.tsx"
  "src/components/layout/sidebar.tsx"
  "src/components/layout/header.tsx"
  "src/components/layout/page-header.tsx"

  # ----------------------------------------------------------
  # Components — Shared
  # ----------------------------------------------------------
  "src/components/shared/data-table.tsx"
  "src/components/shared/confirm-dialog.tsx"
  "src/components/shared/loading.tsx"
  "src/components/shared/error-boundary.tsx"

  # ----------------------------------------------------------
  # Router
  # ----------------------------------------------------------
  "src/router/index.tsx"
  "src/router/protected-route.tsx"
  "src/router/routes.ts"

  # ----------------------------------------------------------
  # Module — Auth
  # ----------------------------------------------------------
  "src/modules/auth/pages/login.page.tsx"
  "src/modules/auth/components/login-form.tsx"
  "src/modules/auth/hooks/use-login.ts"
  "src/modules/auth/services/auth.service.ts"
  "src/modules/auth/schemas/auth.schema.ts"
  "src/modules/auth/types/auth.types.ts"

  # ----------------------------------------------------------
  # Module — Students
  # ----------------------------------------------------------
  "src/modules/students/pages/students.page.tsx"
  "src/modules/students/pages/student-detail.page.tsx"
  "src/modules/students/components/student-table.tsx"
  "src/modules/students/components/student-form.tsx"
  "src/modules/students/components/student-card.tsx"
  "src/modules/students/hooks/use-students.ts"
  "src/modules/students/hooks/use-student.ts"
  "src/modules/students/services/student.service.ts"
  "src/modules/students/schemas/student.schema.ts"
  "src/modules/students/types/student.types.ts"

  # ----------------------------------------------------------
  # Module — Teachers
  # ----------------------------------------------------------
  "src/modules/teachers/pages/teachers.page.tsx"
  "src/modules/teachers/pages/teacher-detail.page.tsx"
  "src/modules/teachers/components/teacher-table.tsx"
  "src/modules/teachers/components/teacher-form.tsx"
  "src/modules/teachers/hooks/use-teachers.ts"
  "src/modules/teachers/hooks/use-teacher.ts"
  "src/modules/teachers/services/teacher.service.ts"
  "src/modules/teachers/schemas/teacher.schema.ts"
  "src/modules/teachers/types/teacher.types.ts"

  # ----------------------------------------------------------
  # Module — Enrollments
  # ----------------------------------------------------------
  "src/modules/enrollments/pages/enrollments.page.tsx"
  "src/modules/enrollments/components/enrollment-table.tsx"
  "src/modules/enrollments/components/enrollment-form.tsx"
  "src/modules/enrollments/hooks/use-enrollments.ts"
  "src/modules/enrollments/services/enrollment.service.ts"
  "src/modules/enrollments/schemas/enrollment.schema.ts"
  "src/modules/enrollments/types/enrollment.types.ts"

  # ----------------------------------------------------------
  # Module — Schedules
  # ----------------------------------------------------------
  "src/modules/schedules/pages/schedules.page.tsx"
  "src/modules/schedules/components/schedule-table.tsx"
  "src/modules/schedules/components/schedule-form.tsx"
  "src/modules/schedules/hooks/use-schedules.ts"
  "src/modules/schedules/services/schedule.service.ts"
  "src/modules/schedules/schemas/schedule.schema.ts"
  "src/modules/schedules/types/schedule.types.ts"

  # ----------------------------------------------------------
  # Module — Attendance
  # ----------------------------------------------------------
  "src/modules/attendance/pages/attendance.page.tsx"
  "src/modules/attendance/components/attendance-table.tsx"
  "src/modules/attendance/components/attendance-form.tsx"
  "src/modules/attendance/hooks/use-attendance.ts"
  "src/modules/attendance/services/attendance.service.ts"
  "src/modules/attendance/schemas/attendance.schema.ts"
  "src/modules/attendance/types/attendance.types.ts"

  # ----------------------------------------------------------
  # Module — Invoices
  # ----------------------------------------------------------
  "src/modules/invoices/pages/invoices.page.tsx"
  "src/modules/invoices/pages/invoice-detail.page.tsx"
  "src/modules/invoices/components/invoice-table.tsx"
  "src/modules/invoices/components/invoice-form.tsx"
  "src/modules/invoices/hooks/use-invoices.ts"
  "src/modules/invoices/hooks/use-invoice.ts"
  "src/modules/invoices/services/invoice.service.ts"
  "src/modules/invoices/schemas/invoice.schema.ts"
  "src/modules/invoices/types/invoice.types.ts"

  # ----------------------------------------------------------
  # Module — Payments
  # ----------------------------------------------------------
  "src/modules/payments/pages/payments.page.tsx"
  "src/modules/payments/pages/payment-detail.page.tsx"
  "src/modules/payments/components/payment-table.tsx"
  "src/modules/payments/components/payment-form.tsx"
  "src/modules/payments/hooks/use-payments.ts"
  "src/modules/payments/hooks/use-payment.ts"
  "src/modules/payments/services/payment.service.ts"
  "src/modules/payments/schemas/payment.schema.ts"
  "src/modules/payments/types/payment.types.ts"

  # ----------------------------------------------------------
  # Module — Settings
  # ----------------------------------------------------------
  "src/modules/settings/pages/settings.page.tsx"
  "src/modules/settings/pages/academic-years.page.tsx"
  "src/modules/settings/pages/education-stages.page.tsx"
  "src/modules/settings/pages/study-groups.page.tsx"
  "src/modules/settings/pages/subjects.page.tsx"
  "src/modules/settings/pages/classrooms.page.tsx"
  "src/modules/settings/pages/lesson-slots.page.tsx"
  "src/modules/settings/pages/tuition-fees.page.tsx"
  "src/modules/settings/pages/users.page.tsx"
  "src/modules/settings/components/settings-nav.tsx"
  "src/modules/settings/hooks/use-settings.ts"
  "src/modules/settings/services/settings.service.ts"
  "src/modules/settings/types/settings.types.ts"

)

Write-Host ""
Write-Host "Creating Ajyal School frontend files..." -ForegroundColor Cyan
Write-Host ""

foreach ($file in $files) {
  $dir = Split-Path $file -Parent
  if (!(Test-Path $dir)) {
    New-Item -ItemType Directory -Force -Path $dir | Out-Null
  }
  if (!(Test-Path $file)) {
    New-Item -ItemType File -Force -Path $file | Out-Null
    Write-Host "  + $file" -ForegroundColor Green
  } else {
    Write-Host "  ~ $file (already exists)" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Done! All files created successfully." -ForegroundColor Cyan
Write-Host ""