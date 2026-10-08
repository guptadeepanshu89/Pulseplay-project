import { apiRequest } from '@/api/client';
import { User } from '@/types/user';

interface LoginResponse {
  token: string;
  user: User;
}

export async function login(identifier: string, password: string): Promise<LoginResponse> {
  return apiRequest<LoginResponse>('/auth/login', {
    method: 'POST',
    body: { identifier, password },
    skipAuth: true,
  });
}

export async function getMe(): Promise<User> {
  return apiRequest<User>('/auth/me');
}

// Only the server can clear the httpOnly auth cookie web relies on — the
// client can't read or delete it directly. Native's SecureStore token is
// cleared separately by the caller; this is a best-effort call either way.
export async function logout(): Promise<void> {
  await apiRequest<void>('/auth/logout', { method: 'POST' });
}
