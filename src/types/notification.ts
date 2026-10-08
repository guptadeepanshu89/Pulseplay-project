export type NotificationType =
  | 'WALLET_APPROVED'
  | 'WALLET_REJECTED'
  | 'BET_PLACED'
  | 'BET_SETTLED'
  | 'MARKET_SUSPENDED'
  | 'MARKET_RESUMED'
  | 'ACCOUNT_ALERT';

export interface AppNotification {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}
