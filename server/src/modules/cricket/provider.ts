import { AppError } from '../../core/errors';
import { emitAll } from '../../realtime/hub';
import { noteProvider, safeError } from '../../realtime/runtime';

// CricketData.org (CricAPI), checked 2026-10-17.
// Free plan: https://cricketdata.org/pricing/ — 100 hits/day, same endpoints as paid.
// Auth is the apikey query parameter, not a header.
// Live list: GET https://api.cricapi.com/v1/currentMatches?apikey=KEY&offset=0
// Match:    GET /v1/match_info?apikey=KEY&id=UUID
// Scorecard: GET /v1/match_scorecard?apikey=KEY&id=UUID
// Ball-by-ball: GET /v1/match_bbb?apikey=KEY&id=UUID
// A bad key returns HTTP 200 { status: "failure", reason: "Invalid API Key" }.
// Free scores are entered manually and can lag by about a minute. There is no WebSocket on the free plan.

export interface CricketConfig {
  apiKey: string;
  baseUrl: string;
  provider: string;
  timeoutMs: number;
  cacheMs: number;
  dailyHitCap: number;
  livePath: string;
  infoPath: string;
  scorecardPath: string;
  commentaryPath: string;
}

export interface NormalizedMatch {
  id: string;
  title: string;
  status: string;
  score: string | null;
  startTime: string | null;
  innings: string | null;
  venue: string | null;
}

export interface CricketPayload {
  source: 'provider';
  provider: string;
  delayed: boolean;
  stale: boolean;
  fetchedAt: string;
  data: unknown;
  normalized?: {
    matches?: NormalizedMatch[];
    match?: NormalizedMatch;
    lines?: { id: string; text: string }[];
  };
}

interface CacheEntry {
  at: number;
  payload: CricketPayload;
}

const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<CricketPayload>>();
const emittedCricket = new Map<string, string>();
let nowFn = (): Date => new Date();
let quota = { day: '', hits: 0 };

export function setCricketClock(clock: () => Date): void {
  nowFn = clock;
}

export function cricketConfig(): CricketConfig {
  return {
    apiKey: process.env.CRICKET_API_KEY?.trim() ?? '',
    baseUrl: (process.env.CRICKET_API_BASE ?? 'https://api.cricapi.com/v1').replace(/\/$/, ''),
    provider: process.env.CRICKET_API_PROVIDER?.trim() || 'cricapi',
    timeoutMs: positiveInt(process.env.CRICKET_API_TIMEOUT_MS, 10_000),
    cacheMs: positiveInt(process.env.CRICKET_POLL_INTERVAL_MS, 180_000),
    dailyHitCap: positiveInt(process.env.CRICKET_API_DAILY_HIT_CAP, 80),
    livePath: process.env.CRICKET_API_LIVE_PATH?.trim() || '/currentMatches?offset=0',
    infoPath: process.env.CRICKET_API_INFO_PATH?.trim() || '/match_info',
    scorecardPath: process.env.CRICKET_API_SCORECARD_PATH?.trim() || '/match_scorecard',
    commentaryPath: process.env.CRICKET_API_COMMENTARY_PATH?.trim() || '/match_bbb',
  };
}

export function warnCricketConfig(): void {
  if (!cricketConfig().apiKey) {
    console.warn('[cricket] CRICKET_API_KEY is not set. Live cricket routes return 503 until a free CricketData.org key is added. The simulator still works.');
  }
}

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function assertMatchId(matchId: string): string {
  if (!/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(matchId)) {
    throw new AppError(400, 'INVALID_MATCH_ID', 'Match id must be a CricketData UUID');
  }
  return matchId;
}

export function clearCricketCache(): void {
  cache.clear();
  inflight.clear();
  emittedCricket.clear();
  nowFn = () => new Date();
  quota = { day: dayKey(nowFn()), hits: 0 };
}

function dayKey(now: Date): string {
  return now.toISOString().slice(0, 10);
}

function currentQuota(): { day: string; hits: number } {
  const day = dayKey(nowFn());
  if (quota.day !== day) quota = { day, hits: 0 };
  return quota;
}

function logQuota(event: string): void {
  const state = currentQuota();
  console.info(`[cricket] ${event}: ${state.hits}/${cricketConfig().dailyHitCap} on ${state.day}`);
}

function providerHitsToday(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null;
  const reported = (body as { info?: { hitsToday?: unknown } }).info?.hitsToday;
  return typeof reported === 'number' && Number.isFinite(reported) && reported >= 0 ? reported : null;
}

function rememberProviderHit(body: unknown): void {
  const state = currentQuota();
  const reported = providerHitsToday(body);
  state.hits = reported ?? state.hits + 1;
  logQuota(reported === null ? 'counted one provider response' : 'synced provider hitsToday');
}

