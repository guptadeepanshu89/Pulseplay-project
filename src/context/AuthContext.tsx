import { createContext, PropsWithChildren, useContext, useEffect, useMemo, useReducer } from 'react';

import { User } from '@/types/user';
import { getMe, login as loginRequest, logout as logoutRequest } from '@/services/authService';
import { ApiError, setToken } from '@/api/client';
import { readableErrorMessage } from '@/api/errorMessage';
import { disconnectLive, reconnectLive } from '@/realtime/live';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  booting: boolean;
}

type AuthAction =
  | { type: 'BOOT_COMPLETE'; user: User | null }
  | { type: 'LOGIN_SUCCESS'; user: User }
  | { type: 'PASSWORD_CHANGED' }
  | { type: 'LOGOUT' };

interface LoginResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue extends AuthState {
  login: (identifier: string, password: string) => Promise<LoginResult>;
  logout: () => Promise<void>;
  markPasswordChanged: () => void;
}

const initialState: AuthState = {
  isAuthenticated: false,
  user: null,
  booting: true,
};

function withPasswordFlag(user: User): User {
  return { ...user, mustChangePassword: Boolean(user.mustChangePassword) };
}

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'BOOT_COMPLETE':
      return {
        isAuthenticated: action.user !== null,
        user: action.user ? withPasswordFlag(action.user) : null,
        booting: false,
      };
    case 'LOGIN_SUCCESS':
      return { isAuthenticated: true, user: withPasswordFlag(action.user), booting: false };
    case 'PASSWORD_CHANGED':
      return state.user
        ? { ...state, user: { ...state.user, mustChangePassword: false } }
        : state;
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
      .catch(async () => {
        await setToken(null);
        dispatch({ type: 'BOOT_COMPLETE', user: null });
      });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      login: async (identifier: string, password: string) => {
        try {
          const { token, user } = await loginRequest(identifier, password);
          await setToken(token);
          dispatch({ type: 'LOGIN_SUCCESS', user });
          void reconnectLive();
          return { success: true };
        } catch (error) {
          if (error instanceof ApiError) {
            switch (error.code) {
              case 'ACCOUNT_BLOCKED':
                return { success: false, error: 'This account has been blocked.' };
              case 'CLIENT_INACTIVE':
                return { success: false, error: 'This account is inactive.' };
              case 'WRONG_APP':
                return { success: false, error: 'Use the admin panel to sign in with this account.' };
              case 'INVALID_CREDENTIALS':
                return { success: false, error: 'Invalid email/mobile number or password.' };
              default:
                if (error.status === 404) return { success: false, error: 'The sign-in service was not found. Check the API address.' };
                if (error.status === 0) return { success: false, error: 'Cannot reach the server. Check your connection and try again.' };
                if (error.status >= 500) return { success: false, error: 'The server could not sign you in. Please try again.' };
                return { success: false, error: readableErrorMessage(error.message) };
            }
          }
          return { success: false, error: 'Cannot reach the server. Check your connection and try again.' };
        }
      },
      logout: async () => {
        // Best-effort: even if the request fails (e.g. offline), still clear
        // local state so the user isn't stuck looking logged in.
        await logoutRequest().catch(() => undefined);
        await setToken(null);
        disconnectLive();
        dispatch({ type: 'LOGOUT' });
      },
      markPasswordChanged: () => dispatch({ type: 'PASSWORD_CHANGED' }),
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
