export interface FeedLoadState {
  initialLoading: boolean;
  resolved: boolean;
  error: string | null;
  matchCount: number;
  stale: boolean;
}

export interface InningsLine {
  team: string;
  score: string;
  overs: string | null;
}

export interface MatchCardModel {
  title: string | null;
  teams: string[];
  status: string | null;
  innings: InningsLine[];
}

export interface FeedView {
  showLoading: boolean;
  showEmpty: boolean;
  showError: boolean;
  showStale: boolean;
  showMatches: boolean;
}

export function initialFeedLoad(): FeedLoadState {
  return { initialLoading: false, resolved: false, error: null, matchCount: 0, stale: false };
}

export function startFeedLoad(state: FeedLoadState): FeedLoadState {
  if (state.resolved) return state;
  return { ...state, initialLoading: true, error: null };
}

export function finishFeedLoad(
  state: FeedLoadState,
  result: { ok: true; matchCount: number; stale: boolean } | { ok: false; error: string },
): FeedLoadState {
  if (!result.ok) {
    return { ...state, initialLoading: false, error: result.error };
  }
  return {
    initialLoading: false,
    resolved: true,
    error: null,
    matchCount: result.matchCount,
    stale: result.stale,
  };
}

export function cricketFeedView(state: FeedLoadState): FeedView {
  const showLoading = state.initialLoading && !state.resolved;
  return {
    showLoading,
    showEmpty: state.resolved && !showLoading && state.matchCount === 0 && !state.error,
    showError: Boolean(state.error) && !showLoading,
    showStale: state.stale && state.resolved && !showLoading,
    showMatches: state.matchCount > 0 && !showLoading,
  };
}

export function presentMatchCard(match: {
  title?: string | null;
  status?: string | null;
  score?: string | null;
  innings?: string | null;
  teams?: Array<string | null | undefined> | null;
}): MatchCardModel {
  const teams = teamNames(match);
  const innings = inningsLines(match.score, teams);
  const title = displayTitle(match.title, teams);
  return {
    title,
    teams,
    status: cleanText(match.status),
    innings,
  };
}

function teamNames(match: { title?: string | null; teams?: Array<string | null | undefined> | null; score?: string | null }): string[] {
  const listed = (match.teams ?? []).map((team) => cleanText(team)).filter((team): team is string => Boolean(team));
  if (listed.length > 0) return unique(listed);
  const fromTitle = splitTeams(cleanText(match.title));
  if (fromTitle.length > 0) return fromTitle;
  return unique(inningsLines(match.score, []).map((line) => line.team));
}

function displayTitle(title: string | null | undefined, teams: string[]): string | null {
  const text = cleanText(title);
  if (!text) return null;
  const joined = teams.join(' vs ').toLowerCase();
  if (teams.length >= 2 && text.toLowerCase() === joined) return null;
  return text;
}

function inningsLines(score: string | null | undefined, teams: string[]): InningsLine[] {
  const text = cleanText(score);
  if (!text) return [];
  return text
    .split(' · ')
    .map((part) => parseInnings(part, teams))
    .filter((line): line is InningsLine => line !== null);
}

function parseInnings(part: string, teams: string[]): InningsLine | null {
  const text = cleanText(part);
  if (!text) return null;
  const matched = text.match(/^(.*?):\s*(\d+)\s*\/\s*(\d+)\s*\(([^)]+)\)\s*$/);
  if (!matched) return { team: teams[0] ?? 'Score', score: text, overs: null };
  const team = inningsTeam(matched[1], teams);
  const overs = cleanText(matched[4]);
  if (!team) return null;
  return { team, score: `${matched[2]}/${matched[3]}`, overs };
}

function inningsTeam(label: string, teams: string[]): string | null {
  const withoutInnings = label.replace(/\s+innings?\s+\d+$/i, '').trim();
  const known = teams.find((team) => team.toLowerCase() === withoutInnings.toLowerCase());
  return cleanText(known ?? withoutInnings);
}

function splitTeams(title: string | null): string[] {
  if (!title) return [];
  const matched = title.match(/^(.+?)\s+vs\.?\s+([^,]+?)(?:,|$)/i);
  if (!matched) return [];
  const teams = [cleanText(matched[1]), cleanText(matched[2])].filter((team): team is string => Boolean(team));
  return teams.length === 2 ? teams : [];
}

function cleanText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (!text || text.toLowerCase() === 'undefined' || text.toLowerCase() === 'null') return null;
  return text;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  return values.filter((value) => {
    const key = value.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
