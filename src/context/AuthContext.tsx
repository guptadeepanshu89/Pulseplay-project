import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useReducer } from 'react';

import { User } from '@/types/user';
import { getMe, login as loginRequest, logout as logoutRequest } from '@/services/authService';
import { setToken } from '@/api/client';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  booting: boolean;
}

type AuthAction =
  | { type: 'BOOT_COMPLETE'; user: User | null }
  | { type: 'LOGIN_SUCCESS'; user: User }
  | { type: 'LOGOUT' };

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  booting: true,
};

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'BOOT_COMPLETE':
      return { isAuthenticated: action.user !== null, user: action.user, booting: false };
    case 'LOGIN_SUCCESS':
      return { isAuthenticated: true, user: action.user, booting: false };
    case 'LOGOUT':
      return { isAuthenticated: false, user: null, booting: false };
    default:
      return state;
  }
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Restore a persisted session (stored token) on app boot, if one exists and is still valid.
    getMe()
      .then((user) => dispatch({ type: 'BOOT_COMPLETE', user }))
      .catch(() => dispatch({ type: 'BOOT_COMPLETE', user: null }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (identifier: string, password: string) => {
        try {
          const { token, user } = await loginRequest(identifier, password);
          await setToken(token);
          dispatch({ type: 'LOGIN_SUCCESS', user });
          return { success: true };
        } catch {
          return { success: false, error: 'Invalid email/mobile number or password.' };
        }
      },
      logout: async () => {
        // Best-effort: even if the request fails (e.g. offline), still clear
        // local state so the user isn't stuck looking logged in.
        await logoutRequest().catch(() => undefined);
        await setToken(null);
        dispatch({ type: 'LOGOUT' });
      },
    }),
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
