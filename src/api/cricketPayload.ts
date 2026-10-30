/** Parsers for CricketData / CricAPI payloads. Missing fields stay omitted — never invented. */

export interface TeamInfo {
  name: string;
  shortName: string;
  imageUrl?: string;
}

export interface InningsScore {
  team?: string;
  inningLabel?: string;
  runs: number;
  wickets: number;
  overs?: number;
}

export interface BatterLine {
  name: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  dismissal?: string;
  batting?: boolean;
}

export interface BowlerLine {
  name: string;
  overs?: number;
  maidens?: number;
  runs?: number;
  wickets?: number;
  economy?: number;
}

export interface ScorecardInnings {
  inningLabel?: string;
  batting: BatterLine[];
  bowling: BowlerLine[];
}

export type BallKind = 'dot' | 'run' | 'boundary' | 'wicket' | 'wide' | 'noball' | 'unknown';

export interface BallDelivery {
  id: string;
  inning?: number | string;
  overs?: number;
  overBall?: string;
  batsman?: string;
  nonStriker?: string;
  bowler?: string;
  runs?: number;
  extras?: string;
  wicket?: string;
  event?: string;
  commentary?: string;
  kind: BallKind;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function unwrapData(payload: unknown): Record<string, unknown> | unknown[] | null {
  const root = asRecord(payload);
  if (!root) return Array.isArray(payload) ? payload : null;
  const data = root.data;
  if (Array.isArray(data)) return data;
  const inner = asRecord(data);
  if (inner) return inner;
  return root;
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed !== 'undefined' && trimmed !== 'null' ? trimmed : undefined;
}

function asNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = asString(record[key]);
    if (value) return value;
  }
  return undefined;
}

export function formatCricketOvers(overs: number): string {
  if (!Number.isFinite(overs)) return '';
  if (Number.isInteger(overs)) return String(overs);
  return overs.toFixed(1).replace(/\.0$/, '');
}

/** Cricket notation 18.2 means 18 overs + 2 balls, not 18.2 decimal overs. */
export function oversToDecimal(overs: number): number | undefined {
  if (!Number.isFinite(overs) || overs < 0) return undefined;
  const whole = Math.floor(overs + 1e-9);
  const balls = Math.round((overs - whole) * 10);
  if (balls < 0 || balls > 5) return overs;
  return whole + balls / 6;
}

export function parseTeamInfo(payload: unknown): TeamInfo[] {
  const data = unwrapData(payload);
  const row = Array.isArray(data) ? null : data;
  const teams = row?.teamInfo ?? row?.teaminfo;
  if (!Array.isArray(teams)) return [];
  return teams.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const name = firstString(record, ['name', 'teamName', 'team']);
    if (!name) return [];
    const shortName = firstString(record, ['shortname', 'shortName', 'short']) ?? abbreviationFromName(name);
    const imageUrl = firstString(record, ['img', 'image', 'flag', 'logo']);
    return [{ name, shortName, ...(imageUrl ? { imageUrl } : {}) }];
  });
}

export function abbreviationFromName(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join('')
    .toUpperCase();
}

export function parseInningsScores(payload: unknown): InningsScore[] {
  const data = unwrapData(payload);
  const row = Array.isArray(data) ? null : data;
  const score = row?.score;
  if (!Array.isArray(score)) return [];
  return score.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const runs = asNumber(record.r ?? record.runs);
    const wickets = asNumber(record.w ?? record.wickets);
    if (runs == null || wickets == null) return [];
    const overs = asNumber(record.o ?? record.overs);
    const inningLabel = firstString(record, ['inning', 'inningName', 'name']);
    const team = inningLabel ? inningLabel.replace(/\s+Inning.*$/i, '').trim() : undefined;
    return [{ runs, wickets, ...(overs != null ? { overs } : {}), ...(inningLabel ? { inningLabel } : {}), ...(team ? { team } : {}) }];
  });
}

function parseBatter(record: Record<string, unknown>): BatterLine | null {
  const name = firstString(record, ['batsman', 'batter', 'name', 'player']);
  if (!name) return null;
  const dismissal = firstString(record, ['dismissal', 'out', 'howOut']);
  const batting = /not\s*out|^batting$|^\*$/i.test(dismissal ?? '') || name.includes('*');
  return {
    name: name.replace(/\*$/, '').trim(),
    runs: asNumber(record.r ?? record.runs),
    balls: asNumber(record.b ?? record.balls),
    fours: asNumber(record['4s'] ?? record.fours),
    sixes: asNumber(record['6s'] ?? record.sixes),
    strikeRate: asNumber(record.sr ?? record.strikeRate),
    ...(dismissal ? { dismissal } : {}),
    batting,
  };
}

function parseBowler(record: Record<string, unknown>): BowlerLine | null {
  const name = firstString(record, ['bowler', 'name', 'player']);
  if (!name) return null;
  return {
    name,
    overs: asNumber(record.o ?? record.overs),
    maidens: asNumber(record.m ?? record.maidens),
    runs: asNumber(record.r ?? record.runs),
    wickets: asNumber(record.w ?? record.wickets),
    economy: asNumber(record.eco ?? record.economy),
  };
}

