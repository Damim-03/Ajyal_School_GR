import axios from "axios";
import { appConfig } from "../config/app.config";
import { useAuthStore } from "../stores/auth.store";

// --------------------------------------------------
// Axios Instance
// --------------------------------------------------

export const apiClient = axios.create({
  baseURL: appConfig.API_URL,
  withCredentials: true, // للـ refresh token cookie
  headers: {
    "Content-Type": "application/json",
  },
});

// --------------------------------------------------
// Request Interceptor — إضافة Access Token
// --------------------------------------------------

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

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
          `${appConfig.API_URL}/auth/refresh`,
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
