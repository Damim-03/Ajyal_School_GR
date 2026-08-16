// --------------------------------------------------
// API Response
// --------------------------------------------------

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data: T;
}

export interface PaginatedResponse<T> {
  success: boolean;
  message: string;
  data: T[];
  pagination: Pagination;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// --------------------------------------------------
// Auth
// --------------------------------------------------

export interface User {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  avatar: string | null;
  /** منه يُرسم الأفاتار الافتراضي حين لا صورة — كما للطالب والأستاذ */
  gender: Gender;
  isActive: boolean;
  lastLoginAt: string | null;
  role: {
    id: string;
    name: string;
  };
  permissions: string[];
}

// --------------------------------------------------
// Enums — مطابقة للـ schema
// --------------------------------------------------

export type Gender = "MALE" | "FEMALE";
export type StudyGroupType = "NORMAL" | "ELITE" | "INTENSIVE" | "EVENING";
export type EducationStageType = "PRIMARY" | "MIDDLE" | "SECONDARY";
export type DayOfWeek =
  | "SATURDAY"
  | "SUNDAY"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY";
export type InvoiceStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";
export type PaymentMethod = "CASH" | "CARD" | "BANK_TRANSFER";
export type AttendanceStatus = "PRESENT" | "ABSENT" | "LATE" | "EXCUSED";
export type SessionStatus = "SCHEDULED" | "COMPLETED" | "CANCELLED";
export type ReceiptStatus = "ACTIVE" | "CANCELLED" | "REPRINTED";

// --------------------------------------------------
// Common
// --------------------------------------------------

export interface SelectOption {
  value: string;
  label: string;
}

export interface QueryParams {
  page?: number;
  limit?: number;
  search?: string;
}