function providerPaths(matchId?: string) {
  const config = cricketConfig();
  const id = matchId ? `?id=${encodeURIComponent(matchId)}` : '';
  return {
    live: config.livePath,
    score: `${config.infoPath}${id}`,
    scorecard: `${config.scorecardPath}${id}`,
    commentary: `${config.commentaryPath}${id}`,
  };
}

export async function getLiveMatches(): Promise<CricketPayload> {
  return fetchCricket(providerPaths().live);
}

export async function getScorecard(matchId: string): Promise<CricketPayload> {
  return fetchCricket(providerPaths(assertMatchId(matchId)).scorecard);
}

export async function getCommentary(matchId: string): Promise<CricketPayload> {
  return fetchCricket(providerPaths(assertMatchId(matchId)).commentary);
}

export async function getScore(matchId: string): Promise<CricketPayload> {
  return fetchCricket(providerPaths(assertMatchId(matchId)).score);
}

async function fetchCricket(path: string): Promise<CricketPayload> {
  const config = cricketConfig();
  if (!config.apiKey) {
    throw new AppError(503, 'CRICKET_API_KEY_MISSING', 'Cricket provider API key is not configured');
  }

  const cached = cache.get(path);
  if (cached && nowFn().getTime() - cached.at < config.cacheMs) return cached.payload;

  const pending = inflight.get(path);
  if (pending) return pending;

  const request = fetchCricketUncached(path, cached).finally(() => inflight.delete(path));
  inflight.set(path, request);
  return request;
}

async function fetchCricketUncached(path: string, cached: CacheEntry | undefined): Promise<CricketPayload> {
  const config = cricketConfig();
  const state = currentQuota();
  if (state.hits >= config.dailyHitCap) {
    logQuota('daily cap reached');
    if (cached) return { ...cached.payload, delayed: true, stale: true };
    throw new AppError(429, 'PROVIDER_RATE_LIMITED', `CricketData daily allowance reached (${state.hits}/${config.dailyHitCap} on ${state.day}).`);
  }

  const url = withApiKey(joinProviderUrl(config.baseUrl, path), config.apiKey);
  let response: Response;
  try {
    response = await fetchWithRetry(url, config.timeoutMs);
  } catch (error) {
    noteProvider('cricket', 'error', error);
    console.warn(`[cricket] request failed path=${path} url=${redactProviderUrl(url)} ${error instanceof Error ? error.name : 'error'}`);
    const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
    if (cached) return { ...cached.payload, delayed: true, stale: true };
    if (timedOut) {
      throw new AppError(504, 'PROVIDER_TIMEOUT', 'The cricket provider did not respond in time');
    }
    throw new AppError(502, 'PROVIDER_UNAVAILABLE', 'The cricket provider could not be reached');
  }

  const text = await response.text();
  const parsed = parseProviderJson(text);
  if (parsed.ok) rememberProviderHit(parsed.body);
  const preview = responsePreview(text, config.apiKey);
  const body = parsed.ok ? parsed.body : null;

  if (response.status === 401) {
    throw providerStatusError(502, 'PROVIDER_UNAUTHORIZED', 'The cricket provider rejected the API key', response.status, body, preview);
  }

  if (response.status === 403) {
    throw providerStatusError(502, 'PROVIDER_FORBIDDEN', 'The cricket provider refused this request', response.status, body, preview);
  }

  if (response.status === 404) {
    throw providerStatusError(
      404,
      path.includes('match_bbb') ? 'COMMENTARY_UNAVAILABLE' : 'MATCH_NOT_FOUND',
      'The cricket provider has no data for this request',
      response.status,
      body,
      preview,
    );
  }

  if (response.status === 429 || (parsed.ok && isQuotaMessage(body))) {
    if (cached) return { ...cached.payload, delayed: true, stale: true };
    throw providerStatusError(429, 'PROVIDER_RATE_LIMITED', 'Cricket provider rate limit reached', response.status, body, preview);
  }

  if (response.status >= 500) {
    if (cached) return { ...cached.payload, delayed: true, stale: true };
    throw providerStatusError(502, 'PROVIDER_ERROR', 'The cricket provider failed', response.status, body, preview);
  }

  if (!parsed.ok) {
    throw new AppError(502, 'PROVIDER_INVALID_JSON', `The cricket provider returned invalid JSON (HTTP ${response.status}). Response preview: ${preview}`, {
      providerStatus: response.status,
    });
  }

  if (!response.ok) {
    throw providerStatusError(502, 'PROVIDER_ERROR', 'The cricket provider returned an error', response.status, body, preview);
  }

  if (isAuthFailure(body)) {
    throw providerStatusError(502, 'PROVIDER_UNAUTHORIZED', 'The cricket provider rejected the API key', response.status, body, preview);
  }

  if (isQuotaMessage(body)) {
    if (cached) return { ...cached.payload, delayed: true, stale: true };
    throw providerStatusError(429, 'PROVIDER_RATE_LIMITED', 'Cricket provider rate limit reached', response.status, body, preview);
  }

  if (isExplicitFailure(body)) {
    throw new AppError(502, 'PROVIDER_ERROR', providerMessage(body) || 'Cricket provider reported an error', {
      providerStatus: response.status,
    });
  }

  const payload: CricketPayload = {
    source: 'provider',
    provider: config.provider,
    delayed: true,
    stale: false,
    fetchedAt: new Date().toISOString(),
    data: body,
    normalized: normalizePayload(path, body),
  };
  cache.set(path, { at: nowFn().getTime(), payload });
  noteProvider('cricket', 'ok');
  publishCricket(payload);
  return payload;
}

