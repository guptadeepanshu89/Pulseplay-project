import { apiRequest } from './client';

export interface DemoSnapshot {
  demo: true;
  synthetic: true;
  settlesBets: false;
  id: 'demo-market';
  title: string;
  status: string;
  version: number;
  price: number;
  updatedAt: string;
}

export function getDemoSnapshot(signal?: AbortSignal): Promise<DemoSnapshot> {
  return apiRequest<DemoSnapshot>('/demo/snapshot', { signal });
}

export function tickDemo(): Promise<DemoSnapshot> {
  return apiRequest<DemoSnapshot>('/demo/tick', { method: 'POST' });
}
