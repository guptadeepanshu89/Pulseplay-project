import { apiRequest } from '@/api/client';
import { Wallet, WalletRequest, WalletTransaction } from '@/types/wallet';

export async function getWallet(): Promise<Wallet> {
  return apiRequest<Wallet>('/wallet');
}

export async function getWalletTransactions(): Promise<WalletTransaction[]> {
  return apiRequest<WalletTransaction[]>('/wallet/transactions');
}

export async function getWalletRequests(): Promise<WalletRequest[]> {
  return apiRequest<WalletRequest[]>('/wallet/requests');
}

export async function createWalletRequest(
  type: WalletRequest['type'],
  amount: number,
  reason = '',
): Promise<WalletRequest> {
  return apiRequest<WalletRequest>('/wallet/requests', {
    method: 'POST',
    body: { type, amount, reason },
  });
}
