import { http } from './client';
import type { CurrentUser } from '../types';

export async function login(identifier: string, password: string): Promise<CurrentUser> {
  const { data } = await http.post('/auth/login', { identifier, password, app: 'admin' });
  return data.user;
}

export async function fetchMe(): Promise<CurrentUser> {
  const { data } = await http.get('/auth/me');
  return data;
}

export async function logout(): Promise<void> {
  await http.post('/auth/logout', { app: 'admin' });
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await http.post('/auth/change-password', { currentPassword, newPassword });
}
