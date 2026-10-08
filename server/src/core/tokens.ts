import { CookieOptions, Response } from 'express';
import jwt from 'jsonwebtoken';

import { env } from '../env';
import { AppKind } from './actor';

// Two apps, two cookies. Cookies are not port-scoped on a host, so the admin
// panel and the mobile web preview on localhost would otherwise overwrite
// each other's session; separate names also mean a mobile token can never
// authenticate an admin route (and vice versa).
export const COOKIE_NAME: Record<AppKind, string> = { mobile: 'pulseplay_token', admin: 'pulseplay_admin_token' };
export const TOKEN_TTL_SECONDS: Record<AppKind, number> = { mobile: 7 * 24 * 60 * 60, admin: 8 * 60 * 60 };

export interface TokenClaims {
  userId: number;
  app: AppKind;
  // Credential version: the user's passwordChangedAt (epoch ms) when the token was
  // issued, 0 if never changed. Any password change/reset makes it stale, exactly
  // (a JWT `iat` is whole seconds and can't tell "before" from "just after").
  passwordVersion: number;
}

export const passwordVersionOf = (passwordChangedAt: Date | null) => passwordChangedAt?.getTime() ?? 0;

export function signToken({ userId, app, passwordVersion }: TokenClaims): string {
  return jwt.sign({ sub: String(userId), app, pv: passwordVersion }, env.jwtSecret, { expiresIn: TOKEN_TTL_SECONDS[app] });
}

// Returns null for anything that isn't a well-formed, correctly signed, unexpired token of ours.
export function verifyToken(token: string): TokenClaims | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload;
    const userId = Number(payload.sub);
    if (!Number.isInteger(userId) || (payload.app !== 'mobile' && payload.app !== 'admin') || typeof payload.pv !== 'number') {
      return null;
    }
    return { userId, app: payload.app, passwordVersion: payload.pv };
  } catch {
    return null;
  }
}

const cookieOptions = (app: AppKind): CookieOptions => ({
  httpOnly: true,
  secure: env.isProduction,
  sameSite: 'lax',
  maxAge: TOKEN_TTL_SECONDS[app] * 1000,
  path: '/',
});

export function setAuthCookie(res: Response, app: AppKind, token: string): void {
  res.cookie(COOKIE_NAME[app], token, cookieOptions(app));
}

// Only a Set-Cookie response can clear an httpOnly cookie.
export function clearAuthCookie(res: Response, app: AppKind): void {
  res.clearCookie(COOKIE_NAME[app], { path: '/' });
}
