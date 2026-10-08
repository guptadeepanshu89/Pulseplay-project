import { http } from './client';
import type { Dashboard } from '../types';

export async function fetchDashboard(clientId?: number): Promise<Dashboard> {
  const { data } = await http.get('/admin/dashboard', { params: clientId ? { clientId } : undefined });
  return data;
}
