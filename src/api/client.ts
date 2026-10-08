import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// A physical device/emulator can't resolve the host PC's `localhost`, so
// native needs the LAN IP. The web preview, though, runs in a real browser —
// pointing it at the LAN IP makes it a different *site* than the page itself
// (browsers compare host, not port), which silently blocks the SameSite
// auth cookie. `localhost` keeps web same-site with the API (same host,
// different port only), where SameSite=Lax cookies work correctly.
const LAN_API_BASE_URL = 'http://192.168.1.6:4000/api/v1';
const WEB_API_BASE_URL = 'http://localhost:4000/api/v1';
const API_BASE_URL = Platform.OS === 'web' ? WEB_API_BASE_URL : LAN_API_BASE_URL;
const TOKEN_KEY = 'pulseplay_auth_token';

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// Native has no XSS attack surface the way a web page does, so the token is
// kept in expo-secure-store (OS keychain/keystore) and sent as a Bearer header.
// Web has no equivalent secure storage — any script that runs on the page
// (e.g. via XSS) can read localStorage — so the web client never holds the
// raw token in JS at all; the server sets it as an httpOnly cookie instead
// (invisible to page JS) and the browser attaches it automatically.
async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return null;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }
  if (token) await SecureStore.setItemAsync(TOKEN_KEY, token);
  else await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (!options.skipAuth) {
    const token = await getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    // Sends/accepts the httpOnly auth cookie on web; harmless on native, which
    // doesn't use cookie-based auth at all.
    credentials: 'include',
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message = (data as { error?: string } | undefined)?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }

  return data as T;
}
