/**
 * أنواعُ التهيئة الأولى — مرآةُ ما يُرسله الخادم.
 *
 * والأسماءُ مطابقةٌ لما في `backend/src/modules/system/first-boot.state.ts`
 * حرفاً بحرف. ولا مولِّدَ بينهما، فالمطابقةُ مسؤوليةُ من يعدّل: خطوةٌ
 * تُضاف هناك ولا تُضاف هنا يرفضها المصرِّفُ في `SCREENS` (‏`FirstBoot.tsx`)
 * لأنّ الخريطةَ مفهرسةٌ بالنوع كلِّه — فلا تمرّ الغفلةُ صامتة.
 */

export const FIRST_BOOT_STEPS = [
  "LANGUAGE",
  "REGION",
  "NETWORK",
  "DISPLAY",
  "PERFORMANCE",
  "TERMS",
  "UPDATE",
  "DEVICES",
  "ADMINISTRATOR",
  "INSTITUTION",
  "ACADEMIC_YEAR",
  "PRIVACY",
  "RECOVERY",
  "FINAL_VERIFICATION",
  "READY",
] as const;

export type FirstBootStep = (typeof FIRST_BOOT_STEPS)[number];

export type FirstBootStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED";

/**
 * مرحلةُ الواجهة — أوسعُ من خطوةِ الخادم.
 *
 * فللواجهة مرحلتان لا وجودَ لهما في القاعدة: `BOOTING` وهي سؤالُ
 * الخادم عن الحالة، و`WELCOME` وهي شاشةُ التقديم (§8) التي لا تُسجَّل
 * لأنّها لا تحمل قراراً. وجعلُهما خطوتين في الخادم كان سيعني حالةً
 * تُحفظ لضغطةٍ على «متابعة» لا أثرَ لها.
 */
export type BootPhase = "BOOTING" | "WELCOME" | FirstBootStep | "COMPLETED";

export type Language = "ar" | "en" | "fr";
export type DateFormat = "DD/MM/YYYY" | "MM/DD/YYYY" | "YYYY-MM-DD";
export type NetworkMode = "LOCAL" | "SERVER";
export type UiScale = "SMALL" | "DEFAULT" | "LARGE";
export type Density = "COMFORTABLE" | "COMPACT";
export type WindowMode = "WINDOWED" | "MAXIMIZED" | "FULLSCREEN";
export type PerformanceProfile = "BALANCED" | "PERFORMANCE" | "POWER_SAVING";
export type UpdateChannel = "NONE" | "MANUAL" | "TAURI";

export type DeviceKind =
  | "KEYBOARD"
  | "POINTER"
  | "DOCUMENT_PRINTER"
  | "RECEIPT_PRINTER"
  | "SCANNER"
  | "BARCODE_SCANNER";

export interface DeviceEntry {
  kind: DeviceKind;
  name: string;
  requirement: "REQUIRED" | "OPTIONAL";
  detected: boolean;
  verified: boolean;
}

export interface AcademicYearAnswer {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  sessionsPerMonth: number;
}

/** ما حُفظ سابقاً — تعود به الشاشةُ كما تُركت لا فارغة (§26) */
export interface FirstBootAnswers {
  language: string;
  country: string;
  timezone: string;
  dateFormat: string;
  networkMode: string;
  uiScale: string;
  density: string;
  windowMode: string;
  performance: string;
  termsVersion: string;
  termsAcceptedAt: string;
  updateChannel: string;
  appVersion: string;
  diagnostics: boolean;
  recoveryPhone: string;
  institution: {
    name: string;
    nameEn: string;
    shortName: string;
    phone: string;
    email: string;
    address: string;
    logoPath: string;
  };
  academicYear: AcademicYearAnswer | null;
}

export interface FirstBootState {
  status: FirstBootStatus;
  current: FirstBootStep;
  done: FirstBootStep[];
  version: string;
  startedAt: string | null;
  completedAt: string | null;
  /** تركيبٌ سبق وجودَ هذه الشاشات فاعتُرف به (§58) */
  adopted: boolean;
  progress: { index: number; total: number };
  steps: readonly FirstBootStep[];
  termsVersion: string;
  answers: FirstBootAnswers;
}

export type CheckKey =
  | "database"
  | "schema"
  | "language"
  | "region"
  | "institution"
  | "administrator"
  | "role"
  | "permissions"
  | "terms"
  | "academicYear"
  | "devices"
  | "appVersion";

export interface CheckResult {
  key: CheckKey;
  ok: boolean;
  detail?: string;
}

export interface VerificationResult {
  ok: boolean;
  checks: CheckResult[];
  missing: string[];
}

export interface ProbeResult {
  database: boolean;
  schema: boolean;
  auth: boolean;
  internetRequired: boolean;
}

export interface InstitutionProgress {
  areas: { key: string; count: number; done: boolean }[];
  percent: number;
  dismissed: boolean;
}
