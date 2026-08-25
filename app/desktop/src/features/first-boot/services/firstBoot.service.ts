/**
 * جسرُ التهيئة إلى الخادم.
 *
 * **ولا يستعمل `apiClient`.** وذلك بقرار: المُعترِضُ هناك يلاحق 401
 * فيطلب تجديدَ توكن، ثمّ يُسقط الجلسةَ إن فشل. وشاشاتُ التهيئة تعمل
 * **بلا توكنٍ أصلاً** — فأيُّ 401 عارضٍ كان سيُطلق سلسلةَ تجديدٍ
 * تنتهي بـ`logout()` في حالةٍ لا مستخدمَ فيها. وطبقةٌ رقيقةٌ فوق axios
 * أصدقُ من مُعترِضٍ يعمل في غير سياقه.
 *
 * وترجمةُ الأخطاء هنا لا في الشاشات (§41): الخادمُ يردّ رمزاً
 * (`SETUP_STEP_OUT_OF_ORDER`)، وهذه تحوّله إلى مفتاحٍ تعرفه الواجهة —
 * فلا يظهر نصُّ Prisma ولا رسالةُ axios في شاشةٍ يراها مستخدم.
 */

import axios, { AxiosError } from "axios";

import { apiBaseUrl } from "../../../core/api/base-url";
import type {
  DeviceEntry,
  FirstBootState,
  InstitutionProgress,
  ProbeResult,
  VerificationResult,
} from "../types/firstBoot.types";

const http = axios.create({
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
  /*
   * مهلةٌ صريحةٌ — وهي جزءٌ من الميزة لا احتياطٌ عامّ.
   *
   * شاشةُ الشبكة تُجرَّب على عنوانٍ خاطئ، وطلبٌ بلا مهلةٍ يعلّقها إلى
   * أن يستسلم النظامُ بعد دقيقةٍ أو أكثر. وعشرُ ثوانٍ تكفي شبكةً
   * محلّيةً بأضعافٍ، وتُظهر «لا يستجيب» في زمنٍ يُحتمل.
   */
  timeout: 10_000,
});

/** رموزُ الخطأ التي تعرفها الواجهة — تُطابق مفاتيحَ `t.errors` */
export type FirstBootErrorKind =
  | "network"
  | "outOfOrder"
  | "alreadyCompleted"
  | "deviceMissing"
  | "verificationFailed"
  | "generic";

export class FirstBootError extends Error {
  constructor(
    readonly kind: FirstBootErrorKind,
    /** تفاصيلُ الحقول من `validate` — تُعرض تحت الحقل المعنيّ */
    readonly fields: Record<string, string> = {},
    message: string = kind,
  ) {
    super(message);
    this.name = "FirstBootError";
  }
}

interface ApiErrorBody {
  message?: string;
  errorCode?: string;
  errors?: { field: string; message: string }[];
}

const toFirstBootError = (error: unknown): FirstBootError => {
  const axiosError = error as AxiosError<ApiErrorBody>;

  if (!axiosError.response) {
    return new FirstBootError("network");
  }

  const body = axiosError.response.data ?? {};

  const fields = Object.fromEntries(
    (body.errors ?? []).map((issue) => [issue.field, issue.message]),
  );

  switch (body.errorCode) {
    case "SETUP_ALREADY_COMPLETED":
      return new FirstBootError("alreadyCompleted", fields);
    case "SETUP_STEP_OUT_OF_ORDER":
      return new FirstBootError("outOfOrder", fields);
    case "SETUP_DEVICE_MISSING":
      return new FirstBootError("deviceMissing", fields);
    case "SETUP_VERIFICATION_FAILED":
      return new FirstBootError("verificationFailed", fields);
    default:
      return new FirstBootError("generic", fields, body.message ?? "");
  }
};

const url = (path: string) => `${apiBaseUrl()}/system/first-boot${path}`;

const get = async <T>(path: string): Promise<T> => {
  try {
    const { data } = await http.get(url(path));
    return data.data as T;
  } catch (error) {
    throw toFirstBootError(error);
  }
};