export function parseScorecard(payload: unknown): ScorecardInnings[] {
  const data = unwrapData(payload);
  const row = Array.isArray(data) ? null : data;
  const cards = row?.scorecard ?? row?.scoreCard;
  if (!Array.isArray(cards)) return [];
  return cards.flatMap((item) => {
    const record = asRecord(item);
    if (!record) return [];
    const battingRaw = record.batting ?? record.batsmen;
    const bowlingRaw = record.bowling ?? record.bowlers;
    const batting = Array.isArray(battingRaw)
      ? battingRaw.flatMap((batter) => {
          const parsed = asRecord(batter) ? parseBatter(asRecord(batter)!) : null;
          return parsed ? [parsed] : [];
        })
      : [];
    const bowling = Array.isArray(bowlingRaw)
      ? bowlingRaw.flatMap((bowler) => {
          const parsed = asRecord(bowler) ? parseBowler(asRecord(bowler)!) : null;
          return parsed ? [parsed] : [];
        })
      : [];
    if (batting.length === 0 && bowling.length === 0) return [];
    const inningLabel = firstString(record, ['inning', 'inningName', 'name']);
    return [{ ...(inningLabel ? { inningLabel } : {}), batting, bowling }];
  });
}

function classifyBall(event: string | undefined, runs: number | undefined, extras: string | undefined, wicket: string | undefined): BallKind {
  const token = `${event ?? ''} ${extras ?? ''} ${wicket ?? ''}`.toLowerCase();
  if (/\bwd\b|wide/.test(token)) return 'wide';
  if (/\bnb\b|no[\s-]?ball/.test(token)) return 'noball';
  if (wicket || /(^|\s)w(\s|$)|wicket|\bout\b/.test(token)) return 'wicket';
  if (runs === 4 || runs === 6) return 'boundary';
  if (event && /^[46]$/.test(event.trim())) return 'boundary';
  if (runs === 0 || /\bdot\b/.test(token) || event?.trim() === '0') return 'dot';
  if (runs != null && runs > 0) return 'run';
  if (event && /^[1-3]$/.test(event.trim())) return 'run';
  return 'unknown';
}

function overBallFromOvers(overs: number | undefined, over?: number, ball?: number): string | undefined {
  if (over != null && ball != null && Number.isFinite(over) && Number.isFinite(ball)) {
    return `${over}.${ball}`;
  }
  if (overs == null || !Number.isFinite(overs)) return undefined;
  return formatCricketOvers(overs);
}

export function parseBallByBall(payload: unknown): BallDelivery[] {
  const data = unwrapData(payload);
  const row = Array.isArray(data) ? null : data;
  const list = Array.isArray(data)
    ? data
    : Array.isArray(row?.bbb)
      ? row!.bbb
      : Array.isArray(row?.commentary)
        ? row!.commentary
        : Array.isArray(row?.lines)
          ? row!.lines
          : [];
  const deliveries: BallDelivery[] = [];
  list.forEach((item, index) => {
    const record = asRecord(item);
    if (!record) {
      const text = asString(item);
      if (text) deliveries.push({ id: `line-${index}`, kind: 'unknown', commentary: text });
      return;
    }
    const commentary = firstString(record, ['commentary', 'text', 'description', 'event', 'comm']);
    const event = firstString(record, ['event', 'nrun', 'runs_event']);
    const extras = firstString(record, ['extras', 'extra', 'extraType']);
    const wicket = firstString(record, ['wicket', 'dismissal', 'out']);
    const runs = asNumber(record.runs ?? record.nruns ?? record.total ?? record.r);
    const overs = asNumber(record.overs ?? record.over_ball ?? record.o);
    const over = asNumber(record.over);
    const ball = asNumber(record.ball);
    const overBall = overBallFromOvers(overs, over, ball) ?? asString(record.overBall);
    const kind = classifyBall(event ?? commentary, runs, extras, wicket);
    const hasAny = commentary || event || overBall || runs != null || extras || wicket;
    if (!hasAny) return;
    deliveries.push({
      id: firstString(record, ['id']) ?? `${overBall ?? 'ball'}-${index}`,
      inning: asNumber(record.inning) ?? asString(record.inning),
      ...(overs != null ? { overs } : {}),
      ...(overBall ? { overBall } : {}),
      batsman: firstString(record, ['batsman', 'batter', 'striker']),
      nonStriker: firstString(record, ['nonstriker', 'nonStriker', 'non_striker']),
      bowler: firstString(record, ['bowler']),
      ...(runs != null ? { runs } : {}),
      ...(extras ? { extras } : {}),
      ...(wicket ? { wicket } : {}),
      ...(event ? { event } : {}),
      ...(commentary ? { commentary } : {}),
      kind,
    });
  });
  return deliveries;
}

export function parseProviderStatus(payload: unknown): string | undefined {
  const data = unwrapData(payload);
  const row = Array.isArray(data) ? null : data;
  return firstString(row ?? {}, ['status', 'matchStatus', 'ms']);
}

/** CricketData match_info may expose bbbEnabled; when false, skip match_bbb to save quota. */
export function parseBbbEnabled(payload: unknown): boolean | undefined {
  const data = unwrapData(payload);
  const row = Array.isArray(data) ? null : data;
  if (!row || !('bbbEnabled' in row)) return undefined;
  return row.bbbEnabled === true;
}

export function isCricketMatchUuid(value: string | undefined | null): boolean {
  return Boolean(value && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim()));
}

export function parseChaseFromStatus(status: string): { needs?: number; balls?: number } | null {
  const needs = /needs\s+(\d+)\s+runs/i.exec(status);
  const balls = /in\s+(\d+)\s+balls/i.exec(status);
  if (!needs && !balls) return null;
  return {
    ...(needs ? { needs: Number(needs[1]) } : {}),
    ...(balls ? { balls: Number(balls[1]) } : {}),
  };
}

export function ballLabel(delivery: BallDelivery): string {
  if (delivery.kind === 'wicket') return 'W';
  if (delivery.kind === 'wide') return 'Wd';
  if (delivery.kind === 'noball') return 'Nb';
  if (delivery.kind === 'dot') return '•';
  if (delivery.runs != null) return String(delivery.runs);
  const event = delivery.event?.trim();
  if (event && event.length <= 3) return event;
  return '•';
}
