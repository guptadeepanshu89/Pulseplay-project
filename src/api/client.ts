import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

// Configure via EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:4000/api/v1 for a
// physical device). Web defaults to localhost so SameSite cookies stay same-site
// with the Vite/Expo preview on the same host.
const DEFAULT_WEB_API_BASE_URL = 'http://localhost:4000/api/v1';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
// Web stays on localhost so auth cookies remain same-site. Native uses the LAN URL.
const API_BASE_URL = Platform.OS === 'web' ? DEFAULT_WEB_API_BASE_URL : configuredApiUrl;

if (!API_BASE_URL) {
  console.warn(
    '[api] EXPO_PUBLIC_API_URL is not set. Native builds need it (e.g. http://<lan-ip>:4000/api/v1).',
  );
}

const TOKEN_KEY = 'pulseplay_auth_token';

// In-memory only on web: Bearer is preferred by authenticate() over cookies, so a
// leftover admin cookie on localhost cannot override the mobile Player session
// (and mustChangePassword) after login.
let webMemoryToken: string | null = null;

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Native: expo-secure-store + Bearer. Web: httpOnly cookie still set by login,
// plus in-memory Bearer so /auth/me and APIs bind to this app session.
async function getToken(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return webMemoryToken;
  }
  return SecureStore.getItemAsync(TOKEN_KEY);
}

export async function setToken(token: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    webMemoryToken = token;
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
  if (!API_BASE_URL) {
    throw new ApiError(0, 'API base URL is not configured. Set EXPO_PUBLIC_API_URL.');
  }

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
    const body = data as { error?: string; code?: string } | undefined;
    const message = body?.error ?? `Request failed (${response.status})`;
    throw new ApiError(response.status, message, body?.code);
  }

  return data as T;
}
