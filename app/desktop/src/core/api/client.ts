import axios from "axios";
import { apiBaseUrl } from "./base-url";
import {
  reportRequestFailure,
  reportRequestSuccess,
} from "../system/connection";
import { useAuthStore } from "../stores/auth.store";

// --------------------------------------------------
// Axios Instance
// --------------------------------------------------

export const apiClient = axios.create({
  withCredentials: true, // للـ refresh token cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// --------------------------------------------------
// Request Interceptor — العنوان ثمّ التوكن
// --------------------------------------------------

apiClient.interceptors.request.use((config) => {
  /*
   * العنوانُ يُحقن هنا لا في `axios.create`.
   *
   * فالمُنشئ يُنفَّذ مرّةً عند تحميل الوحدة، وقد صار العنوانُ يُضبط
   * زمنَ التشغيل من شاشة الشبكة (`core/api/base-url.ts`). ولو خُبز
   * في المُنشئ لظلّت الطلباتُ تذهب إلى الخادم القديم حتى يُعاد
   * تشغيل التطبيق — أي أنّ تبديل الخادم يبدو أنّه فشل.
   */
  config.baseURL = apiBaseUrl();

  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  /*
   * رفع الملفّات: يُحذف Content-Type ليضعه المتصفّح بنفسه.
   *
   * القيمة الافتراضية أعلاه (application/json) تُطبَّق على كلّ طلب —
   * بما فيها FormData. وحينها يُرسَل النوع بلا `boundary`، فلا يجد
   * multer على الخادم أيّ ملفّ ويردّ «لم يُرفَق أي ملف» رغم أنّ الملفّ
   * في الجسم فعلاً. حذفُ الترويسة يجعل المتصفّح يكتبها مع الحدّ الصحيح.
   */
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }

  return config;
});

// --------------------------------------------------
// Response Interceptor — تجديد التوكن عند انتهائه
// --------------------------------------------------

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null) => {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => {
    /*
     * كلُّ ردٍّ يصل دليلٌ على أنّ الطريق قائم.
     *
     * وهذا هو مقياسُ الاتصال الأدقّ في التطبيق: لا فحصَ دوريٌّ يسأل
     * عمّا لا يُستعمل، بل عملُ المستخدم نفسُه يُخبر. والفحصُ الدوريُّ
     * لا يعمل إلّا **أثناء الانقطاع** ليكشف العودة (`connection.ts`).
     */
    reportRequestSuccess();

    return response;
  },

  async (error) => {
    const originalRequest = error.config;

    /*
     * **بلا ردٍّ** يعني أنّ الطلبَ لم يبلغ الخادم: انقطعت الشبكة أو
     * سقطت الخدمة. أمّا 500 و403 فردودٌ — الخادمُ حيٌّ وعطبُه في
     * موضعٍ آخر، ورفعُ «انقطع الاتصال» عليها يُرسل المستخدمَ يفحص
     * الكابلاتِ لأجل خطأٍ في الشيفرة.
     */
    if (!error.response) reportRequestFailure();

    // إذا انتهى التوكن — نجدده مرة واحدة
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // انتظر التجديد الجاري
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return apiClient(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const { data } = await axios.post(
          `${apiBaseUrl()}/auth/refresh`,
          {},
          { withCredentials: true },
        );

        const newToken = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        processQueue(null, newToken);

        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
