import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { readApiError } from './errorMessage';

// Configure via EXPO_PUBLIC_API_URL (e.g. http://192.168.x.x:4000/api/v1 for a
// physical device). Web defaults to localhost so SameSite cookies stay same-site
// with the Vite/Expo preview on the same host.
const DEFAULT_WEB_API_BASE_URL = 'http://localhost:4000/api/v1';
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
// Web on this computer stays on localhost so auth cookies remain same-site.
// Web opened from another device (Expo tunnel or a LAN address) must not use
// localhost — that would be the phone itself. Native always uses EXPO_PUBLIC_API_URL.
function resolveApiBaseUrl(): string {
  if (Platform.OS !== 'web') return configuredApiUrl;
  const host = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const onThisMachine = host === 'localhost' || host === '127.0.0.1';
  if (onThisMachine) return DEFAULT_WEB_API_BASE_URL;
  return configuredApiUrl || DEFAULT_WEB_API_BASE_URL;
}

const API_BASE_URL = resolveApiBaseUrl();

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
export async function getToken(): Promise<string | null> {
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
  signal?: AbortSignal;
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
    signal: options.signal,
  }).catch((error: unknown) => {
    if (options.signal?.aborted || (error instanceof Error && error.name === 'AbortError')) {
      throw new ApiError(0, 'Aborted', 'ABORTED');
    }
    throw new ApiError(0, 'Cannot reach the server. Check your connection and try again.');
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const data = await response.json().catch(() => undefined);

  if (!response.ok) {
    const parsed = readApiError(data, response.status);
    throw new ApiError(response.status, parsed.message, parsed.code);
  }

  return data as T;
}
