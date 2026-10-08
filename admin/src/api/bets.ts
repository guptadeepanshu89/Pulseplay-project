import { http } from './client';
import type { Bet } from '../types';

// Not paginated server-side (report-style export, see server/src/modules/bets/routes.ts) —
// `clientId` narrows it for a SuperAdmin; a Client Admin always sees only their own.
export async function listBets(clientId?: number): Promise<Bet[]> {
  const { data } = await http.get('/admin/bets', { params: clientId ? { clientId } : undefined });
  return data;
}
