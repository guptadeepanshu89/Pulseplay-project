import { AppError } from '../../core/errors';

export type DeliveryKind =
  | 'dot'
  | 'single'
  | 'double'
  | 'triple'
  | 'four'
  | 'six'
  | 'wicket'
  | 'wide'
  | 'noball'
  | 'bye'
  | 'legbye';

const KINDS = new Set<DeliveryKind>([
  'dot',
  'single',
  'double',
  'triple',
  'four',
  'six',
  'wicket',
  'wide',
  'noball',
  'bye',
  'legbye',
]);

const BATTERS = [
  'A. Sharma',
  'B. Kohli',
  'C. Rahul',
  'D. Iyer',
  'E. Pant',
  'F. Pandya',
  'G. Jadeja',
  'H. Ashwin',
  'I. Bumrah',
  'J. Shami',
  'K. Siraj',
];

const BOWLERS = ['M. Starc', 'N. Cummins'];

export interface PlayerLine {
  name: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  wickets: number;
  legalBalls: number;
}

export interface Delivery {
  id: string;
  timestamp: string;
  over: string;
  kind: DeliveryKind;
  legal: boolean;
  batterRuns: number;
  extraRuns: number;
  totalRuns: number;
  wicket: boolean;
  striker: string;
  bowler: string;
  commentary: string;
}

export interface SimulatorMatch {
  source: 'simulator';
  simulated: true;
  id: 'simulator';
  status: 'in progress' | 'innings complete';
  teams: { batting: string; bowling: string };
  innings: number;
  runs: number;
  wickets: number;
  extras: number;
  overs: string;
  legalBalls: number;
  maxOvers: number;
  maxWickets: number;
  striker: string;
  nonStriker: string;
  bowler: string;
  batters: PlayerLine[];
  bowlers: PlayerLine[];
  deliveries: Delivery[];
  updatedAt: string;
}

interface State {
  maxOvers: number;
  maxWickets: number;
  seed: number;
  runs: number;
  wickets: number;
  extras: number;
  completedOvers: number;
  ballsThisOver: number;
  striker: number;
  nonStriker: number;
  nextBatter: number;
  bowler: number;
  batters: PlayerLine[];
  bowlers: PlayerLine[];
  deliveries: Delivery[];
  complete: boolean;
  seq: number;
  random: () => number;
}

let state = createState(20, 10, 1);

export function getSimulatorMatch(): SimulatorMatch {
  return present(state);
}

export function resetSimulator(options: { maxOvers?: number; maxWickets?: number; seed?: number } = {}): SimulatorMatch {
  const maxOvers = clampInt(options.maxOvers, 1, 50, 20);
  const maxWickets = clampInt(options.maxWickets, 1, 10, 10);
  const seed = Number.isInteger(options.seed) ? (options.seed as number) : 1;
  state = createState(maxOvers, maxWickets, seed);
  return present(state);
}

export function bowlNext(input: { kind?: string; runs?: number; random?: boolean } = {}): SimulatorMatch {
  if (state.complete) {
    throw new AppError(409, 'INNINGS_COMPLETE', 'This simulated innings is finished. Reset the simulator to continue.');
  }
  const kind = input.random ? randomKind(state.random) : parseKind(input.kind);
  const extraRuns = kind === 'bye' || kind === 'legbye' ? clampInt(input.runs, 1, 3, 1) : 0;
  apply(state, kind, extraRuns);
  return present(state);
}

function parseKind(kind: string | undefined): DeliveryKind {
  if (!kind || !KINDS.has(kind as DeliveryKind)) {
    throw new AppError(400, 'INVALID_DELIVERY', 'kind must be a cricket delivery, or set random to true');
  }
  return kind as DeliveryKind;
}

function createState(maxOvers: number, maxWickets: number, seed: number): State {
  return {
    maxOvers,
    maxWickets,
    seed,
    runs: 0,
    wickets: 0,
    extras: 0,
    completedOvers: 0,
    ballsThisOver: 0,
    striker: 0,
    nonStriker: 1,
    nextBatter: 2,
    bowler: 0,
    batters: BATTERS.map((name) => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, legalBalls: 0 })),
    bowlers: BOWLERS.map((name) => ({ name, runs: 0, balls: 0, fours: 0, sixes: 0, wickets: 0, legalBalls: 0 })),
    deliveries: [],
    complete: false,
    seq: 0,
    random: mulberry32(seed),
  };
}

