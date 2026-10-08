import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useReducer } from 'react';

import { Bet, BetSlipSelection } from '@/types/bet';
import { placeBet as placeBetRequest } from '@/services/betService';
import { calculatePotentialReturn } from '@/utils/formatOdds';

import { useWallet } from './WalletContext';

interface BetSlipState {
  selections: BetSlipSelection[];
  stake: number;
  lastPlacedBet: Bet | null;
}

type BetSlipAction =
  | { type: 'TOGGLE_SELECTION'; selection: BetSlipSelection }
  | { type: 'REMOVE_SELECTION'; selectionId: number }
  | { type: 'SET_STAKE'; stake: number }
  | { type: 'BET_PLACED'; bet: Bet };

interface BetSlipContextValue extends BetSlipState {
  totalOdds: number;
  potentialReturn: number;
  toggleSelection: (selection: BetSlipSelection) => void;
  removeSelection: (selectionId: number) => void;
  setStake: (stake: number) => void;
  placeBet: () => Promise<Bet>;
}

const initialState: BetSlipState = { selections: [], stake: 0, lastPlacedBet: null };

function betSlipReducer(state: BetSlipState, action: BetSlipAction): BetSlipState {
  switch (action.type) {
    case 'TOGGLE_SELECTION': {
      const exists = state.selections.some((item) => item.selectionId === action.selection.selectionId);
      if (exists) {
        return {
          ...state,
          selections: state.selections.filter((item) => item.selectionId !== action.selection.selectionId),
        };
      }
      const withoutSameMarket = state.selections.filter((item) => item.marketId !== action.selection.marketId);
      return { ...state, selections: [...withoutSameMarket, action.selection] };
    }
    case 'REMOVE_SELECTION':
      return { ...state, selections: state.selections.filter((item) => item.selectionId !== action.selectionId) };
    case 'SET_STAKE':
      return { ...state, stake: action.stake };
    case 'BET_PLACED':
      return { selections: [], stake: 0, lastPlacedBet: action.bet };
    default:
      return state;
  }
}

const BetSlipContext = createContext<BetSlipContextValue | undefined>(undefined);

export function BetSlipProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(betSlipReducer, initialState);
  const { refresh: refreshWallet } = useWallet();

  const totalOdds = state.selections.reduce((product, item) => product * item.price, 1);
  const potentialReturn = state.selections.length > 0 ? calculatePotentialReturn(state.stake, totalOdds) : 0;

  const placeBet = useCallback(async () => {
    // The backend locks the stake atomically as part of bet placement itself —
    // just pull the authoritative post-lock balance afterward, don't lock again client-side.
    const bet = await placeBetRequest(state.selections, state.stake);
    await refreshWallet();
    dispatch({ type: 'BET_PLACED', bet });
    return bet;
  }, [state.selections, state.stake, refreshWallet]);

  const value = useMemo<BetSlipContextValue>(
    () => ({
      ...state,
      totalOdds,
      potentialReturn,
      toggleSelection: (selection) => dispatch({ type: 'TOGGLE_SELECTION', selection }),
      removeSelection: (selectionId) => dispatch({ type: 'REMOVE_SELECTION', selectionId }),
      setStake: (stake) => dispatch({ type: 'SET_STAKE', stake }),
      placeBet,
    }),
    [state, totalOdds, potentialReturn, placeBet],
  );

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>;
}

export function useBetSlip(): BetSlipContextValue {
  const context = useContext(BetSlipContext);
  if (!context) {
    throw new Error('useBetSlip must be used within a BetSlipProvider');
  }
  return context;
}