export function redactProviderUrl(url: string): string {
  return url.replace(/([?&]apikey=)[^&]*/gi, '$1redacted');
}

function publishCricket(payload: CricketPayload): void {
  if (payload.stale) return;
  const matches = payload.normalized?.matches ?? (payload.normalized?.match ? [payload.normalized.match] : []);
  for (const match of matches) {
    const facts = inningsFacts(match.id, payload.data);
    const fingerprint = JSON.stringify({
      matchId: match.id,
      status: match.status,
      score: match.score,
      ...facts,
    });
    if (emittedCricket.get(match.id) === fingerprint) continue;
    emittedCricket.set(match.id, fingerprint);
    try {
      emitAll('cricket.updated', 0, {
        matchId: match.id,
        status: match.status,
        ...(match.score ? { score: match.score } : {}),
        ...facts,
        provider: payload.provider,
        asOf: payload.fetchedAt,
      });
    } catch (error) {
      console.warn(`[cricket] socket emit skipped for ${match.id}: ${safeError(error)}`);
    }
  }
}

function inningsFacts(matchId: string, body: unknown): { runs?: number; wickets?: number; overs?: number } {
  const rows = collectMatchRecords(body).filter((row) => String(row.id ?? row.match_id ?? '') === matchId);
  const score = rows[0]?.score;
  if (!Array.isArray(score)) return {};
  const latest = [...score].reverse().find((item) => item && typeof item === 'object' && typeof (item as { r?: unknown }).r === 'number');
  if (!latest || typeof latest !== 'object') return {};
  const row = latest as { r?: unknown; w?: unknown; o?: unknown };
  return {
    ...(typeof row.r === 'number' ? { runs: row.r } : {}),
    ...(typeof row.w === 'number' ? { wickets: row.w } : {}),
    ...(typeof row.o === 'number' ? { overs: row.o } : {}),
  };
}

function collectMatchRecords(body: unknown): Record<string, unknown>[] {
  if (!body || typeof body !== 'object') return [];
  const data = (body as { data?: unknown }).data;
  const values = Array.isArray(data) ? data : data && typeof data === 'object' ? [data] : [body];
  return values.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

async function fetchWithRetry(url: string, timeoutMs: number): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(timeoutMs) });
      if (response.status < 500 || attempt === 1) return response;
    } catch (error) {
      lastError = error;
      if (attempt === 1) throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Cricket provider request failed');
}

