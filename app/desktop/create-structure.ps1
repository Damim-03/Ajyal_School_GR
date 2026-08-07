# ============================================================
# Ajyal School — Frontend Structure Generator
# PowerShell Script
# ============================================================
# الاستخدام — شغّله داخل مجلد desktop:
#   cd desktop
#   .\create-structure.ps1
# ============================================================

$src = "src"

$dirs = @(
  # Assets
  "$src/assets/icons"
  "$src/assets/images"
  "$src/assets/fonts"

  # Core
  "$src/core/api"
  "$src/core/config"
  "$src/core/hooks"
  "$src/core/stores"
  "$src/core/types"
  "$src/core/utils"

  # Components
  "$src/components/ui"
  "$src/components/layout"
  "$src/components/shared"

  # Router
  "$src/router"

  # Modules
  "$src/modules/auth/pages"
  "$src/modules/auth/components"
  "$src/modules/auth/hooks"
  "$src/modules/auth/services"
  "$src/modules/auth/schemas"
  "$src/modules/auth/types"

  "$src/modules/students/pages"
  "$src/modules/students/components"
  "$src/modules/students/hooks"
  "$src/modules/students/services"
  "$src/modules/students/schemas"
  "$src/modules/students/types"

  "$src/modules/teachers/pages"
  "$src/modules/teachers/components"
  "$src/modules/teachers/hooks"
  "$src/modules/teachers/services"
  "$src/modules/teachers/schemas"
  "$src/modules/teachers/types"

  "$src/modules/enrollments/pages"
  "$src/modules/enrollments/components"
  "$src/modules/enrollments/hooks"
  "$src/modules/enrollments/services"
  "$src/modules/enrollments/schemas"
  "$src/modules/enrollments/types"

  "$src/modules/schedules/pages"
  "$src/modules/schedules/components"
  "$src/modules/schedules/hooks"
  "$src/modules/schedules/services"
  "$src/modules/schedules/schemas"
  "$src/modules/schedules/types"

  "$src/modules/attendance/pages"
  "$src/modules/attendance/components"
  "$src/modules/attendance/hooks"
  "$src/modules/attendance/services"
  "$src/modules/attendance/schemas"
  "$src/modules/attendance/types"

  "$src/modules/invoices/pages"
  "$src/modules/invoices/components"
  "$src/modules/invoices/hooks"
  "$src/modules/invoices/services"
  "$src/modules/invoices/schemas"
  "$src/modules/invoices/types"

  "$src/modules/payments/pages"
  "$src/modules/payments/components"
  "$src/modules/payments/hooks"
  "$src/modules/payments/services"
  "$src/modules/payments/schemas"
  "$src/modules/payments/types"

  "$src/modules/settings/pages"
  "$src/modules/settings/components"
  "$src/modules/settings/hooks"
  "$src/modules/settings/services"
  "$src/modules/settings/schemas"
  "$src/modules/settings/types"
)

Write-Host ""
Write-Host "Creating Ajyal School frontend structure..." -ForegroundColor Cyan
Write-Host ""

foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Force -Path $dir | Out-Null
  Write-Host "  + $dir" -ForegroundColor Green
}

Write-Host ""
Write-Host "Done! Structure created successfully." -ForegroundColor Cyan
Write-Host ""