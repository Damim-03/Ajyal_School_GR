import { format, formatDistanceToNow } from "date-fns"
import { ar } from "date-fns/locale"

// --------------------------------------------------
// التواريخ
// --------------------------------------------------

export const formatDate = (date: string | Date): string =>
  format(new Date(date), "dd/MM/yyyy")

export const formatDateTime = (date: string | Date): string =>
  format(new Date(date), "dd/MM/yyyy HH:mm")

export const formatRelative = (date: string | Date): string =>
  formatDistanceToNow(new Date(date), { addSuffix: true, locale: ar })

// --------------------------------------------------
// الأرقام والعملة
// --------------------------------------------------

export const formatCurrency = (amount: number | string): string => {
  const num = typeof amount === "string" ? parseFloat(amount) : amount
  return new Intl.NumberFormat("ar-DZ", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num) + " دج"
}

export const formatNumber = (num: number): string =>
  new Intl.NumberFormat("ar-DZ").format(num)

// --------------------------------------------------
// الأسماء
// --------------------------------------------------

export const fullName = (firstName: string, lastName: string): string =>
  `${firstName} ${lastName}`