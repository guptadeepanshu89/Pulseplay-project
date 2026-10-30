import type { MarketEvent } from '@/types/event';
import {
  abbreviationFromName,
  ballLabel,
  formatCricketOvers,
  isCricketMatchUuid,
  oversToDecimal,
  parseBallByBall,
  parseChaseFromStatus,
  parseInningsScores,
  parseProviderStatus,
  parseScorecard,
  parseTeamInfo,
  type BallDelivery,
  type BallKind,
  type BatterLine,
  type BowlerLine,
  type InningsScore,
  type TeamInfo,
} from '@/api/cricketPayload';
import { shouldHideLiveScores } from '@utils/eventScoreDisplay';

export type CricketUiStatus = 'LIVE' | 'UPCOMING' | 'BREAK' | 'COMPLETED';

export interface CricketTeamHeader {
  name: string;
  shortName: string;
  imageUrl?: string;
  score?: string;
  overs?: string;
}

export type CricketUnavailableReason =
  | 'UNMAPPED'
  | 'PROVIDER_EMPTY'
  | 'PROVIDER_ERROR'
  | 'SCORES_HIDDEN';

export interface CricketHeaderView {
  status: CricketUiStatus;
  scoresUnavailable: boolean;
  unavailableReason?: CricketUnavailableReason;
  unavailableMessage?: string;
  home: CricketTeamHeader;
  away: CricketTeamHeader;
  battingScore?: string;
  oversLabel?: string;
  inningsLabel?: string;
  target?: string;
  currentRunRate?: string;
  requiredRunRate?: string;
  providerStatus?: string;
}

export interface CricketBatterView {
  name: string;
  role: 'striker' | 'non-striker';
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
}

export interface CricketBowlerView {
  name: string;
  overs?: string;
  runs?: number;
  wickets?: number;
  economy?: number;
}

export interface CricketBallView {
  id: string;
  label: string;
  kind: BallKind;
}

export interface CricketCommentaryView {
  id: string;
  overBall?: string;
  text: string;
  extras?: string;
  wicket?: string;
}

export interface CricketMatchView {
  header: CricketHeaderView;
  batters: CricketBatterView[];
  battersUnavailable: boolean;
  bowler?: CricketBowlerView;
  bowlingUnavailable: boolean;
  currentOver: CricketBallView[];
  currentOverLabel?: string;
  commentary: CricketCommentaryView[];
  commentaryUnavailable: boolean;
  scorecardsUnavailable: boolean;
  loading: boolean;
}

export function cricketUiStatus(event: MarketEvent, providerStatus?: string): CricketUiStatus {
  const code = event.status.toUpperCase();
  if (code === 'COMPLETED' || code === 'SETTLED') return 'COMPLETED';
  if (code === 'SCHEDULED') return 'UPCOMING';
  const text = `${providerStatus ?? ''} ${event.minuteLabel ?? ''}`.toLowerCase();
  if (/\bbreak\b|innings break|lunch|tea|dinner|rain|delay|stumps|drinks/.test(text)) return 'BREAK';
  if (code === 'LIVE' || code === 'OPEN') return 'LIVE';
  if (code === 'SUSPENDED') return 'BREAK';
  return 'UPCOMING';
}

function parseScoreLabel(label?: string): { runs: number; wickets: number } | undefined {
  if (!label) return undefined;
  const match = /(\d+)\s*\/\s*(\d+)/.exec(label);
  if (!match) return undefined;
  return { runs: Number(match[1]), wickets: Number(match[2]) };
}

function parseOversLabel(label?: string): number | undefined {
  if (!label) return undefined;
  const match = /(\d+(?:\.\d+)?)/.exec(label);
  if (!match) return undefined;
  return Number(match[1]);
}

function teamFromEvent(
  side: MarketEvent['homeTeam'],
  fallbackName: string,
  info: TeamInfo[],
): CricketTeamHeader {
  const name = side?.name ?? fallbackName;
  const fromInfo = info.find((team) => team.name.toLowerCase() === name.toLowerCase());
  return {
    name,
    shortName: side?.shortName ?? fromInfo?.shortName ?? abbreviationFromName(name),
    ...(fromInfo?.imageUrl ? { imageUrl: fromInfo.imageUrl } : {}),
  };
}

function attachInnings(team: CricketTeamHeader, innings: InningsScore[]): CricketTeamHeader {
  const match = innings.find((item) => item.team && item.team.toLowerCase().includes(team.name.toLowerCase().split(' ')[0]));
  if (!match) return team;
  return {
    ...team,
    score: `${match.runs}/${match.wickets}`,
    ...(match.overs != null ? { overs: `${formatCricketOvers(match.overs)} ov` } : {}),
  };
}

