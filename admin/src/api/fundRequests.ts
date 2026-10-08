import { http } from './client';
import type { FundRequest, FundRequestStatus, Page } from '../types';

export interface ListFundRequestsParams {
  page?: number;
  pageSize?: number;
  status?: FundRequestStatus;
  userId?: number;
  clientId?: number; // SuperAdmin only
}

export async function listFundRequests(params: ListFundRequestsParams): Promise<Page<FundRequest>> {
  const { data } = await http.get('/admin/wallet-requests', { params });
  return data;
}

export async function resolveFundRequest(id: number, decision: 'approve' | 'reject'): Promise<FundRequest> {
  const { data } = await http.post(`/admin/wallet-requests/${id}/${decision}`);
  return data;
}
