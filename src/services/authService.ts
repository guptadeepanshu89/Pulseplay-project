import { apiRequest } from '@/api/client';
import { User } from '@/types/user';

interface LoginResponse {
  token: string;
  user: User;
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password, app: 'mobile' },
    skipAuth: true,
  });
}

export async function forgotPassword(identifier: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/auth/forgot-password', {
    method: 'POST',
    body: { identifier },
    skipAuth: true,
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<{ ok: true }> {
  return apiRequest<{ ok: true }>('/auth/reset-password', {
    method: 'POST',
    body: { token, newPassword },
    skipAuth: true,
  });
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me');
}

export async function changePassword(
  currentPassword: string,
  newPassword: string,
): Promise<{ ok: true; token?: string }> {
  return apiRequest<{ ok: true; token?: string }>('/auth/change-password', {
    method: 'POST',
    body: { currentPassword, newPassword },
  });
}

// Only the server can clear the httpOnly auth cookie web relies on — the
// client can't read or delete it directly. Native's SecureStore token is
// cleared separately by the caller; this is a best-effort call either way.
export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST', body: { app: 'mobile' } });
}
