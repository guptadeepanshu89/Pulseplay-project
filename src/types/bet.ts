import type { BadgeStatus } from '@components/common';

export type BetStatus = 'OPEN' | 'WON' | 'LOST' | 'VOID' | 'SETTLED';

export const BET_STATUS_BADGE: Record<BetStatus, BadgeStatus> = {
  OPEN: 'OPEN',
  WON: 'WON',
  LOST: 'LOST',
  VOID: 'VOID',
  SETTLED: 'NEUTRAL',
};

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
  selections: BetSelectionLeg[];
  stake: number;
  combinedOdds: number;
  potentialReturn: number;
  status: BetStatus;
  placedAt: string;
  settledAt?: string;
}

export interface BetSlipSelection {
  eventId: number;
  eventName: string;
  marketId: number;
  marketName: string;
  selectionId: number;
  selectionName: string;
  price: number;
}
