import { http } from './client';
import type { AdminUser, Page, RoleCode } from '../types';

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  search?: string;
  role?: 'CLIENT_ADMIN' | 'CLIENT_USER';
  isActive?: boolean;
  clientId?: number; // SuperAdmin only — a Client Admin's list is always their own
  sort?: 'createdAt' | 'name' | 'email' | 'lastLoginAt';
  order?: 'asc' | 'desc';
}

export async function listUsers(params: ListUsersParams): Promise<Page<AdminUser>> {
  const { data } = await http.get('/admin/users', { params });
  return data;
}

export interface CreateUserInput {
  name: string;
  email: string;
  mobile: string;
  role?: RoleCode; // CLIENT_ADMIN | CLIENT_USER — a Client Admin may only send CLIENT_USER
  clientId?: number; // SuperAdmin only
}

export interface CreateUserResult {
  user: AdminUser;
  temporaryPassword: string;
}

export async function createUser(input: CreateUserInput): Promise<CreateUserResult> {
  const { data } = await http.post('/admin/users', input);
  return data;
}

export async function updateUser(id: number, input: { name?: string; email?: string; mobile?: string }): Promise<AdminUser> {
  const { data } = await http.patch(`/admin/users/${id}`, input);
  return data;
}

export async function setUserActive(id: number, active: boolean): Promise<AdminUser> {
  const { data } = await http.post(`/admin/users/${id}/${active ? 'unblock' : 'block'}`);
  return data;
}

export async function resetUserPassword(id: number): Promise<{ temporaryPassword: string }> {
  const { data } = await http.post(`/admin/users/${id}/reset-password`);
  return data;
}

export async function deleteUser(id: number): Promise<void> {
  await http.delete(`/admin/users/${id}`);
}
