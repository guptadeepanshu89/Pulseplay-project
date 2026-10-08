// Mirrors the DTOs the backend actually returns (server/src/modules/*/dto.ts).
// Flags come back as real booleans here — the server converts the DB's 0/1 ints.

export type RoleCode = 'SUPER_ADMIN' | 'CLIENT_ADMIN' | 'CLIENT_USER';

export interface ClientRef {
  id: number;
  code: string;
  name: string;
}

export interface CurrentUser {
  id: number;
  name: string;
  userCode: string;
  email: string;
  mobile: string;
  avatarUrl?: string;
  role: RoleCode;
  mustChangePassword: boolean;
  client: ClientRef | null;
}

export interface Client {
  id: number;
  code: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export interface AdminUser {
  id: number;
  name: string;
  userCode: string;
  email: string;
  mobile: string;
  role: RoleCode;
  client: ClientRef | null;
  isActive: boolean;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export type FundRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type FundRequestType = 'INCREASE' | 'DECREASE';

export interface FundRequest {
  id: number;
  user: { id: number; name: string; email: string };
  client: { id: number; name: string; code: string };
  type: FundRequestType;
  amount: number;
  reason: string;
  status: FundRequestStatus;
  requestedAt: string;
  resolvedAt?: string;
  resolvedBy?: { id: number; name: string | null };
}

export interface BetSelectionLeg {
  eventId: number;
  eventName: string;
  marketId: number;
  marketName: string;
  selectionId: number;
  selectionName: string;
  oddsAtPlacement: number;
}

export interface Bet {
  id: number;
  userId: number;
  stake: number;
  combinedOdds: number;
  potentialReturn: number;
  status: string;
  legCount: number;
  placedAt: string;
  settledAt?: string;
  selections: BetSelectionLeg[];
}

export interface Dashboard {
  activeUsers: number;
  pendingRequests: number;
  openBets: number;
  openStake: number;
  activeClients?: number; // present only for a SuperAdmin's own-scope (no clientId) view
}

export interface Page<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface MarketSelection {
  id: number;
  marketId: number;
  code: string;
  name: string;
  currentPrice: number;
  status: string;
  sortOrder: number;
}

export interface Market {
  id: number;
  eventId: number;
  marketType: string;
  name: string;
  status: string;
  selections: MarketSelection[];
}

export interface EventSummary {
  id: number;
  category: string;
  name: string;
  competition: string;
  status: string;
}