function formatRate(value: number | undefined): string | undefined {
  if (value == null || !Number.isFinite(value)) return undefined;
  return value.toFixed(2);
}

export function buildCricketMatchView(input: {
  event: MarketEvent;
  scorePayload?: unknown;
  scorecardPayload?: unknown;
  commentaryPayload?: unknown;
  commentaryError?: boolean;
  scorecardError?: boolean;
  scoreError?: boolean;
  loading?: boolean;
}): CricketMatchView {
  const { event } = input;
  const mapped = isCricketMatchUuid(event.providerMatchId);
  const eventScoresHidden = shouldHideLiveScores(event);
  const teamInfo = [...parseTeamInfo(input.scorePayload), ...parseTeamInfo(input.scorecardPayload)];
  const innings = parseInningsScores(input.scorePayload).length
    ? parseInningsScores(input.scorePayload)
    : parseInningsScores(input.scorecardPayload);
  const providerStatus = parseProviderStatus(input.scorePayload) ?? parseProviderStatus(input.scorecardPayload);
  const [homeName, awayName] = event.name.split(/\s+vs\.?\s+/i);
  const home = attachInnings(teamFromEvent(event.homeTeam, homeName ?? event.name, teamInfo), innings);
  const away = attachInnings(teamFromEvent(event.awayTeam, awayName ?? 'Away', teamInfo), innings);

  const latest = innings.length > 0 ? innings[innings.length - 1] : undefined;
  const fromLabel = !eventScoresHidden ? parseScoreLabel(event.scoreLabel) : undefined;
  // Prefer live CricketData payloads over seed labels; never invent when both are empty.
  const hasProviderInnings = Boolean(latest);
  const battingScore = latest
    ? `${latest.runs}/${latest.wickets}`
    : fromLabel
      ? `${fromLabel.runs}/${fromLabel.wickets}`
      : undefined;
  const oversNumber = latest?.overs ?? (!eventScoresHidden ? parseOversLabel(event.minuteLabel) : undefined);
  const oversLabel = oversNumber != null ? `${formatCricketOvers(oversNumber)} overs` : undefined;

  const scoresUnavailable = !battingScore;
  const unavailableReason: CricketUnavailableReason | undefined = !mapped
    ? 'UNMAPPED'
    : input.scoreError && !hasProviderInnings
      ? 'PROVIDER_ERROR'
      : scoresUnavailable
        ? 'PROVIDER_EMPTY'
        : undefined;
  const unavailableMessage =
    unavailableReason === 'UNMAPPED'
      ? 'Provider match not mapped. Set CricketEvent.providerMatchId to a verified CricketData UUID.'
      : unavailableReason === 'PROVIDER_ERROR'
        ? 'CricketData score request failed. Pull to refresh or try again later.'
        : unavailableReason === 'PROVIDER_EMPTY'
          ? 'Live score unavailable'
          : undefined;

  const runs = latest?.runs ?? fromLabel?.runs;
  const decimalOvers = oversNumber != null ? oversToDecimal(oversNumber) : undefined;
  const currentRunRate =
    !scoresUnavailable && runs != null && decimalOvers && decimalOvers > 0 ? formatRate(runs / decimalOvers) : undefined;

  const chase = providerStatus ? parseChaseFromStatus(providerStatus) : null;
  const firstInnings = innings.length >= 2 ? innings[0] : undefined;
  const target =
    !scoresUnavailable && innings.length >= 2 && firstInnings
      ? String(firstInnings.runs + 1)
      : chase?.needs != null && runs != null
        ? String(runs + chase.needs)
        : undefined;
  const requiredRunRate =
    chase?.needs != null && chase.balls != null && chase.balls > 0
      ? formatRate(chase.needs / (chase.balls / 6))
      : undefined;

  const cards = parseScorecard(input.scorecardPayload);
  const latestCard = cards.length > 0 ? cards[cards.length - 1] : undefined;
  const balls = parseBallByBall(input.commentaryPayload);
  const lastBall = balls.length > 0 ? balls[balls.length - 1] : undefined;

  const batters = pickBatters(latestCard?.batting ?? [], lastBall);
  const bowler = pickBowler(latestCard?.bowling ?? [], lastBall);
  const currentOverBalls = currentOverDeliveries(balls);
  const commentary = balls
    .filter((ball) => ball.commentary || ball.event)
    .slice(-40)
    .reverse()
    .map((ball) => ({
      id: ball.id,
      ...(ball.overBall ? { overBall: ball.overBall } : {}),
      text: ball.commentary ?? ball.event ?? ballLabel(ball),
      ...(ball.extras ? { extras: ball.extras } : {}),
      ...(ball.wicket ? { wicket: ball.wicket } : {}),
    }));

  const scorecardsUnavailable = Boolean(input.scorecardError) || (!input.scorecardError && cards.length === 0 && Boolean(input.scorecardPayload));
  const commentaryUnavailable =
    Boolean(input.commentaryError) ||
    (!input.commentaryError && commentary.length === 0 && (Boolean(input.commentaryPayload) || mapped));

  return {
    header: {
      status: cricketUiStatus(event, providerStatus),
      scoresUnavailable,
      unavailableReason,
      unavailableMessage,
      home,
      away,
      battingScore,
      oversLabel,
      inningsLabel: latest?.inningLabel,
      target: scoresUnavailable ? undefined : target,
      currentRunRate,
      requiredRunRate,
      providerStatus,
    },
    batters,
    battersUnavailable: scorecardsUnavailable && batters.length === 0,
    bowler,
    bowlingUnavailable: scorecardsUnavailable && !bowler,
    currentOver: currentOverBalls.map((ball) => ({
      id: ball.id,
      label: ballLabel(ball),
      kind: ball.kind,
    })),
    currentOverLabel: currentOverBalls[0]?.overBall
      ? `This over (${currentOverBalls[0].overBall.replace(/\.\d+$/, '')})`
      : currentOverBalls.length
        ? 'This over'
        : undefined,
    commentary,
    commentaryUnavailable,
    scorecardsUnavailable,
    loading: Boolean(input.loading),
  };
}

