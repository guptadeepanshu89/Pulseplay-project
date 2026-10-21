import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import {
  LiveMatchOption,
  SimulatorMatch,
  bowlSimulator,
  commentaryLines,
  getCricketCommentary,
  getCricketLive,
  getCricketScore,
  getSimulatorMatch,
  liveMatchOptions,
  resetSimulator,
} from '@/api/cricket';
import { AppButton, AppText, Badge, Card, EmptyState, Header, Screen } from '@components/common';
import { cricketFeedView, finishFeedLoad, initialFeedLoad, presentMatchCard, startFeedLoad } from './feedState';
import { currentConnectionState, LIVE_POLL_MS, useLiveRefresh } from '@/realtime/live';
import { applyCricketUpdate } from '@/realtime/providerUpdates';
import { readableErrorMessage } from '@/api/errorMessage';
import { spacing } from '@theme';
import { layout } from '@constants/layout';
import { useTheme } from '@context/ThemeContext';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CricketFeed'>;
type Mode = 'provider' | 'simulator';

export function CricketFeedScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const [mode, setMode] = useState<Mode>('simulator');
  const [feed, setFeed] = useState(initialFeedLoad);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [delayed, setDelayed] = useState(false);
  const [matches, setMatches] = useState<LiveMatchOption[]>([]);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [commentaryNote, setCommentaryNote] = useState<string | null>(null);
  const [lines, setLines] = useState<{ id: string; text: string }[]>([]);
  const [simulator, setSimulator] = useState<SimulatorMatch | null>(null);
  const matchIdRef = useRef<string | null>(null);
  const modeRef = useRef(mode);
  const seenCricket = useRef(new Map<string, number>());
  matchIdRef.current = matchId;
  modeRef.current = mode;

  const loadSimulator = useCallback(async () => {
    const match = await getSimulatorMatch();
    setSimulator(match);
    setUpdatedAt(match.updatedAt);
    setDelayed(false);
  }, []);

  const loadProvider = useCallback(async (selectedId: string | null, signal: AbortSignal) => {
    const live = await getCricketLive(signal);
    if (signal.aborted) throw new ApiError(0, 'aborted', 'ABORTED');
    const options = live.normalized?.matches?.length ? live.normalized.matches : liveMatchOptions(live.data);
    setMatches(options);
    setDelayed(live.delayed || live.stale);
    setFeed((current) => finishFeedLoad(current, { ok: true, matchCount: options.length, stale: Boolean(live.stale) }));
    setUpdatedAt(live.fetchedAt);
    const id = selectedId && options.some((match) => match.id === selectedId) ? selectedId : options[0]?.id ?? null;
    if (signal.aborted) throw new ApiError(0, 'aborted', 'ABORTED');
    setMatchId(id);
    if (!id) {
      setCommentaryNote(null);
      setLines([]);
      return;
    }
    const score = await getCricketScore(id, signal);
    if (signal.aborted) throw new ApiError(0, 'aborted', 'ABORTED');
    setDelayed((current) => current || score.delayed || score.stale);
    setFeed((current) => ({ ...current, stale: current.stale || Boolean(score.stale) }));
    setUpdatedAt(score.fetchedAt);
    const selected = score.normalized?.match ?? options.find((match) => match.id === id);
    if (selected && 'title' in selected) {
      setMatches((current) => current.map((match) => (match.id === id ? mergeMatch(match, selected) : match)));
    }
    try {
      const commentary = await getCricketCommentary(id, signal);
      setDelayed((current) => current || commentary.delayed || commentary.stale);
      const nextLines = commentary.normalized?.lines?.length ? commentary.normalized.lines : commentaryLines(commentary.data);
      setLines((current) => dedupe([...current, ...nextLines]));
      setCommentaryNote(nextLines.length === 0 ? 'No ball-by-ball lines were returned for this match.' : null);
    } catch (err) {
      if (err instanceof ApiError && err.code === 'ABORTED') throw err;
      setCommentaryNote(readableErrorMessage(err, 'Ball-by-ball commentary is not available for this match.'));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      let busy = false;
      const controller = new AbortController();
      setFeed(initialFeedLoad());

      const tick = async () => {
        if (!alive || busy) return;
        busy = true;
        setFeed((current) => startFeedLoad(current));
        try {
          if (mode === 'simulator') {
            await loadSimulator();
            if (alive) setFeed((current) => finishFeedLoad(current, { ok: true, matchCount: 0, stale: false }));
          } else {
            await loadProvider(matchIdRef.current, controller.signal);
          }
        } catch (err) {
          if (!alive || (err instanceof ApiError && err.code === 'ABORTED')) return;
          if (alive) {
            const message = readableErrorMessage(err, 'Could not load cricket data.');
            setFeed((current) => finishFeedLoad(current, { ok: false, error: message }));
          }
        } finally {
          busy = false;
        }
      };

      void tick();
      return () => {
        alive = false;
        controller.abort();
      };
    }, [mode, loadProvider, loadSimulator]),
  );

  useLiveRefresh(() => {
    if (modeRef.current !== 'provider' || currentConnectionState() === 'connected') return;
    const controller = new AbortController();
    void loadProvider(matchIdRef.current, controller.signal).catch((err: unknown) => {
      if (err instanceof ApiError && err.code === 'ABORTED') return;
      setFeed((current) => finishFeedLoad(current, { ok: false, error: readableErrorMessage(err, 'Could not load cricket data.') }));
    });
  }, [], undefined, (event) => {
    if (event.type !== 'cricket.updated') return false;
    if (modeRef.current !== 'provider') return true;
    setMatches((current) => applyCricketUpdate(current, event, 'provider', seenCricket.current));
    if (typeof event.data?.asOf === 'string') setUpdatedAt(event.data.asOf);
    return true;
  });

  const view = cricketFeedView(mode === 'provider' ? feed : { ...feed, matchCount: 0, stale: false });

  const onNext = async (kind: string) => {
    setFeed((current) => ({ ...current, error: null }));
    try {
      const match = await bowlSimulator(kind);
      setSimulator(match);
      setUpdatedAt(match.updatedAt);
    } catch (err) {
      setFeed((current) => ({ ...current, error: readableErrorMessage(err, 'Could not bowl the next ball.') }));
    }
  };

  const onReset = async () => {
    setFeed((current) => ({ ...current, error: null }));
    try {
      const match = await resetSimulator();
      setSimulator(match);
      setUpdatedAt(match.updatedAt);
    } catch (err) {
      setFeed((current) => ({ ...current, error: readableErrorMessage(err, 'Could not reset the simulator.') }));
    }
  };

  return (
    <Screen>
      <Header title="Cricket feed" onBack={navigation.goBack} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <AppButton label="Simulator" variant={mode === 'simulator' ? 'primary' : 'secondary'} onPress={() => setMode('simulator')} />
          <AppButton label="Real API" variant={mode === 'provider' ? 'primary' : 'secondary'} onPress={() => setMode('provider')} />
        </View>
        <Badge
          label={mode === 'simulator' ? 'SIMULATED — not a live match' : delayed ? 'PROVIDER — delayed' : 'PROVIDER DATA'}
          status={mode === 'simulator' ? 'PENDING' : delayed ? 'SUSPENDED' : 'LIVE'}
        />
        {view.showLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
            <AppText variant="caption" color={colors.textMuted}>Loading matches</AppText>
          </View>
        ) : null}
        {view.showError && feed.error ? <AppText variant="body" color={colors.negative}>{feed.error}</AppText> : null}
        {view.showStale ? (
          <AppText variant="caption" color={colors.warning}>
            Showing the last saved scores. A fresh update was not available.
          </AppText>
        ) : null}
        {updatedAt && !view.showLoading ? (
          <AppText variant="caption" color={colors.textMuted}>
            Last updated {updatedAt}
          </AppText>
        ) : null}

        {mode === 'provider' ? (
          <Card>
            <AppText variant="h3">Live matches</AppText>
            <AppText variant="caption" color={colors.textSecondary}>
              Free CricketData scores can lag by about a minute. Live scores arrive on the socket. If the socket drops, this screen checks the saved response every {LIVE_POLL_MS / 1000}s. The server cache is about 3 minutes.
            </AppText>
            {view.showEmpty ? (
              <EmptyState icon="baseball-outline" title="No live matches" message="The provider returned an empty match list." />
            ) : null}
            {view.showMatches
              ? matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    selected={match.id === matchId}
                    onPress={() => {
                      setLines([]);
                      setMatchId(match.id);
                    }}
                  />
                ))
              : null}
            {commentaryNote ? <AppText variant="caption" color={colors.textSecondary}>{commentaryNote}</AppText> : null}
            {lines.map((line) => (
              <AppText key={line.id} variant="body">{line.text}</AppText>
            ))}
          </Card>
        ) : simulator ? (
          <Card>
            <AppText variant="h3">{simulator.teams.batting} vs {simulator.teams.bowling}</AppText>
            <AppText variant="caption" color={colors.warning}>Simulated innings {simulator.innings} · {simulator.status}</AppText>
            <AppText variant="h2">{simulator.runs}/{simulator.wickets}</AppText>
            <AppText variant="body">Overs {simulator.overs} · extras {simulator.extras}</AppText>
            <AppText variant="body">Striker {simulator.striker} · non-striker {simulator.nonStriker}</AppText>
            <AppText variant="body">Bowler {simulator.bowler}</AppText>
            <View style={styles.row}>
              {(['dot', 'single', 'four', 'six', 'wicket', 'wide', 'noball'] as const).map((kind) => (
                <AppButton key={kind} label={kind} variant="secondary" onPress={() => onNext(kind)} disabled={simulator.status !== 'in progress'} />
              ))}
            </View>
            <AppButton label="Reset simulator" variant="ghost" onPress={onReset} />
            {[...simulator.deliveries].reverse().map((delivery) => (
              <AppText key={delivery.id} variant="body">
                {delivery.over} {delivery.commentary}
              </AppText>
            ))}
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function MatchCard({ match, selected, onPress }: { match: LiveMatchOption; selected: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const card = presentMatchCard(match);
  const teams = card.teams.length > 0 ? card.teams.join(' vs ') : 'Teams unavailable';
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }}>
      <Card style={[styles.matchCard, selected ? { borderColor: colors.accent } : null]}>
        {card.title ? <AppText variant="caption" color={colors.textSecondary}>{card.title}</AppText> : null}
        <AppText variant="h3">{teams}</AppText>
        {card.status ? <AppText variant="captionMedium" color={colors.textSecondary}>{card.status}</AppText> : null}
        {card.innings.length === 0 ? (
          <AppText variant="body" color={colors.textMuted}>Score not yet available</AppText>
        ) : (
          card.innings.map((innings) => (
            <View key={`${innings.team}-${innings.overs ?? 'score'}-${innings.score}`} style={styles.scoreRow}>
              <AppText variant="body" style={styles.team}>{innings.team}</AppText>
              <AppText variant="bodySemibold">{innings.score}</AppText>
              {innings.overs ? <AppText variant="caption" color={colors.textMuted}>{innings.overs} ov</AppText> : null}
            </View>
          ))
        )}
        {match.startTime ? <AppText variant="caption" color={colors.textMuted}>Starts {match.startTime}</AppText> : null}
      </Card>
    </Pressable>
  );
}

function mergeMatch(current: LiveMatchOption, detail: LiveMatchOption): LiveMatchOption {
  return {
    ...current,
    title: detail.title || current.title,
    status: detail.status || current.status,
    score: detail.score ?? current.score,
    innings: detail.innings ?? current.innings,
    teams: detail.teams && detail.teams.length > 0 ? detail.teams : current.teams,
    startTime: detail.startTime ?? current.startTime,
    venue: detail.venue ?? current.venue,
  };
}

function dedupe(lines: { id: string; text: string }[]): { id: string; text: string }[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (seen.has(line.id)) return false;
    seen.add(line.id);
    return true;
  });
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  matchCard: {
    width: '100%',
    gap: spacing.xs,
  },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
  },
  team: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 120,
  },
});
