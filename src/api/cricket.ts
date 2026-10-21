import { apiRequest } from './client';

export interface ProviderEnvelope {
  source: 'provider';
  provider: string;
  delayed: boolean;
  stale: boolean;
  fetchedAt: string;
  data: unknown;
  normalized?: {
    matches?: LiveMatchOption[];
    match?: LiveMatchOption;
    lines?: { id: string; text: string }[];
  };
}

export interface SimulatorDelivery {
  id: string;
  timestamp: string;
  over: string;
  kind: string;
  legal: boolean;
  totalRuns: number;
  wicket: boolean;
  commentary: string;
  striker: string;
  bowler: string;
}

export interface SimulatorMatch {
  source: 'simulator';
  simulated: true;
  status: string;
  teams: { batting: string; bowling: string };
  innings: number;
  runs: number;
  wickets: number;
  extras: number;
  overs: string;
  striker: string;
  nonStriker: string;
  bowler: string;
  deliveries: SimulatorDelivery[];
  updatedAt: string;
}

export function getCricketLive(signal?: AbortSignal): Promise<ProviderEnvelope> {
  return apiRequest<ProviderEnvelope>('/cricket/live', { signal });
}

export function getCricketScore(matchId: string, signal?: AbortSignal): Promise<ProviderEnvelope> {
  return apiRequest<ProviderEnvelope>(`/cricket/${matchId}/score`, { signal });
}

export function getCricketCommentary(matchId: string, signal?: AbortSignal): Promise<ProviderEnvelope> {
  return apiRequest<ProviderEnvelope>(`/cricket/${matchId}/commentary`, { signal });
}

export function getSimulatorMatch(signal?: AbortSignal): Promise<SimulatorMatch> {
  return apiRequest<SimulatorMatch>('/cricket/test/match', { signal });
}

export function bowlSimulator(kind: string): Promise<SimulatorMatch> {
  return apiRequest<SimulatorMatch>('/cricket/test/next-ball', { method: 'POST', body: { kind } });
}

export function resetSimulator(): Promise<SimulatorMatch> {
  return apiRequest<SimulatorMatch>('/cricket/test/reset', { method: 'POST', body: { maxOvers: 20, maxWickets: 10, seed: 1 } });
}

export interface LiveMatchOption {
  id: string;
  title: string;
  status: string;
  score: string | null;
  teams?: string[];
  startTime?: string | null;
  innings?: string | null;
  venue?: string | null;
}

export function liveMatchOptions(payload: unknown): LiveMatchOption[] {
  const matches = extractMatches(payload);
  return matches
    .map((match): LiveMatchOption | null => {
      if (!match || typeof match !== 'object') return null;
      const record = match as Record<string, unknown>;
      const id = record.match_id ?? record.id;
      if (id === undefined || id === null) return null;
      const teamList = Array.isArray(record.teams)
        ? record.teams.filter((team) => typeof team === 'string' && team.trim().length > 0).map((team) => String(team))
        : [];
      const teams = teamList.length > 0 ? teamList.join(' vs ') : typeof record.teams === 'string' ? record.teams : teamTitle(record);
      const score = formatScore(record.score) ?? teamScore(record);
      const status = typeof record.status === 'string' ? record.status : 'live';
      const title = typeof record.name === 'string' ? record.name : teams;
      return {
        id: String(id),
        title: title || `Match ${id}`,
        status,
        score,
        teams: teamList,
        startTime: typeof record.dateTimeGMT === 'string' ? record.dateTimeGMT : null,
        venue: typeof record.venue === 'string' ? record.venue : null,
      };
    })
    .filter((match): match is LiveMatchOption => match !== null);
}

export function commentaryLines(payload: unknown): { id: string; text: string }[] {
  const rows = extractList(payload, ['commentary', 'balls', 'items', 'data']);
  const lines: { id: string; text: string }[] = [];
  rows.forEach((row, index) => {
    if (typeof row === 'string') {
      lines.push({ id: `line-${index}-${row}`, text: row });
      return;
    }
    if (!row || typeof row !== 'object') return;
    const record = row as Record<string, unknown>;
    const text = [record.commentary, record.text, record.description, record.event].find((value) => typeof value === 'string') as
      | string
      | undefined;
    if (!text) return;
    const id = String(record.id ?? record.ball_id ?? record.timestamp ?? `${index}-${text}`);
    lines.push({ id, text });
  });
  return lines;
}

function extractMatches(payload: unknown): unknown[] {
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as { data?: unknown; matches?: unknown };
  if (Array.isArray(record.matches)) return record.matches;
  if (Array.isArray(record.data)) return record.data;
  if (record.data && typeof record.data === 'object') {
    const nested = record.data as { matches?: unknown };
    if (Array.isArray(nested.matches)) return nested.matches;
  }
  return [];
}

function extractList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    if (Array.isArray(record[key])) return record[key] as unknown[];
  }
  if (record.data && typeof record.data === 'object') return extractList(record.data, keys);
  return [];
}

function teamTitle(record: Record<string, unknown>): string {
  const first = teamName(record.first_team);
  const second = teamName(record.second_team);
  if (first && second) return `${first} vs ${second}`;
  return first || second || '';
}

function teamScore(record: Record<string, unknown>): string | null {
  const first = teamScoreLine(record.first_team);
  const second = teamScoreLine(record.second_team);
  const parts = [first, second].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function teamName(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const team = value as { full_name?: unknown; name?: unknown };
  if (typeof team.full_name === 'string') return team.full_name;
  if (typeof team.name === 'string') return team.name;
  return '';
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

function teamScoreLine(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const score = (value as { score?: unknown }).score;
  return typeof score === 'string' ? score : '';
}
