export type WalletTransactionType =
  | 'BET_LOCK'
  | 'BET_SETTLEMENT'
  | 'BET_REFUND'
  | 'ADMIN_CREDIT'
  | 'ADMIN_DEBIT'
  | 'ADJUSTMENT';

export type WalletTransactionStatus = 'PENDING' | 'COMPLETED' | 'APPROVED' | 'REJECTED';

export interface Wallet {
  availableBalance: number;
  lockedBalance: number;
  currency: string;
}

export interface WalletTransaction {
  id: number;
  type: WalletTransactionType;
  amount: number;
  status: WalletTransactionStatus;
  createdAt: string;
}

export type WalletRequestType = 'INCREASE' | 'DECREASE';
export type WalletRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface WalletRequest {
  id: number;
  type: WalletRequestType;
  amount: number;
  reason: string;
  status: WalletRequestStatus;
  requestedAt: string;
  resolvedAt?: string;
}