const post = async <T>(path: string, body?: unknown): Promise<T> => {
  try {
    const { data } = await http.post(url(path), body ?? {});
    return data.data as T;
  } catch (error) {
    throw toFirstBootError(error);
  }
};

// --------------------------------------------------
// القراءة
// --------------------------------------------------

export const fetchState = () => get<FirstBootState>("/status");

export const probe = () => get<ProbeResult>("/probe");

/**
 * فحصُ عنوانٍ **قبل** اعتماده — لا يمرّ بـ`apiBaseUrl`.
 *
 * وهذا هو جوهرُ شاشة الشبكة: أن يُجرَّب الخادمُ الجديد وهو لم يُحفظ
 * بعد. فلو مرّ بالعنوان المعتمد لقاس الخادمَ القديم وأخبر أنّ الجديد
 * يعمل — وهو أسوأُ من ألّا يفحص شيئاً (§29).
 */
export const probeAt = async (baseUrl: string): Promise<ProbeResult> => {
  try {
    const { data } = await http.get(`${baseUrl}/system/first-boot/probe`);
    return data.data as ProbeResult;
  } catch (error) {
    throw toFirstBootError(error);
  }
};

// --------------------------------------------------
// الخطوات
// --------------------------------------------------

export const submitLanguage = (language: string) =>
  post<FirstBootState>("/language", { language });

export const submitRegion = (body: {
  country: string;
  timezone: string;
  dateFormat: string;
}) => post<FirstBootState>("/region", body);

export const submitNetwork = (mode: string) =>
  post<FirstBootState>("/network", { mode });

export const submitDisplay = (body: {
  uiScale: string;
  density: string;
  windowMode: string;
}) => post<FirstBootState>("/display", body);

export const submitPerformance = (profile: string) =>
  post<FirstBootState>("/performance", { profile });

export const submitTerms = (version: string) =>
  post<FirstBootState>("/terms", { accepted: true, version });

export const submitUpdate = (body: { appVersion: string; channel: string }) =>
  post<FirstBootState>("/update", body);

export const submitDevices = (devices: DeviceEntry[]) =>
  post<FirstBootState>("/devices", { devices });

export const submitAdministrator = (body: {
  firstName: string;
  lastName: string;
  username: string;
  email?: string;
  password: string;
  confirmPassword: string;
}) => post<FirstBootState>("/administrator", body);

export const submitInstitution = (body: {
  name: string;
  shortName?: string;
  nameEn?: string;
  phone?: string;
  email?: string;
  address?: string;
  logoPath?: string;
}) => post<FirstBootState>("/institution", body);

export const submitAcademicYear = (body: {
  name: string;
  startDate: string;
  endDate: string;
  sessionsPerMonth: number;
}) => post<FirstBootState>("/academic-year", body);

export const submitPrivacy = (diagnostics: boolean) =>
  post<FirstBootState>("/privacy", { diagnostics });

export const submitRecovery = (phone: string) =>
  post<FirstBootState>("/recovery", { phone });

// --------------------------------------------------
// التنقّل والإتمام
// --------------------------------------------------

export const stepBack = (from: string) =>
  post<FirstBootState>("/back", { from });

export const verify = () => post<VerificationResult>("/verify");

export const complete = () => post<FirstBootState>("/complete");

// --------------------------------------------------
// ما بعد التهيئة
// --------------------------------------------------

export const fetchInstitutionProgress = async (
  token: string,
): Promise<InstitutionProgress> => {
  const { data } = await http.get(`${apiBaseUrl()}/system/institution-progress`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.data as InstitutionProgress;
};

export const dismissOnboarding = async (
  token: string,
): Promise<InstitutionProgress> => {
  const { data } = await http.post(
    `${apiBaseUrl()}/system/institution-progress/dismiss`,
    {},
    { headers: { Authorization: `Bearer ${token}` } },
  );

  return data.data as InstitutionProgress;
};
