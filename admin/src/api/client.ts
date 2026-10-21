import axios, { AxiosError } from 'axios';

// Relative /api/v1 hits the Vite dev server, which proxies to the backend.
// The panel and the API stay on one host, which is what the httpOnly
// pulseplay_admin_token cookie (SameSite=Lax) needs — including through a tunnel.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

export const http = axios.create({ baseURL: API_BASE_URL, withCredentials: true });

// The shape core/errors.ts's errorHandler sends on every failure.
export interface ApiErrorBody {
  error: string;
  code: string;
  details?: { path: string; message: string }[];
}

export class ApiError extends Error {
  code: string;
  details?: { path: string; message: string }[];
  status?: number;

  constructor(body: ApiErrorBody, status?: number) {
    super(body.error);
    this.code = body.code;
    this.details = body.details;
    this.status = status;
  }
}

// Fired when a request other than the initial "am I signed in?" check comes back
// 401 — a token revoked mid-session (password changed elsewhere, blocked, deleted).
// AuthContext listens and drops back to the login screen instead of leaving
// every subsequent action failing silently.
export const SESSION_EXPIRED_EVENT = 'pulseplay:session-expired';

http.interceptors.response.use(
  (res) => res,
  (error: AxiosError<ApiErrorBody>) => {
    const url = error.config?.url ?? '';
    if (error.response?.status === 401 && url !== '/auth/me' && url !== '/auth/login') {
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT));
    }
    if (error.response?.data?.code) {
      return Promise.reject(new ApiError(error.response.data, error.response.status));
    }
    return Promise.reject(error);
  },
);

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;
