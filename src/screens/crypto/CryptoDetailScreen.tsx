import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

import { ApiError } from '@/api/client';
import { AppText, Header, IconButton, RefreshableScrollView, Screen, Skeleton, Touchable } from '@components/common';
import { MarketOddsCard } from '@components/market/MarketOddsCard';
import { LineChart } from '@components/charts/LineChart';
import { radius, spacing } from '@theme';
import { layout } from '@constants/layout';
import { useBetSlip } from '@context/BetSlipContext';
import { useTheme } from '@context/ThemeContext';
import { getEventById } from '@services/eventService';
import { getMarketsByEventId } from '@services/marketService';
import { currentConnectionState, isSocketConnected, LIVE_RESYNC_TYPES, useConnectionState, useLiveRefresh } from '@/realtime/live';
import { applyCryptoSpot, mergeCryptoHistory } from '@/realtime/providerUpdates';
import { getCryptoPriceHistory } from '@services/cryptoService';
import { ChartTimeframe, CryptoPriceHistory } from '@/types/crypto';
import { formatUsd } from '@utils/formatCurrency';
import { formatDateTime } from '@utils/formatDate';
import { MarketEvent } from '@/types/event';
import { Market } from '@/types/market';
import { RootStackParamList } from '@navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'CryptoDetail'>;

const TIMEFRAMES: ChartTimeframe[] = ['24H', '1W', '1M', '1Y', 'ALL'];
const CHART_HEIGHT = 180;
const CHART_HORIZONTAL_PADDING = layout.screenPaddingHorizontal * 2;
const MARKETS_STALE_MS = 45_000;

function isAbortError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'ABORTED';
}