function withApiKey(url: string, apiKey: string): string {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}apikey=${encodeURIComponent(apiKey)}`;
}

function joinProviderUrl(baseUrl: string, path: string): string {
  const base = baseUrl.replace(/\/$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  for (const marker of ['/api/v1/cricket', '/api/v1']) {
    if (suffix.startsWith(`${marker}/`) && base.endsWith(marker)) {
      return `${base.slice(0, -marker.length)}${suffix}`;
    }
  }
  return `${base}${suffix}`;
}

function parseProviderJson(text: string): { ok: true; body: unknown } | { ok: false } {
  if (!text.trim()) return { ok: false };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

function responsePreview(text: string, apiKey: string): string {
  const stripped = text
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  let preview = (stripped || '(empty body)').slice(0, 120);
  if (apiKey) preview = preview.split(apiKey).join('[redacted]');
  return preview.replace(/Bearer\s+\S+/gi, 'Bearer [redacted]');
}

function providerStatusError(status: number, code: string, fallback: string, providerStatus: number, body: unknown, preview: string): AppError {
  const message = providerMessage(body);
  const detail = message || preview;
  return new AppError(status, code, `${fallback} (HTTP ${providerStatus}). ${detail}`, {
    providerStatus,
    ...(body && typeof body === 'object' ? { providerBody: body } : {}),
  });
}

function isQuotaMessage(body: unknown): boolean {
  const message = providerMessage(body).toLowerCase();
  return message.includes('quota') || message.includes('rate limit') || message.includes('hits limit') || message.includes('limit exceeded');
}

function isAuthFailure(body: unknown): boolean {
  const message = providerMessage(body).toLowerCase();
  return message.includes('api key') || message.includes('unauthenticated') || message.includes('unauthorized');
}

function isExplicitFailure(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const record = body as { status?: unknown; success?: unknown };
  if (record.status === 'error' || record.status === 'failure') return true;
  if (record.success === false) return true;
  return false;
}

function providerMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const record = body as { message?: unknown; error?: unknown; reason?: unknown };
  const message = record.reason ?? record.message ?? record.error;
  return typeof message === 'string' ? message : '';
}

function normalizePayload(path: string, body: unknown): CricketPayload['normalized'] {
  if (path.includes('match_bbb')) return { lines: commentaryLines(body) };
  if (path.includes('currentMatches') || path.includes('/matches')) {
    return { matches: extractMatches(body).map(normalizeMatch).filter((match): match is NormalizedMatch => match !== null) };
  }
  const match = normalizeMatch(unwrapMatch(body));
  return match ? { match } : {};
}

function unwrapMatch(body: unknown): unknown {
  if (!body || typeof body !== 'object') return body;
  const data = (body as { data?: unknown }).data;
  if (data && typeof data === 'object' && !Array.isArray(data)) return data;
  return body;
}

function normalizeMatch(value: unknown): NormalizedMatch | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const id = record.id ?? record.match_id;
  if (id === undefined || id === null) return null;
  const teams = Array.isArray(record.teams) ? record.teams.filter((team) => typeof team === 'string').join(' vs ') : '';
  const title = typeof record.name === 'string' ? record.name : teams;
  const score = formatScore(record.score);
  const innings = Array.isArray(record.score)
    ? record.score
        .map((item) => (item && typeof item === 'object' && typeof (item as { inning?: unknown }).inning === 'string' ? (item as { inning: string }).inning : ''))
        .filter(Boolean)
        .join(', ') || null
    : null;
  return {
    id: String(id),
    title: title || `Match ${id}`,
    status: typeof record.status === 'string' ? record.status : 'unknown',
    score,
    startTime: typeof record.dateTimeGMT === 'string' ? record.dateTimeGMT : typeof record.date === 'string' ? record.date : null,
    innings,
    venue: typeof record.venue === 'string' ? record.venue : null,
  };
}

function formatScore(score: unknown): string | null {
  if (typeof score === 'string') return score;
  if (!Array.isArray(score)) return null;
  const lines = score
    .map((item) => {
      if (!item || typeof item !== 'object') return '';
      const row = item as { inning?: unknown; r?: unknown; w?: unknown; o?: unknown };
      if (typeof row.r !== 'number') return '';
      const label = typeof row.inning === 'string' ? row.inning : 'Innings';
      return `${label}: ${row.r}/${typeof row.w === 'number' ? row.w : 0} (${typeof row.o === 'number' ? row.o : 0})`;
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join(' · ') : null;
}

function commentaryLines(body: unknown): { id: string; text: string }[] {
  const rows = extractList(body);
  return rows.flatMap((row, index) => {
    if (typeof row === 'string') return [{ id: `line-${index}`, text: row }];
    if (!row || typeof row !== 'object') return [];
    const record = row as Record<string, unknown>;
    const text = [record.commentary, record.text, record.description, record.event].find((value) => typeof value === 'string');
    if (typeof text !== 'string') return [];
    return [{ id: String(record.id ?? record.ball_id ?? `${index}-${text}`), text }];
  });
}

function extractList(body: unknown): unknown[] {
  if (Array.isArray(body)) return body;
  if (!body || typeof body !== 'object') return [];
  const record = body as Record<string, unknown>;
  for (const key of ['commentary', 'balls', 'bbb', 'data']) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  if (record.data && typeof record.data === 'object') return extractList(record.data);
  return [];
}

function extractMatches(body: unknown): unknown[] {
  if (!body || typeof body !== 'object') return [];
  const record = body as { data?: unknown; matches?: unknown };
  if (Array.isArray(record.data)) return record.data;
  if (Array.isArray(record.matches)) return record.matches;
  if (record.data && typeof record.data === 'object') {
    const nested = record.data as { matches?: unknown };
    if (Array.isArray(nested.matches)) return nested.matches;
  }
  return [];
}