function pickBatters(batting: BatterLine[], lastBall?: BallDelivery): CricketBatterView[] {
  const byName = (name?: string) =>
    name ? batting.find((batter) => batter.name.toLowerCase() === name.toLowerCase()) : undefined;
  const strikerName = lastBall?.batsman;
  const nonStrikerName = lastBall?.nonStriker;
  if (strikerName || nonStrikerName) {
    return [strikerName, nonStrikerName].flatMap((name, index) => {
      if (!name) return [];
      const line = byName(name);
      return [
        {
          name,
          role: index === 0 ? ('striker' as const) : ('non-striker' as const),
          runs: line?.runs,
          balls: line?.balls,
          fours: line?.fours,
          sixes: line?.sixes,
          strikeRate: line?.strikeRate,
        },
      ];
    });
  }
  const notOut = batting.filter((batter) => batter.batting || /not\s*out/i.test(batter.dismissal ?? ''));
  return notOut.slice(0, 2).map((batter, index) => ({
    name: batter.name,
    role: index === 0 ? ('striker' as const) : ('non-striker' as const),
    runs: batter.runs,
    balls: batter.balls,
    fours: batter.fours,
    sixes: batter.sixes,
    strikeRate: batter.strikeRate,
  }));
}

function pickBowler(bowling: BowlerLine[], lastBall?: BallDelivery): CricketBowlerView | undefined {
  const named = lastBall?.bowler
    ? bowling.find((bowler) => bowler.name.toLowerCase() === lastBall.bowler!.toLowerCase())
    : undefined;
  const line = named ?? bowling[bowling.length - 1];
  if (!line && !lastBall?.bowler) return undefined;
  const source = line ?? { name: lastBall!.bowler! };
  return {
    name: source.name,
    ...(source.overs != null ? { overs: formatCricketOvers(source.overs) } : {}),
    runs: source.runs,
    wickets: source.wickets,
    economy: source.economy,
  };
}

function currentOverDeliveries(balls: BallDelivery[]): BallDelivery[] {
  if (balls.length === 0) return [];
  const last = balls[balls.length - 1];
  const overKey = overIndex(last);
  if (overKey == null) return balls.slice(-6);
  const current: BallDelivery[] = [];
  for (let index = balls.length - 1; index >= 0; index -= 1) {
    const ball = balls[index];
    if (overIndex(ball) !== overKey) break;
    current.unshift(ball);
  }
  return current;
}

function overIndex(ball: BallDelivery): number | undefined {
  if (ball.overs != null) return Math.floor(ball.overs + 1e-9);
  if (!ball.overBall) return undefined;
  const whole = Number(ball.overBall.split('.')[0]);
  return Number.isFinite(whole) ? whole : undefined;
}
