import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

import { Wallet } from '@/types/wallet';
import { useAlwaysLive, WALLET_SOCKET_TYPES } from '@/realtime/live';
import { getWallet } from '@/services/walletService';
import { useLoadOnMount } from '@hooks/useLoadOnMount';

interface WalletContextValue {
  wallet: Wallet | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: PropsWithChildren) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setWallet(await getWallet());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot reach the server. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useLoadOnMount(refresh);
  // Socket entity events only — no global poll/reconnect HTTP (Wallet tab refreshes on focus).
  useAlwaysLive(refresh, [...WALLET_SOCKET_TYPES]);

  const value = useMemo<WalletContextValue>(() => ({ wallet, loading, error, refresh }), [wallet, loading, error, refresh]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
