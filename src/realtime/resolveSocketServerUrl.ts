const DEFAULT_WEB_API = 'http://localhost:4000/api/v1';
const DEFAULT_WEB_SOCKET = 'http://localhost:4000';

function isLocalWebHost(hostname: string | undefined): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1';
}

function isWebPlatform(platform: string, windowHostname?: string): boolean {
  if (platform === 'web') return true;
  return typeof windowHostname === 'string' && windowHostname.length > 0;
}

/** Resolve Socket.IO server origin (no path). Mirrors web localhost handling in `src/api/client.ts`. */
export function resolveSocketServerUrl(input: {
  platform: string;
  windowHostname?: string;
  expoPublicSocketUrl?: string;
  expoPublicApiUrl?: string;
}): string {
  const configuredApiUrl = input.expoPublicApiUrl?.replace(/\/$/, '') ?? '';

  // Expo web on this machine must never use a tunnel URL for Socket.IO (REST already uses localhost).
  if (isWebPlatform(input.platform, input.windowHostname)) {
    const host = input.windowHostname ?? 'localhost';
    if (isLocalWebHost(host)) return DEFAULT_WEB_SOCKET;
    const explicit = input.expoPublicSocketUrl?.replace(/\/$/, '') ?? '';
    if (explicit) return explicit;
    return (configuredApiUrl || DEFAULT_WEB_API).replace(/\/api\/v1$/, '');
  }

  const explicit = input.expoPublicSocketUrl?.replace(/\/$/, '') ?? '';
  if (explicit) return explicit;

  return configuredApiUrl.replace(/\/api\/v1$/, '');
}