function apply(current: State, kind: DeliveryKind, byeRuns: number): void {
  const legal = kind !== 'wide' && kind !== 'noball';
  let batterRuns = 0;
  let extraRuns = 0;
  let wicket = false;

  if (kind === 'single') batterRuns = 1;
  else if (kind === 'double') batterRuns = 2;
  else if (kind === 'triple') batterRuns = 3;
  else if (kind === 'four') batterRuns = 4;
  else if (kind === 'six') batterRuns = 6;
  else if (kind === 'wide' || kind === 'noball') extraRuns = 1;
  else if (kind === 'bye' || kind === 'legbye') extraRuns = byeRuns;
  else if (kind === 'wicket') wicket = true;

  const striker = current.batters[current.striker];
  const bowler = current.bowlers[current.bowler];
  if (legal) {
    current.ballsThisOver += 1;
    striker.balls += 1;
    bowler.legalBalls += 1;
  }
  striker.runs += batterRuns;
  if (batterRuns === 4) striker.fours += 1;
  if (batterRuns === 6) striker.sixes += 1;
  const total = batterRuns + extraRuns;
  current.runs += total;
  current.extras += extraRuns;
  bowler.runs += total;
  if (wicket) {
    current.wickets += 1;
    bowler.wickets += 1;
  }

  const overLabel = `${current.completedOvers}.${current.ballsThisOver}`;
  current.seq += 1;
  current.deliveries.push({
    id: `sim-${current.seq}`,
    timestamp: new Date().toISOString(),
    over: overLabel,
    kind,
    legal,
    batterRuns,
    extraRuns,
    totalRuns: total,
    wicket,
    striker: striker.name,
    bowler: bowler.name,
    commentary: `Simulated: ${commentaryText(kind, total, striker.name, bowler.name)}`,
  });

  const runsForStrike = batterRuns + (kind === 'wide' || kind === 'noball' ? 0 : extraRuns);
  if (runsForStrike % 2 === 1) swapStrike(current);

  if (wicket && current.wickets < current.maxWickets && current.nextBatter < current.batters.length) {
    current.striker = current.nextBatter;
    current.nextBatter += 1;
  }

  if (legal && current.ballsThisOver === 6) {
    current.completedOvers += 1;
    current.ballsThisOver = 0;
    swapStrike(current);
    current.bowler = current.bowler === 0 ? 1 : 0;
  }

  if (current.wickets >= current.maxWickets || current.completedOvers >= current.maxOvers) {
    current.complete = true;
  }
}

function swapStrike(current: State): void {
  const previous = current.striker;
  current.striker = current.nonStriker;
  current.nonStriker = previous;
}

function commentaryText(kind: DeliveryKind, total: number, batter: string, bowler: string): string {
  if (kind === 'wicket') return `Wicket. ${batter} is out, bowled by ${bowler}.`;
  if (kind === 'wide') return `Wide from ${bowler}. One extra.`;
  if (kind === 'noball') return `No-ball from ${bowler}. One extra. Not a legal delivery.`;
  if (kind === 'bye') return `${total} bye${total === 1 ? '' : 's'}.`;
  if (kind === 'legbye') return `${total} leg-bye${total === 1 ? '' : 's'}.`;
  if (kind === 'dot') return `No run. ${batter} defends ${bowler}.`;
  if (kind === 'four') return `Four. ${batter} to the boundary.`;
  if (kind === 'six') return `Six. ${batter} clears the rope.`;
  return `${total} run${total === 1 ? '' : 's'} to ${batter}.`;
}

function present(current: State): SimulatorMatch {
  return {
    source: 'simulator',
    simulated: true,
    id: 'simulator',
    status: current.complete ? 'innings complete' : 'in progress',
    teams: { batting: 'Simulated XI', bowling: 'Simulated Bowling' },
    innings: 1,
    runs: current.runs,
    wickets: current.wickets,
    extras: current.extras,
    overs: `${current.completedOvers}.${current.ballsThisOver}`,
    legalBalls: current.completedOvers * 6 + current.ballsThisOver,
    maxOvers: current.maxOvers,
    maxWickets: current.maxWickets,
    striker: current.batters[current.striker]?.name ?? '',
    nonStriker: current.batters[current.nonStriker]?.name ?? '',
    bowler: current.bowlers[current.bowler]?.name ?? '',
    batters: current.batters
      .filter((batter) => batter.balls > 0 || batter.runs > 0)
      .map((batter) => ({ ...batter })),
    bowlers: current.bowlers
      .filter((bowler) => bowler.legalBalls > 0 || bowler.runs > 0 || bowler.wickets > 0)
      .map((bowler) => ({ ...bowler })),
    deliveries: current.deliveries.map((delivery) => ({ ...delivery })),
    updatedAt: current.deliveries.at(-1)?.timestamp ?? new Date(0).toISOString(),
  };
}

function clampInt(value: number | undefined, min: number, max: number, fallback: number): number {
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value as number));
}

function randomKind(next: () => number): DeliveryKind {
  const table: DeliveryKind[] = ['dot', 'dot', 'dot', 'single', 'single', 'double', 'four', 'six', 'wicket', 'wide', 'noball', 'bye', 'legbye'];
  return table[Math.floor(next() * table.length)];
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) >>> 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
