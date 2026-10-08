import { http } from './client';
import type { Client, Page } from '../types';

export interface ListClientsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
  sort?: 'createdAt' | 'name' | 'code';
  order?: 'asc' | 'desc';
}

export async function listClients(params: ListClientsParams): Promise<Page<Client>> {
  const { data } = await http.get('/admin/clients', { params });
  return data;
}

export interface CreateClientInput {
  code: string;
  name: string;
  admin: { name: string; email: string; mobile: string };
}

export interface CreateClientResult {
  client: Client;
  admin: { id: number; email: string; temporaryPassword: string };
}

export async function createClient(input: CreateClientInput): Promise<CreateClientResult> {
  const { data } = await http.post('/admin/clients', input);
  return data;
}

export async function updateClient(id: number, name: string): Promise<Client> {
  const { data } = await http.patch(`/admin/clients/${id}`, { name });
  return data;
}

export async function setClientActive(id: number, active: boolean): Promise<Client> {
  const { data } = await http.post(`/admin/clients/${id}/${active ? 'reactivate' : 'deactivate'}`);
  return data;
}

export async function deleteClient(id: number): Promise<void> {
  await http.delete(`/admin/clients/${id}`);
}