export function CryptoDetailScreen({ route, navigation }: Props) {
  const { eventId } = route.params;
  const { colors } = useTheme();
  const { toggleSelection } = useBetSlip();
  const [event, setEvent] = useState<MarketEvent | null>(null);
  const [markets, setMarkets] = useState<Market[]>([]);
  const [marketsLoading, setMarketsLoading] = useState(true);
  const [marketsError, setMarketsError] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<ChartTimeframe>('24H');
  const [watchlisted, setWatchlisted] = useState(false);
  const [priceHistory, setPriceHistory] = useState<CryptoPriceHistory | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [chartLoading, setChartLoading] = useState(true);
  const connectionState = useConnectionState();

  const lastMarketsFetchAt = useRef(0);
  const lastPriceKeyRef = useRef<string | null>(null);
  const priceHistoryRef = useRef<CryptoPriceHistory | null>(null);
  const marketsRef = useRef(markets);
  const symbolRef = useRef<string | null>(null);

  useEffect(() => {
    marketsRef.current = markets;
  }, [markets]);

  useEffect(() => {
    priceHistoryRef.current = priceHistory;
  }, [priceHistory]);

  // Only the event's own symbol — never default to BTC while ETH is loading.
  const symbol = event?.symbol?.trim().toUpperCase() || null;
  useEffect(() => {
    symbolRef.current = symbol;
  }, [symbol]);
  const marketIds = useMemo(() => markets.map((market) => market.id), [markets]);

  const loadMarkets = useCallback(
    async (opts?: { force?: boolean; signal?: AbortSignal }) => {
      const force = opts?.force === true;
      const fresh =
        !force &&
        marketsRef.current.length > 0 &&
        Date.now() - lastMarketsFetchAt.current < MARKETS_STALE_MS;
      if (fresh) return;

      try {
        const next = await getMarketsByEventId(eventId, opts?.signal);
        if (opts?.signal?.aborted) return;
        setMarkets(next);
        setMarketsError(null);
        lastMarketsFetchAt.current = Date.now();
      } catch (error: unknown) {
        if (isAbortError(error) || opts?.signal?.aborted) return;
        setMarketsError(error instanceof ApiError ? error.message : 'Could not load markets');
      } finally {
        if (!opts?.signal?.aborted) setMarketsLoading(false);
      }
    },
    [eventId],
  );

  const loadPrice = useCallback(
    async (opts?: { force?: boolean; signal?: AbortSignal; showLoading?: boolean }) => {
      const activeSymbol = symbolRef.current;
      if (!activeSymbol) return;
      const key = `${activeSymbol}:${timeframe}`;
      const force = opts?.force === true;
      if (!force && lastPriceKeyRef.current === key && priceHistoryRef.current && !priceHistoryRef.current.stale) {
        return;
      }

      if (opts?.showLoading !== false) setChartLoading(true);
      try {
        const history = await getCryptoPriceHistory(activeSymbol, timeframe, {
          signal: opts?.signal,
          bypassCache: force,
        });
        if (opts?.signal?.aborted) return;
        // Drop stale responses after BTC↔ETH or timeframe switches.
        if (symbolRef.current !== activeSymbol) return;
        setPriceHistory((current) => mergeCryptoHistory(current, history));
        setPriceError(null);
        lastPriceKeyRef.current = key;
      } catch (error) {
        if (isAbortError(error) || opts?.signal?.aborted) return;
        setPriceHistory((current) => (current ? { ...current, stale: true } : current));
        setPriceError(error instanceof ApiError ? error.message : 'Could not load price history');
      } finally {
        if (!opts?.signal?.aborted) setChartLoading(false);
      }
    },
    [timeframe],
  );

  // Event + event-scoped markets only — never global /markets or /events?live=true.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setEvent(null);
      setMarkets([]);
      setMarketsLoading(true);
      setMarketsError(null);
      setPriceHistory(null);
      setPriceError(null);
      setChartLoading(true);
      lastPriceKeyRef.current = null;
      lastMarketsFetchAt.current = 0;

      void (async () => {
        try {
          const result = await getEventById(eventId, controller.signal);
          if (controller.signal.aborted) return;
          setEvent(result ?? null);
          if (!result?.symbol) {
            setChartLoading(false);
            setPriceError('This event has no crypto symbol mapped.');
          }
        } catch (error) {
          if (isAbortError(error) || controller.signal.aborted) return;
          setEvent(null);
          setChartLoading(false);
          setPriceError(error instanceof ApiError ? error.message : 'Could not load event');
        }
      })();
      void loadMarkets({ force: true, signal: controller.signal });
    }, 0);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [eventId, loadMarkets]);

  // Price history for the active symbol + timeframe only (deduped in cryptoService).
  useEffect(() => {
    if (!symbol) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void loadPrice({ force: false, signal: controller.signal, showLoading: true });
    }, 0);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [symbol, timeframe, loadPrice]);

  useLiveRefresh(
    () => {
      // Socket live: spot/odds arrive as events — do not re-hit REST while connected.
      if (currentConnectionState() === 'connected') return;
      // Skip until the mount effect has finished its first markets fetch; otherwise
      // focus/reconnect races fire a second /events/:id/markets before the socket is up.
      if (lastMarketsFetchAt.current === 0) return;
      void loadPrice({ showLoading: false });
      void loadMarkets();
    },
    {
      marketIds,
      refreshTypes: LIVE_RESYNC_TYPES,
      // No staleMs: mount effects own the initial REST load. Focus must not race them.
      onOdds: (liveEvent) => {
        const nextPrices = liveEvent.data?.selections;
        if (!nextPrices) return;
        setMarkets((current) =>
          current.map((market) =>
            market.id !== liveEvent.entityId
              ? market
              : {
                  ...market,
                  selections: market.selections.map((selection) => {
                    const next = nextPrices.find((item) => item.id === selection.id);
                    return next ? { ...selection, currentPrice: next.currentPrice } : selection;
                  }),
                },
          ),
        );
      },
      onEvent: (liveEvent) => {
        if (liveEvent.type === 'crypto.updated') {
          if (!symbol) return true;
          setPriceHistory((current) => applyCryptoSpot(current, liveEvent, symbol));
          return true;
        }
        if (
          liveEvent.type === 'market.settled' ||
          liveEvent.type === 'market.suspended' ||
          liveEvent.type === 'market.resumed'
        ) {
          if (marketIds.includes(liveEvent.entityId)) {
            void loadMarkets({ force: true });
          }
          return true;
        }
        return false;
      },
    },
  );

  const handleSelectTimeframe = (next: ChartTimeframe) => {
    if (next === timeframe) return;
    setTimeframe(next);
    setChartLoading(true);
    setPriceHistory(null);
    lastPriceKeyRef.current = null;
  };

  const onRefresh = useCallback(async () => {
    await Promise.all([loadMarkets({ force: true }), loadPrice({ force: true, showLoading: true })]);
  }, [loadMarkets, loadPrice]);

  const latestPrice = priceHistory?.currentPrice ?? 0;
  const changePercent = priceHistory?.changePercent ?? 0;
  const isPositive = changePercent >= 0;
  const hasPrice = latestPrice > 0 || (priceHistory?.points.length ?? 0) > 0;
  const priceIsStale = priceHistory?.stale === true;
  const socketLive = isSocketConnected();
  const lastUpdatedMs = priceHistory?.asOf ?? null;
  const openMarkets = markets.filter((market) => market.status === 'OPEN');
  const chartWidth = Dimensions.get('window').width - CHART_HORIZONTAL_PADDING;
  const title = event?.name ?? (symbol ? `${symbol}` : 'Crypto');

  const handleSelect = (market: Market, selectionId: number) => {
    const selection = market.selections.find((item) => item.id === selectionId);
    if (!selection || !event || market.status !== 'OPEN') return;
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

  return (
    <Screen>
      <Header
        title={title}
        subtitle={symbol ? `${symbol}/USD` : 'Loading…'}
        onBack={navigation.goBack}
        right={
          <IconButton
            name={watchlisted ? 'star' : 'star-outline'}
            color={watchlisted ? colors.warning : undefined}
            onPress={() => setWatchlisted((current) => !current)}
            accessibilityLabel={watchlisted ? 'Remove from watchlist' : 'Add to watchlist'}
          />
        }
      />

      <RefreshableScrollView onRefresh={onRefresh} contentContainerStyle={styles.content}>
        {chartLoading ? (
          <>
            <Skeleton width="60%" height={40} style={styles.skeletonSpacing} />
            <Skeleton width="100%" height={CHART_HEIGHT} style={styles.skeletonSpacing} />
          </>
        ) : !hasPrice ? (
          <AppText variant="body" color={colors.textSecondary} style={styles.sectionTitle}>
            {priceError ?? 'Price unavailable'}
          </AppText>
        ) : (
          <>
            <View style={styles.priceRow}>
              <AppText variant="display">{formatUsd(latestPrice)}</AppText>
              {priceIsStale && (
                <AppText variant="caption" color={colors.textMuted}>
                  Price delayed — showing the last known value
                </AppText>
              )}
              <AppText variant="caption" color={socketLive ? colors.positive : colors.textMuted}>
                {socketLive
                  ? 'Live spot price via socket'
                  : `Socket: ${connectionState}${priceIsStale ? ' · price delayed' : ''}`}
                {lastUpdatedMs
                  ? ` · Updated ${formatDateTime(new Date(lastUpdatedMs).toISOString())}`
                  : ''}
              </AppText>
              <View
                style={[styles.changeBadge, { backgroundColor: isPositive ? colors.positiveMuted : colors.negativeMuted }]}
              >
                <Ionicons
                  name={isPositive ? 'trending-up' : 'trending-down'}
                  size={layout.iconSizeSmall}
                  color={isPositive ? colors.positive : colors.negative}
                />
                <AppText variant="captionMedium" color={isPositive ? colors.positive : colors.negative}>
                  {isPositive ? '+' : ''}
                  {changePercent.toFixed(2)}% ({timeframe})
                </AppText>
              </View>
            </View>

            <View style={styles.timeframeRow}>
              {TIMEFRAMES.map((item) => {
                const active = item === timeframe;
                return (
                  <Touchable key={item} onPress={() => handleSelectTimeframe(item)} style={styles.timeframeItem}>
                    <AppText variant="captionMedium" color={active ? colors.accent : colors.textMuted}>
                      {item}
                    </AppText>
                  </Touchable>
                );
              })}
            </View>

            <View style={styles.chartWrapper}>
              {(priceHistory?.points.length ?? 0) >= 2 ? (
                <LineChart data={priceHistory!.points} width={chartWidth} height={CHART_HEIGHT} positive={isPositive} />
              ) : (
                <AppText variant="body" color={colors.textMuted}>
                  Not enough price history to draw a chart yet.
                </AppText>
              )}
            </View>
          </>
        )}

        <AppText variant="h3" style={styles.sectionTitle}>
          Market Predictions
        </AppText>
        {marketsLoading ? (
          <Skeleton width="100%" height={120} style={styles.skeletonSpacing} />
        ) : marketsError ? (
          <AppText variant="body" color={colors.negative} style={styles.sectionTitle}>
            {marketsError}
          </AppText>
        ) : markets.length === 0 ? (
          <AppText variant="body" color={colors.textSecondary} style={styles.sectionTitle}>
            No prediction markets available.
          </AppText>
        ) : (
          <>
            {openMarkets.length === 0 && (
              <AppText variant="body" color={colors.textSecondary} style={styles.sectionTitle}>
                All listed prediction markets are settled or closed. Spot price above still updates live; betting
                requires an OPEN market.
              </AppText>
            )}
            {markets.map((market) => (
              <View key={market.id}>
                <AppText variant="caption" color={colors.textMuted} style={styles.marketMeta}>
                  {market.status}
                  {event?.startTime ? ` · ${formatDateTime(event.startTime)}` : ''}
                </AppText>
                <MarketOddsCard
                  market={market}
                  fullWidth
                  onPressSelection={(selectionId) => handleSelect(market, selectionId)}
                />
              </View>
            ))}
          </>
        )}
      </RefreshableScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: layout.screenPaddingHorizontal,
    paddingBottom: spacing.xxxl,
  },
  skeletonSpacing: {
    marginBottom: spacing.lg,
  },
  priceRow: {
    marginBottom: spacing.md,
  },
  changeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
    borderRadius: radius.sm,
  },
  timeframeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  timeframeItem: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chartWrapper: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    marginBottom: spacing.md,
  },
  marketMeta: {
    marginBottom: spacing.xs,
  },
});
