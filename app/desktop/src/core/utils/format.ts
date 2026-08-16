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
//
// كانت هنا `formatCurrency` بصيغةٍ خامسة (ar-DZ، ومن صفرٍ إلى منزلتين
// بحسب المبلغ) لا يستدعيها أحد. وكتابةُ المال صارت في
// `core/utils/money` وحدها — رقمان بعد الفاصلة دائماً — فحُذفت من هنا
// حتى لا يعود إليها من يبحث عن دالّة تنسيق فيتفرّق الشكل من جديد.
// --------------------------------------------------

export { formatMoney, formatAmount, parseMoney } from "./money"

// --------------------------------------------------
// الأسماء
// --------------------------------------------------

export const fullName = (firstName: string, lastName: string): string =>
  `${firstName} ${lastName}`