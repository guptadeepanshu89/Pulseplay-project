import { createContext, PropsWithChildren, useCallback, useContext, useMemo, useState } from 'react';

import { Wallet } from '@/types/wallet';
import { getWallet } from '@/services/walletService';
import { useLoadOnMount } from '@hooks/useLoadOnMount';

interface WalletContextValue {
  wallet: Wallet | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const WalletContext = createContext<WalletContextValue | undefined>(undefined);

export function WalletProvider({ children }: PropsWithChildren) {
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const result = await getWallet();
    setWallet(result);
    setLoading(false);
  }, []);

  useLoadOnMount(refresh);

  const value = useMemo<WalletContextValue>(() => ({ wallet, loading, refresh }), [wallet, loading, refresh]);

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
