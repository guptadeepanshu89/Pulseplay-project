import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Badge, Card, Header, RefreshableScrollView, Screen } from '@components/common';
import type { BadgeStatus } from '@components/common/Badge';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { ColorPalette, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { getCricketCommentary, getCricketScore, getCricketScorecard } from '@/api/cricket';
import { isCricketMatchUuid, parseBbbEnabled } from '@/api/cricketPayload';
import { ApiError } from '@/api/client';
import { useLiveRefresh } from '@/realtime/live';
import { applyEventScoreUpdate } from '@/realtime/eventScoreUpdates';
import { getEventById } from '@services/eventService';
import { getMarketsByEventId } from '@services/marketService';
import { shouldHideLiveScores } from '@utils/eventScoreDisplay';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

import { CricketScoreboard } from './CricketScoreboard';
import { buildCricketMatchView, type CricketUiStatus } from './cricketMatchView';

type Props = NativeStackScreenProps<RootStackParamList, 'LiveMatch'>;

type IoniconName = keyof typeof Ionicons.glyphMap;

interface TimelineEntry {
  minute: string;
  icon: IoniconName;
  iconColor: string;
  description: string;
}

interface CricketExtras {
  matchId: string | null;
  scorePayload?: unknown;
  scorecardPayload?: unknown;
  commentaryPayload?: unknown;
  commentaryError?: boolean;
  scorecardError?: boolean;
  scoreError?: boolean;
  scoreErrorCode?: string;
  commentaryErrorCode?: string;
}

const CRICKET_BADGE: Record<CricketUiStatus, BadgeStatus> = {
  LIVE: 'LIVE',
  UPCOMING: 'NEUTRAL',
  BREAK: 'PENDING',
  COMPLETED: 'APPROVED',
};

/** Align with server CRICKET_POLL_INTERVAL_MS default (3 min). Do not poll faster than provider cache. */
const CRICKET_FOCUS_REFRESH_MS = 180_000;

// No live timeline feed exists in the backend — demo entries only, clearly labeled in UI.
function getDemoTimelineForEvent(event: MarketEvent, colors: ColorPalette): TimelineEntry[] {
  const home = event.homeTeam?.name ?? event.name;
  const away = event.awayTeam?.name ?? '';
  return [
    { minute: "56'", icon: 'football', iconColor: colors.positive, description: `Goal! ${home} scores` },
    { minute: "53'", icon: 'square', iconColor: colors.warning, description: `Yellow Card - ${away}` },
    { minute: "49'", icon: 'flag', iconColor: colors.textSecondary, description: `Corner - ${home}` },
    { minute: "45'", icon: 'swap-horizontal', iconColor: colors.accent, description: `Substitution - ${home}` },
  ];
}

export function LiveMatchScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { toggleSelection } = useBetSlip();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [cricketExtras, setCricketExtras] = useState<CricketExtras>({ matchId: null });
  const [cricketRefreshNonce, setCricketRefreshNonce] = useState(0);
  const lastCricketFetchAt = useRef(0);

  const loadEvent = useCallback(() => {
    return getEventById(eventId).then((result) => setEvent(result ?? null));
  }, [eventId]);

  useEffect(() => {
    loadEvent();
    getMarketsByEventId(eventId).then(setMarkets);
  }, [eventId, loadEvent]);

  const cricketMatchId =
    event?.category === 'CRICKET' && isCricketMatchUuid(event.providerMatchId)
      ? event.providerMatchId!.trim()
      : null;
  const cricketCompleted = event?.status === 'COMPLETED' || event?.status === 'CANCELLED';
  // Fetch whenever mapped — do not wait for the live-score worker to set scoresProvider.
  const cricketFetchKey = cricketMatchId;

  useEffect(() => {
    if (!cricketFetchKey) return;
    // Completed matches: one successful fetch is enough — avoid burning daily quota.
    if (cricketCompleted && lastCricketFetchAt.current > 0 && cricketRefreshNonce === 0) return;

    const controller = new AbortController();
    void (async () => {
      const next: CricketExtras = { matchId: cricketFetchKey };
      try {
        next.scorePayload = (await getCricketScore(cricketFetchKey, controller.signal)).data;
      } catch (error) {
        if (controller.signal.aborted) return;
        next.scoreError = true;
        next.scoreErrorCode = error instanceof ApiError ? error.code : undefined;
      }

      try {
        next.scorecardPayload = (await getCricketScorecard(cricketFetchKey, controller.signal)).data;
      } catch {
        if (controller.signal.aborted) return;
        next.scorecardError = true;
      }

      const bbbEnabled = parseBbbEnabled(next.scorePayload);
      if (bbbEnabled === false) {
        next.commentaryError = true;
        next.commentaryErrorCode = 'BBB_DISABLED';
      } else {
        try {
          next.commentaryPayload = (await getCricketCommentary(cricketFetchKey, controller.signal)).data;
        } catch (error) {
          if (controller.signal.aborted) return;
          next.commentaryError = true;
          next.commentaryErrorCode = error instanceof ApiError ? error.code : undefined;
        }
      }

      if (!controller.signal.aborted) {
        lastCricketFetchAt.current = Date.now();
        setCricketExtras(next);
      }
    })();
    return () => controller.abort();
  }, [cricketFetchKey, cricketRefreshNonce, cricketCompleted]);

  useFocusEffect(
    useCallback(() => {
      if (!cricketFetchKey || cricketCompleted) return undefined;
      if (lastCricketFetchAt.current === 0) return undefined;
      const elapsed = Date.now() - lastCricketFetchAt.current;
      if (elapsed < CRICKET_FOCUS_REFRESH_MS) return undefined;
      setCricketRefreshNonce((value) => value + 1);
      return undefined;
    }, [cricketFetchKey, cricketCompleted]),
  );

  const marketIds = useMemo(() => markets.map((market) => market.id), [markets]);

  useLiveRefresh(loadEvent, {
    marketIds,
    onEvent: (liveEvent) => {
      if (liveEvent.type !== 'events.updated' || liveEvent.entityId !== eventId) return false;
      setEvent((current) =>
        current ? applyEventScoreUpdate(current, liveEvent.entityId, liveEvent.data as Record<string, unknown>) : current,
      );
      return true;
    },
  });

  const cricketView = useMemo(
    () =>
      event?.category === 'CRICKET'
        ? buildCricketMatchView({
            event,
            scorePayload: cricketExtras.scorePayload,
            scorecardPayload: cricketExtras.scorecardPayload,
            commentaryPayload: cricketExtras.commentaryPayload,
            commentaryError: cricketExtras.commentaryError,
            scorecardError: cricketExtras.scorecardError,
            scoreError: cricketExtras.scoreError,
            loading: Boolean(cricketFetchKey) && cricketExtras.matchId !== cricketFetchKey,
          })
        : null,
    [event, cricketExtras, cricketFetchKey],
  );

  if (!event) {
    return (
      <Screen>
        <Header title="Live Match" onBack={navigation.goBack} />
      </Screen>
    );
  }

  const timeline = event.category === 'FOOTBALL' ? getDemoTimelineForEvent(event, colors) : [];
  const headerStatus = cricketView?.header.status;
  const headerBadge =
    event.category === 'CRICKET' && headerStatus ? (
      <Badge label={headerStatus} status={CRICKET_BADGE[headerStatus]} />
    ) : (
      <Badge label={event.status === 'LIVE' ? 'LIVE' : event.status} status={event.status === 'LIVE' ? 'LIVE' : 'NEUTRAL'} />
    );

  const handleSelect = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection) return;
    toggleSelection({
      eventId: event.id,
      eventName: event.name,
      marketId: market.id,
      marketName: market.name,
      selectionId: selection.id,
      selectionName: selection.name,
      price: selection.currentPrice,
    });
    navigation.navigate('BetSlip');
  };

  const onRefresh = async () => {
    await loadEvent();
    if (event.category === 'CRICKET' && cricketMatchId) setCricketRefreshNonce((value) => value + 1);
  };

  const body = (
    <>
      {event.category === 'CRICKET' && cricketView ? (
        <CricketScoreboard view={cricketView} />
      ) : (
        <Card style={styles.scoreCard}>
          <View style={styles.scoreRow}>
            <AppText variant="h2" style={styles.teamName} numberOfLines={1}>
              {event.homeTeam?.name}
            </AppText>
            {shouldHideLiveScores(event) ? (
              <AppText variant="bodySemibold" color={colors.textMuted} align="center" style={styles.unavailableScore}>
                Live score unavailable
              </AppText>
            ) : (
              <AppText variant="display" color={colors.accent}>
                {event.homeTeam?.score ?? '-'} - {event.awayTeam?.score ?? '-'}
              </AppText>
            )}
            <AppText variant="h2" style={styles.teamName} numberOfLines={1} align="right">
              {event.awayTeam?.name}
            </AppText>
          </View>
          {!shouldHideLiveScores(event) && event.minuteLabel && (
            <AppText
              variant="captionMedium"
              color={event.scoresStale ? colors.textMuted : colors.live}
              align="center"
              style={styles.minute}
            >
              {event.scoresStale ? 'Score delayed · ' : ''}
              {event.minuteLabel}
            </AppText>
          )}
        </Card>
      )}

      {event.category === 'FOOTBALL' ? (
        <>
          <AppText variant="h3" style={styles.sectionTitle}>
            Match Timeline
          </AppText>
          <AppText variant="caption" color={colors.textMuted} style={styles.demoLabel}>
            Demo timeline — not live data
          </AppText>
          <Card style={styles.timelineCard}>
            {timeline.length === 0 ? (
              <AppText variant="body" color={colors.textSecondary}>
                No timeline available for this match.
              </AppText>
            ) : (
              timeline.map((entry, index) => (
                <View
                  key={`${entry.minute}-${entry.description}`}
                  style={[styles.timelineRow, index === timeline.length - 1 && styles.timelineRowLast]}
                >
                  <AppText variant="captionMedium" color={colors.textMuted} style={styles.timelineMinute}>
                    {entry.minute}
                  </AppText>
                  <Ionicons name={entry.icon} size={layout.iconSizeSmall} color={entry.iconColor} />
                  <AppText variant="bodyMedium" style={styles.timelineText}>
                    {entry.description}
                  </AppText>
                </View>
              ))
            )}
          </Card>
        </>
      ) : null}

      <AppText variant="h3" style={styles.sectionTitle}>
        Markets
      </AppText>
      {markets.map((market) => (
        <MarketOddsCard
          key={market.id}
          market={market}
          fullWidth
          onPressSelection={(selectionId) => handleSelect(market, selectionId)}
        />
      ))}
    </>
  );

  return (
    <Screen>
      <Header title={event.competition} onBack={navigation.goBack} right={headerBadge} />
      {event.category === 'CRICKET' ? (
        <RefreshableScrollView onRefresh={onRefresh} contentContainerStyle={styles.content}>
          <View style={styles.cricketPage} pointerEvents="box-none">
            {body}
          </View>
        </RefreshableScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {body}
        </ScrollView>
      )}
    </Screen>
  );
}

const createStyles = (colors: ColorPalette) =>
  StyleSheet.create({
    content: {
      paddingHorizontal: layout.screenPaddingHorizontal,
      paddingTop: spacing.lg,
      paddingBottom: spacing.xxxl,
      overflow: 'hidden',
    },
    cricketPage: {
      overflow: 'hidden',
      maxWidth: '100%',
    },
    scoreCard: {
      marginBottom: spacing.xl,
    },
    scoreRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    teamName: {
      flex: 1,
    },
    minute: {
      marginTop: spacing.sm,
    },
    unavailableScore: {
      flex: 1,
      marginHorizontal: spacing.sm,
    },
    sectionTitle: {
      marginBottom: spacing.xs,
    },
    demoLabel: {
      marginBottom: spacing.md,
    },
    timelineCard: {
      marginBottom: spacing.xl,
    },
    timelineRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingBottom: spacing.md,
      marginBottom: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    timelineRowLast: {
      paddingBottom: 0,
      marginBottom: 0,
      borderBottomWidth: 0,
    },
    timelineMinute: {
      width: 32,
    },
    timelineText: {
      flex: 1,
    },
  });
