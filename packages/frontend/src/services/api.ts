import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
});

type AuthFailureHandler = () => void;
type AuthRequestConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

let accessToken: string | null = null;
let authFailureHandler: AuthFailureHandler | null = null;
let refreshPromise: Promise<string> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAuthFailureHandler(handler: AuthFailureHandler | null): void {
  authFailureHandler = handler;
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = api
      .post<{ accessToken: string }>('/auth/refresh')
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch((error: unknown) => {
        setAccessToken(null);
        authFailureHandler?.();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as AuthRequestConfig | undefined;
    const isAuthRequest = config?.url?.includes('/auth/');

    if (error.response?.status !== 401 || !config || config._authRetry || isAuthRequest) {
      return Promise.reject(error);
    }

    config._authRetry = true;
    try {
      const token = await refreshAccessToken();
      config.headers.Authorization = `Bearer ${token}`;
      return api(config);
    } catch (refreshError) {
      return Promise.reject(refreshError);
    }
  },
);

export default api;
