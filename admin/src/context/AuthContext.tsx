import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { fetchMe, login as loginRequest, logout as logoutRequest } from '../api/auth';
import { isApiError, SESSION_EXPIRED_EVENT } from '../api/client';
import type { CurrentUser } from '../types';

interface AuthContextValue {
  user: CurrentUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<CurrentUser>;
  logout: () => Promise<void>;
  // Called after a successful change-password, so the gate lifts without a full reload.
  setUser: (user: CurrentUser) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // The session lives in an httpOnly cookie the page can't read, so the only
    // way to know if one exists on load is to ask the server.
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    const next = await loginRequest(identifier, password);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      setUser(null);
    }
  }, []);

  return <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}

export const messageOf = (error: unknown): string => {
  if (!isApiError(error)) return 'Something went wrong — please try again';
  const details = error.details?.map((d) => d.message).filter(Boolean);
  if (details && details.length > 0) return details.join(' · ');
  return error.message;
};
